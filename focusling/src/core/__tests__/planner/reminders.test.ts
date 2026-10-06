import { REMINDER_FADING_POLICY } from '@/config/planner';
import { acceptAllProposed, addAssignment, completeAssignment, deleteAssignment, proposePlans, reschedulePlan, updateAssignment } from '../../planner/plannerService';
import { answerRecoveryOffer, applyReminderDiff, desiredReminders, diffReminders, effectiveSupport, evaluateSupport, markPresented, updateSupport } from '../../planner/reminderPolicy';
import { migratePlanner } from '../../planner/plannerState';
import { serializePlannerState } from '../../planner/privacy';
import { minuteOfDay } from '../../planner/time';
import type { PlannerState, SupportObservation, UserProgress } from '../../models';
import { counterIds, DAY, HOUR, MON, TZ, withCourse } from './helpers';

function planned(opts: { granted?: boolean; enabled?: boolean } = {}) {
  const { state, courseId, ids } = withCourse();
  let s = addAssignment(state, { courseId, title: 'Problem Set 4', type: 'assignment', dueDayKey: '2026-10-14', dueTime: '23:59', estimatedMinutes: 90 }, MON, ids).state;
  s = addAssignment(s, { courseId, title: 'Read Ch. 5', type: 'reading', dueDayKey: '2026-10-14', dueTime: '23:59', estimatedMinutes: 45 }, MON, ids).state;
  s = acceptAllProposed(proposePlans(s, MON, ids).state, MON, ids);
  s = { ...s, preferences: { ...s.preferences, remindersEnabled: opts.enabled ?? true, notificationPermission: opts.granted === false ? 'denied' : 'granted' } };
  return { s, ids };
}

/** Simulates the notification service: schedules everything, returns fake OS ids. */
function sync(s: PlannerState, now: number, ids: ReturnType<typeof counterIds>, active: number | null = null) {
  const desired = desiredReminders(s, now, { activeSessionUntil: active });
  const diff = diffReminders(s.scheduledReminders, desired);
  const osIds = Object.fromEntries(diff.toSchedule.map((d) => [d.key, `os-${d.key}`]));
  return { state: applyReminderDiff(s, diff, osIds, now, ids), diff, desired };
}

