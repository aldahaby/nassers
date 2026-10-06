import { acceptAllProposed, acceptPlan, addAssignment, assignmentProgress, cancelPlan, capacityFor, completeAssignment, dismissCapacityNote, isMissed, nextPlan, proposePlans, reschedulePlan, skipPlan, updateAssignment } from '../../planner/plannerService';
import { applySourceUpdate, resolveConflict } from '../../planner/sourceAuthority';
import { reconcileLmsCoursework } from '../../planner/lmsAdapters';
import { dayKeyIn, fromWallClock, minuteOfDay, toWallClock } from '../../planner/time';
import type { PlannerState } from '../../models';
import { at, counterIds, DAY, HOUR, MON, TZ, withAssignment, withCourse } from './helpers';

const plansOf = (s: PlannerState, assignmentId: string, status?: string) => Object.values(s.plans).filter((p) => p.assignmentId === assignmentId && (!status || p.status === status)).sort((a, b) => a.plannedStartAt - b.plannedStartAt);
const inAvailability = (s: PlannerState, ts: number, minutes: number) => {
  const w = toWallClock(ts, TZ);
  const m = minuteOfDay(ts, TZ);
  return s.preferences.availability.some((a) => a.weekday === w.weekday && m >= a.startMinute && m + minutes <= a.endMinute);
};

describe('plan generation', () => {
  it('single session when the estimate fits one preferred block', () => {
    const { state, assignmentId, ids } = withAssignment({ dueDayKey: '2026-10-15', estimatedMinutes: 45 });
    const r = proposePlans(state, MON, ids);
    const plans = plansOf(r.state, assignmentId);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ plannedMinutes: 45, status: 'proposed', planType: 'practice', createdBy: 'planner' });
    expect(r.warnings).toEqual([]);
  });

  it('multi-session work is spread across distinct days inside study windows', () => {
    const { state, assignmentId, ids } = withAssignment({ dueDayKey: '2026-10-22', type: 'exam', title: 'Midterm', estimatedMinutes: 180 });
    const r = proposePlans(state, MON, ids);
    const plans = plansOf(r.state, assignmentId);
    expect(plans).toHaveLength(4);
    expect(plans.map((p) => p.plannedMinutes)).toEqual([45, 45, 45, 45]);
    expect(new Set(plans.map((p) => dayKeyIn(p.plannedStartAt, TZ))).size).toBe(4);
    for (const p of plans) expect(inAvailability(r.state, p.plannedStartAt, p.plannedMinutes)).toBe(true);
    expect(plans.every((p) => p.planType === 'examPrep')).toBe(true);
    expect(plans.map((p) => p.sequenceIndex)).toEqual([1, 2, 3, 4]);
  });

  it('respects a custom preferred session length', () => {
    const { state, assignmentId, ids } = withAssignment({ dueDayKey: '2026-10-22', estimatedMinutes: 120 });
    const s = { ...state, preferences: { ...state.preferences, preferredSessionMinutes: 60 } };
    expect(plansOf(proposePlans(s, MON, ids).state, assignmentId).map((p) => p.plannedMinutes)).toEqual([60, 60]);
  });

  it('proposals never overlap each other or accepted plans', () => {
    const { state, courseId, ids } = withCourse();
    let s = state;
    for (const title of ['A', 'B', 'C']) s = addAssignment(s, { courseId, title, type: 'assignment', dueDayKey: '2026-10-15', dueTime: '23:59', estimatedMinutes: 90 }, MON, ids).state;
    s = proposePlans(s, MON, ids).state;
    const all = Object.values(s.plans).sort((a, b) => a.plannedStartAt - b.plannedStartAt);
    for (let i = 1; i < all.length; i++) expect(all[i]!.plannedStartAt).toBeGreaterThanOrEqual(all[i - 1]!.plannedStartAt + all[i - 1]!.plannedMinutes * 60_000);
  });

  it('accepted plans block time for later proposals', () => {
    const one = withAssignment({ dueDayKey: '2026-10-13', estimatedMinutes: 45 });
    let s = acceptAllProposed(proposePlans(one.state, MON, one.ids).state, MON, one.ids);
    const accepted = Object.values(s.plans)[0]!;
    s = addAssignment(s, { courseId: one.courseId, title: 'Other', type: 'reading', dueDayKey: '2026-10-13', dueTime: '23:59', estimatedMinutes: 45 }, MON, one.ids).state;
    const other = Object.values(s.assignments).find((a) => a.title === 'Other')!;
    const p = plansOf(proposePlans(s, MON, one.ids, [other.id]).state, other.id)[0]!;
    expect(Math.abs(p.plannedStartAt - accepted.plannedStartAt)).toBeGreaterThanOrEqual(45 * 60_000);
  });

  it('insufficient capacity: proposes what fits and warns with the numbers', () => {
    const { state, assignmentId, ids } = withAssignment({ dueDayKey: '2026-10-12', dueTime: '22:00', estimatedMinutes: 240 });
    const r = proposePlans(state, MON, ids);
    expect(r.warnings).toHaveLength(1);
    const w = r.warnings[0]!;
    expect(w.neededMinutes).toBe(240);
    expect(w.fitsMinutes).toBeLessThan(240);
    expect(w.fitsMinutes).toBeGreaterThan(0);
    expect(plansOf(r.state, assignmentId).reduce((s, p) => s + p.plannedMinutes, 0)).toBe(w.fitsMinutes);
    // The same numbers are available without proposing (Planner home card).
    expect(capacityFor(state, assignmentId, MON)).toMatchObject({ neededMinutes: 240 });
    expect(capacityFor(dismissCapacityNote(state, assignmentId), assignmentId, MON)).toBeNull();
  });

  it('skips work with no due date, no estimate, or dates still needing review', () => {
    const { state, courseId, ids } = withCourse();
    let s = addAssignment(state, { courseId, title: 'No date', type: 'paper', estimatedMinutes: 60 }, MON, ids).state;
    s = addAssignment(s, { courseId, title: 'No estimate', type: 'paper', dueDayKey: '2026-10-20' }, MON, ids).state;
    const r = proposePlans(s, MON, ids);
    expect(r.proposedPlanIds).toEqual([]);
    expect(r.skipped.map((x) => x.reason).sort()).toEqual(['noDueDate', 'noEstimate']);
  });

  it('re-planning replaces old proposals instead of stacking them', () => {
    const { state, assignmentId, ids } = withAssignment({ dueDayKey: '2026-10-22', estimatedMinutes: 90 });
    const once = proposePlans(state, MON, ids).state;
    const twice = proposePlans(once, MON, ids).state;
    expect(plansOf(twice, assignmentId)).toHaveLength(plansOf(once, assignmentId).length);
  });

  it('uses the planner time zone for study windows', () => {
    const { state, assignmentId, ids } = withAssignment({ dueDayKey: '2026-10-15', estimatedMinutes: 45 });
    const la = { ...state, preferences: { ...state.preferences, timezone: 'America/Los_Angeles' } };
    const p = plansOf(proposePlans(la, MON, ids).state, assignmentId)[0]!;
    expect(minuteOfDay(p.plannedStartAt, 'America/Los_Angeles')).toBeGreaterThanOrEqual(18 * 60);
  });

  it('handles the DST change (US fall back, 1 Nov 2026): windows stay at local evening times', () => {
    const now = fromWallClock({ year: 2026, month: 10, day: 30, hour: 9, minute: 0 }, TZ);
    const { state, assignmentId, ids } = withAssignment({ dueDayKey: '2026-11-04', type: 'exam', estimatedMinutes: 135 }, now);
    const plans = plansOf(proposePlans(state, now, ids).state, assignmentId);
    expect(plans.length).toBe(3);
    for (const p of plans) expect(minuteOfDay(p.plannedStartAt, TZ)).toBeGreaterThanOrEqual(13 * 60);
    expect(plans.some((p) => dayKeyIn(p.plannedStartAt, TZ) === '2026-11-01')).toBe(true);
  });
});