describe('reminder scheduling', () => {
  it('schedules one start cue per accepted plan (Start & Lock category) and no per-assignment spam', () => {
    const { s, ids } = planned();
    const { state, desired } = sync(s, MON, ids);
    const cues = desired.filter((d) => d.kind === 'startCue');
    expect(cues).toHaveLength(Object.values(s.plans).filter((p) => p.status === 'accepted').length);
    expect(cues.every((c) => c.categoryId === 'studyling.start')).toBe(true);
    expect(Object.keys(state.scheduledReminders)).toHaveLength(desired.length);
    expect(Object.values(state.exposures)).toHaveLength(desired.length);
  });

  it('nothing is scheduled without permission or with reminders off; the planner still works', () => {
    expect(desiredReminders(planned({ granted: false }).s, MON, { activeSessionUntil: null })).toEqual([]);
    expect(desiredReminders(planned({ enabled: false }).s, MON, { activeSessionUntil: null })).toEqual([]);
  });

  it('a busy day gets one digest (Standard only), never before 8:00 or after the first block', () => {
    const { state, courseId, ids } = withCourse();
    let s = addAssignment(state, { courseId, title: 'A', type: 'reading', dueDayKey: '2026-10-13', dueTime: '23:59', estimatedMinutes: 45 }, MON, ids).state;
    s = addAssignment(s, { courseId, title: 'B', type: 'reading', dueDayKey: '2026-10-13', dueTime: '23:59', estimatedMinutes: 45 }, MON, ids).state;
    s = acceptAllProposed(proposePlans(s, MON, ids).state, MON, ids);
    s = { ...s, preferences: { ...s.preferences, remindersEnabled: true, notificationPermission: 'granted', lockScreenDetail: 'detailed' } };
    const privateDigest = desiredReminders({ ...s, preferences: { ...s.preferences, lockScreenDetail: 'private' } }, MON, { activeSessionUntil: null }).find((d) => d.kind === 'digest')!;
    expect(privateDigest.body).toBe('2 study blocks · 1h 30m');
    const digests = desiredReminders(s, MON, { activeSessionUntil: null }).filter((d) => d.kind === 'digest');
    expect(digests.length).toBeGreaterThan(0);
    for (const d of digests) {
      expect(minuteOfDay(d.fireAt, TZ)).toBeGreaterThanOrEqual(8 * 60);
      expect(d.body.split('\n').length).toBe(d.planIds.length);
    }
    const light = { ...s, progress: { ...s.progress, supportLevel: 'light' as const } };
    expect(desiredReminders(light, MON, { activeSessionUntil: null }).some((d) => d.kind === 'digest')).toBe(false);
  });

  it('respects quiet hours', () => {
    const { s } = planned();
    const allQuiet = { ...s, preferences: { ...s.preferences, quietHours: { startMinute: 0, endMinute: 23 * 60 + 59 } } };
    expect(desiredReminders(allQuiet, MON, { activeSessionUntil: null })).toEqual([]);
  });

  it('suppresses reminders during an active study session', () => {
    const { s } = planned();
    const all = desiredReminders(s, MON, { activeSessionUntil: null });
    const first = all[0]!;
    const during = desiredReminders(s, MON, { activeSessionUntil: first.fireAt + 60_000 });
    expect(during.find((d) => d.key === first.key)).toBeUndefined();
  });

  it('completed assignments, deleted work and rescheduled plans update the pending set without duplicates', () => {
    const { s, ids } = planned();
    const first = sync(s, MON, ids).state;
    // Reload: running the same sync again schedules nothing new (no duplicates).
    const reloaded = migratePlanner(JSON.parse(serializePlannerState(first)), MON, TZ);
    expect(sync(reloaded, MON, ids).diff.toSchedule).toEqual([]);
    const ps4 = Object.values(first.assignments).find((a) => a.title === 'Problem Set 4')!;
    const done = completeAssignment(first, ps4.id, MON, ids);
    const afterDone = sync(done, MON, ids);
    expect(afterDone.diff.toCancel.some((c) => c.planId && first.plans[c.planId]?.assignmentId === ps4.id)).toBe(true);
    const reading = Object.values(first.assignments).find((a) => a.title === 'Read Ch. 5')!;
    const deleted = sync(deleteAssignment(first, reading.id, MON), MON, ids);
    expect(deleted.diff.toCancel.length).toBeGreaterThan(0);
    const plan = Object.values(first.plans).find((p) => p.status === 'accepted')!;
    const moved = sync(reschedulePlan(first, plan.id, plan.plannedStartAt + HOUR, MON, ids), MON, ids);
    expect(moved.diff.toCancel.map((c) => c.planId)).toContain(plan.id);
    expect(moved.diff.toSchedule.filter((d) => d.planIds.includes(plan.id) && d.kind === 'startCue')).toHaveLength(1);
    expect(Object.values(moved.state.exposures).some((e) => e.cancelledAt)).toBe(true);
  });

  it('a deadline update that cancels a plan cancels its reminder', () => {
    const { s, ids } = planned();
    const first = sync(s, MON, ids).state;
    const ps4 = Object.values(first.assignments).find((a) => a.title === 'Problem Set 4')!;
    const r = updateAssignment(first, ps4.id, { dueDayKey: '2026-10-12', dueTime: '12:00' }, MON);
    expect(r.cancelledPlanIds.length).toBeGreaterThan(0);
    const after = sync(r.state, MON, ids);
    for (const id of r.cancelledPlanIds) expect(Object.values(after.state.scheduledReminders).some((x) => x.planId === id)).toBe(false);
  });

  it('private lock-screen mode removes course and assignment names from notification text', () => {
    const { s } = planned();
    const detailed = desiredReminders({ ...s, preferences: { ...s.preferences, lockScreenDetail: 'detailed' } }, MON, { activeSessionUntil: null });
    const priv = desiredReminders(s, MON, { activeSessionUntil: null });
    expect(detailed.some((d) => /Chemistry|Problem Set 4/.test(d.title + d.body))).toBe(true);
    expect(priv.every((d) => !/Chemistry|CHEM|Problem Set|Read Ch/.test(d.title + d.body))).toBe(true);
    // Changing privacy reschedules (text differs), it doesn't duplicate.
    const diff = diffReminders(Object.fromEntries(detailed.map((d) => [d.key, { key: d.key, kind: d.kind, osId: 'x', fireAt: d.fireAt, exposureId: 'e', sig: d.sig }])), priv);
    expect(diff.toSchedule.length).toBe(diff.toCancel.length);
  });

  it('marks presented exposures (for independent-start analysis)', () => {
    const { s, ids } = planned();
    const first = sync(s, MON, ids).state;
    const key = Object.keys(first.scheduledReminders)[0]!;
    const shown = markPresented(first, key, MON + 1, ids);
    expect(Object.values(shown.exposures).some((e) => e.presentedAt === MON + 1)).toBe(true);
  });
});