describe('plan actions and assignment lifecycle', () => {
  function accepted() {
    const ctx = withAssignment({ dueDayKey: '2026-10-22', estimatedMinutes: 90 });
    const s = acceptAllProposed(proposePlans(ctx.state, MON, ctx.ids).state, MON, ctx.ids);
    return { ...ctx, state: s, plans: plansOf(s, ctx.assignmentId) };
  }

  it('accept, reschedule, skip and cancel record status and events', () => {
    const { state, plans, ids } = accepted();
    expect(plans.every((p) => p.status === 'accepted')).toBe(true);
    const moved = reschedulePlan(state, plans[0]!.id, plans[0]!.plannedStartAt + HOUR, MON, ids);
    expect(moved.plans[plans[0]!.id]).toMatchObject({ status: 'rescheduled', rescheduledFrom: plans[0]!.plannedStartAt });
    const skipped = skipPlan(moved, plans[0]!.id, MON, ids);
    expect(skipped.plans[plans[0]!.id]!.status).toBe('skipped');
    const cancelled = cancelPlan(skipped, plans[1]!.id, MON, ids);
    expect(cancelled.plans[plans[1]!.id]!.status).toBe('cancelled');
    expect(cancelled.events.map((e) => e.type)).toEqual(expect.arrayContaining(['planCreated', 'planAccepted', 'planRescheduled', 'planSkipped', 'planCancelled']));
    expect(acceptPlan(cancelled, plans[1]!.id, MON, ids)).toBe(cancelled);
  });

  it('nextPlan and missed detection', () => {
    const { state, plans } = accepted();
    expect(nextPlan(state, MON)!.id).toBe(plans[0]!.id);
    expect(isMissed(plans[0]!, plans[0]!.plannedStartAt + 2 * HOUR)).toBe(true);
    expect(isMissed(plans[0]!, plans[0]!.plannedStartAt + 10 * 60_000)).toBe(false);
  });

  it('completing an assignment cancels its future plans', () => {
    const { state, assignmentId, ids } = accepted();
    const done = completeAssignment(state, assignmentId, MON, ids);
    expect(done.assignments[assignmentId]!.status).toBe('completed');
    expect(plansOf(done, assignmentId).every((p) => p.status === 'cancelled')).toBe(true);
    expect(done.events.at(-1)!.type).toBe('assignmentCompleted');
  });

  it('moving the deadline earlier cancels plans after it; progress reflects the estimate', () => {
    const { state, assignmentId, plans } = accepted();
    expect(assignmentProgress(state, assignmentId, MON)).toMatchObject({ remainingMinutes: 90, plannedMinutes: 90, unplannedMinutes: 0, studiedMinutes: 0 });
    const lastStart = plans.at(-1)!.plannedStartAt;
    const r = updateAssignment(state, assignmentId, { dueDayKey: dayKeyIn(lastStart, TZ), dueTime: '12:00' }, MON);
    expect(r.cancelledPlanIds).toContain(plans.at(-1)!.id);
    expect(r.state.assignments[assignmentId]!.userOverrides.due).toBe(true);
  });

  it('an edited title is a user override', () => {
    const { state, assignmentId } = accepted();
    const r = updateAssignment(state, assignmentId, { title: 'PS4 (curve sketching)' }, MON).state;
    expect(r.assignments[assignmentId]).toMatchObject({ title: 'PS4 (curve sketching)', userOverrides: { title: true }, fieldConfidence: { title: 'confirmed' } });
  });
});