describe('reminder fading (experimental policy)', () => {
  const progress = (level: UserProgress['supportLevel'], obs: Partial<SupportObservation>[], changedAt = 0): UserProgress => ({
    supportLevel: level,
    supportChangedAt: changedAt,
    supportReason: '',
    policyVersion: REMINDER_FADING_POLICY.version,
    observedPlanIds: [],
    observations: obs.map((o, i) => ({ planId: `p${i}`, plannedStartAt: 1000 + i, started: true, onTime: true, independent: true, ...o })),
    recoveryOffer: 'none',
  });

  it('Standard stays Standard without evidence', () => {
    expect(evaluateSupport(progress('standard', []), 'adaptive', MON).progress.supportLevel).toBe('standard');
    expect(evaluateSupport(progress('standard', [{}, {}, {}]), 'adaptive', MON).progress.supportLevel).toBe('standard');
  });

  it('Standard → Light: 3 of last 4 on time and 2 independent', () => {
    const p = progress('standard', [{ independent: false }, { independent: false }, {}, {}]);
    const r = evaluateSupport(p, 'adaptive', MON);
    expect(r.progress.supportLevel).toBe('light');
    expect(r.progress.supportReason).toMatch(/3|4 of your last 4/);
    expect(evaluateSupport(progress('standard', [{ independent: false }, { independent: false }, { independent: false }, {}]), 'adaptive', MON).progress.supportLevel).toBe('standard');
    expect(evaluateSupport(progress('standard', [{ onTime: false }, { onTime: false }, {}, {}]), 'adaptive', MON).progress.supportLevel).toBe('standard');
  });

  it('Light → Ambient only after another window, with mostly independent starts', () => {
    const changedAt = 2000;
    const before = [{}, {}, {}, {}].map((o, i) => ({ ...o, plannedStartAt: 1000 + i }));
    const after = (independent: boolean[]) => independent.map((ind, i) => ({ plannedStartAt: 3000 + i, independent: ind }));
    const mostly = progress('light', [...before, ...after([true, true, true, false])], changedAt);
    expect(evaluateSupport(mostly, 'adaptive', MON).progress.supportLevel).toBe('ambient');
    const half = progress('light', [...before, ...after([true, true, false, false])], changedAt);
    expect(evaluateSupport(half, 'adaptive', MON).progress.supportLevel).toBe('light');
    const tooFew = progress('light', [...before, ...after([true, true, true])], changedAt);
    expect(evaluateSupport(tooFew, 'adaptive', MON).progress.supportLevel).toBe('light');
  });

  it('the student preference overrides adaptation', () => {
    const ready = progress('standard', [{}, {}, {}, {}]);
    expect(evaluateSupport(ready, 'always', MON).progress.supportLevel).toBe('standard');
    expect(effectiveSupport({ ...ready, supportLevel: 'ambient' }, 'always')).toBe('standard');
    expect(effectiveSupport({ ...ready, supportLevel: 'standard' }, 'minimal')).toBe('light');
    expect(effectiveSupport({ ...ready, supportLevel: 'ambient' }, 'adaptive')).toBe('ambient');
  });

  it('missed plans on a lighter level offer help instead of escalating automatically', () => {
    const p = progress('light', [{}, { started: false, onTime: false, independent: false }, { started: false, onTime: false, independent: false }], 0);
    const r = evaluateSupport(p, 'adaptive', MON);
    expect(r.progress.supportLevel).toBe('light');
    expect(r.progress.recoveryOffer).toBe('pending');
    expect(answerRecoveryOffer(r.progress, 'restore', MON)).toMatchObject({ supportLevel: 'standard', recoveryOffer: 'none' });
    const calm = answerRecoveryOffer(r.progress, 'calm', MON);
    expect(calm).toMatchObject({ supportLevel: 'light', recoveryOffer: 'none', recoveryDismissedAt: MON });
    // Not asked again during the quiet period.
    expect(evaluateSupport(calm, 'adaptive', MON + DAY).progress.recoveryOffer).toBe('none');
  });

  it('misses on Standard never add extra reminders (no spam escalation)', () => {
    const p = progress('standard', [{ started: false }, { started: false }, { started: false }]);
    const r = evaluateSupport(p, 'adaptive', MON);
    expect(r.progress).toMatchObject({ supportLevel: 'standard', recoveryOffer: 'none' });
  });

  it('policy version is persisted; a new version starts a fresh window but keeps the level', () => {
    const old = { ...progress('light', [{}, {}, {}, {}]), policyVersion: 'fading-v0' };
    const r = evaluateSupport(old, 'adaptive', MON);
    expect(r.progress.policyVersion).toBe(REMINDER_FADING_POLICY.version);
    expect(r.progress.supportLevel).toBe('light');
    expect(r.progress.supportChangedAt).toBe(MON);
    const reloaded = migratePlanner(JSON.parse(JSON.stringify({ plannerSchemaVersion: 1, progress: r.progress })), MON, TZ);
    expect(reloaded.progress.policyVersion).toBe(REMINDER_FADING_POLICY.version);
  });

  it('missed plans become observations after the missed window (once each)', () => {
    const { s, ids } = planned();
    const late = Math.max(...Object.values(s.plans).map((p) => p.plannedStartAt)) + 3 * HOUR;
    const once = updateSupport(s, late, ids);
    expect(once.progress.observations.length).toBe(Object.values(s.plans).filter((p) => p.status === 'accepted').length);
    expect(once.progress.observations.every((o) => !o.started)).toBe(true);
    expect(updateSupport(once, late + HOUR, ids).progress.observations.length).toBe(once.progress.observations.length);
  });
});