describe('source authority and reconciliation', () => {
  const base = () => withAssignment({ dueDayKey: '2026-10-22', estimatedMinutes: 90 });
  const sourceTitle = (title: string, dueAt: number | null = at(10, 22, 23, 59)) => ({ title, type: 'assignment' as const, dueAt, dueDateOnly: false });

  it('LMS overrides a static syllabus value; a syllabus never overrides an LMS value', () => {
    const { state, assignmentId } = base();
    const a = { ...state.assignments[assignmentId]!, userOverrides: {}, sourceAuthority: 'syllabus' as const, sourceValues: sourceTitle('Problem Set 4') };
    const fromLms = applySourceUpdate(a, sourceTitle('Problem Set 4 (revised)'), 'lms', MON);
    expect(fromLms.assignment).toMatchObject({ title: 'Problem Set 4 (revised)', sourceAuthority: 'lms' });
    const fromSyllabus = applySourceUpdate(fromLms.assignment, sourceTitle('Old title'), 'syllabus', MON);
    expect(fromSyllabus.ignored).toBe(true);
    expect(fromSyllabus.assignment.title).toBe('Problem Set 4 (revised)');
  });

  it('user override beats every source and shows a conflict that can be resolved either way', () => {
    const { state, assignmentId } = base();
    const a = state.assignments[assignmentId]!; // student-entered: every field is an override
    const r = applySourceUpdate(a, sourceTitle('PS4 from LMS', at(10, 24, 23, 59)), 'lms', MON);
    expect(r.assignment.title).toBe('Problem Set 4');
    expect(r.conflictFields.sort()).toEqual(['due', 'title']);
    expect(r.assignment.reviewState).toBe('sourceConflict');
    const keepMine = resolveConflict(r.assignment, 'title', 'mine', MON);
    expect(keepMine.title).toBe('Problem Set 4');
    const takeSource = resolveConflict(keepMine, 'due', 'source', MON);
    expect(takeSource.dueAt).toBe(at(10, 24, 23, 59));
    expect(takeSource.reviewState).toBe('reviewed');
  });

  it('fixture LMS updates match by external id: update, never duplicate', () => {
    const { state, courseId, ids } = withCourse();
    const work = [{ externalId: 'x1', courseExternalId: 'c', title: 'Lab 1', type: 'lab' as const, dueAt: at(10, 20, 23, 59), state: 'published' as const, updatedAt: MON }];
    const first = reconcileLmsCoursework(state, courseId, work, MON, ids);
    expect(first.created).toHaveLength(1);
    const second = reconcileLmsCoursework(first.state, courseId, [{ ...work[0]!, dueAt: at(10, 21, 23, 59), updatedAt: MON + DAY }], MON + DAY, ids);
    expect(second.created).toHaveLength(0);
    expect(second.updated).toHaveLength(1);
    expect(Object.values(second.state.assignments)).toHaveLength(1);
    expect(Object.values(second.state.assignments)[0]!.dueAt).toBe(at(10, 21, 23, 59));
  });
});
