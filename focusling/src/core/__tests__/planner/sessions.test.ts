import { acceptAllProposed, addAssignment, assignmentProgress, proposePlans } from '../../planner/plannerService';
import { applyReminderDiff, desiredReminders, diffReminders } from '../../planner/reminderPolicy';
import { buildStudyContext, classifyStart, isRetrievalEligible, logSessionStart, recordFinishedSession } from '../../planner/studySessions';
import { addRetrievalItem, completeRetrievalOffer, dueRetrievalItems, nextDueAfter, recordAttempt } from '../../planner/retrievalService';
import { migratePlanner } from '../../planner/plannerState';
import { serializePlannerState } from '../../planner/privacy';
import type { FocusSession, PlannerState, StudyContext } from '../../models';
import { counterIds, DAY, MON, TZ, withCourse } from './helpers';

function setup(type: 'reading' | 'assignment' = 'reading', withReminders = true) {
  const { state, courseId, ids } = withCourse();
  let s = addAssignment(state, { courseId, title: type === 'reading' ? 'Read Ch. 5' : 'Problem Set 4', type, dueDayKey: '2026-10-14', dueTime: '23:59', estimatedMinutes: 45 }, MON, ids).state;
  s = acceptAllProposed(proposePlans(s, MON, ids).state, MON, ids);
  if (withReminders) {
    s = { ...s, preferences: { ...s.preferences, remindersEnabled: true, notificationPermission: 'granted' } };
    const diff = diffReminders(s.scheduledReminders, desiredReminders(s, MON, { activeSessionUntil: null }));
    s = applyReminderDiff(s, diff, Object.fromEntries(diff.toSchedule.map((d) => [d.key, `os-${d.key}`])), MON, ids);
  }
  const plan = Object.values(s.plans).find((p) => p.status === 'accepted')!;
  return { s, ids, plan, assignmentId: plan.assignmentId!, courseId };
}

function finished(ctx: StudyContext, start: number, minutes: number, status: 'completed' | 'abandoned' = 'completed'): FocusSession {
  return {
    id: `focus_${start}`,
    plannedDurationMinutes: 45,
    startedAt: start,
    endedAt: start + minutes * 60_000,
    status,
    blockedTargets: [],
    protectionMode: ctx.protectionMode ?? 'none',
    reward: { outcome: status, focusedMinutes: minutes, coins: 1, completionBonusCoins: 0, xp: 1, happinessDelta: 0, healthDelta: 0, bonusMultiplier: 1, leveledUpTo: null, stageReached: null },
    study: ctx,
  };
}

describe('start source and independent starts', () => {
  it('starting from the planner before the cue fires is independent', () => {
    const { s, plan } = setup();
    expect(classifyStart(s, plan.id, 'planner', plan.plannedStartAt - 5 * 60_000)).toMatchObject({ startContext: 'beforeReminder', independentStart: true });
  });

  it('starting from the notification action is notification-dependent', () => {
    const { s, plan } = setup();
    const r = classifyStart(s, plan.id, 'notification', plan.plannedStartAt + 60_000);
    expect(r).toMatchObject({ startContext: 'notificationAction', independentStart: false });
    expect(r.reminderExposureId).toBeDefined();
  });

  it('opening the app after the cue was delivered is not counted as independent', () => {
    const { s, plan } = setup();
    expect(classifyStart(s, plan.id, 'app', plan.plannedStartAt + 2 * 60_000)).toMatchObject({ startContext: 'afterReminderWithoutAction', independentStart: false });
  });

  it('widget starts and unscheduled starts are distinguished', () => {
    const { s, plan } = setup('reading', false);
    expect(classifyStart(s, plan.id, 'widget', plan.plannedStartAt)).toMatchObject({ startContext: 'widget', independentStart: true });
    expect(classifyStart(s, plan.id, 'planner', plan.plannedStartAt)).toMatchObject({ startContext: 'plannerOrApp', independentStart: true });
    expect(classifyStart(s, undefined, 'manual', plan.plannedStartAt)).toMatchObject({ startContext: 'unscheduled', independentStart: true });
  });

  it('the study context carries plan, course, assignment and the protection request', () => {
    const { s, plan } = setup();
    const ctx = buildStudyContext(s, { planId: plan.id, source: 'planner', protectionMode: 'wholeApp' }, plan.plannedStartAt);
    expect(ctx).toMatchObject({ sessionPlanId: plan.id, assignmentId: plan.assignmentId, courseId: plan.courseId, plannedStartAt: plan.plannedStartAt, protectionRequested: true, planType: 'reading', startSource: 'planner' });
    // Until the protection service confirms, protection is not reported as on.
    expect(ctx.protectionResult).toBe('failed');
    expect(buildStudyContext(s, { source: 'app', protectionMode: 'none' }, MON)).toMatchObject({ protectionRequested: false, protectionResult: 'notRequested' });
  });

  it('logs session start, protection requested and the real protection result', () => {
    const { s, plan, ids } = setup();
    const ok = { ...buildStudyContext(s, { planId: plan.id, source: 'notification', protectionMode: 'wholeApp' }, plan.plannedStartAt), protectionResult: 'activated' as const };
    const types = logSessionStart(s, ok, plan.plannedStartAt, ids).events.slice(-4).map((e) => e.type);
    expect(types).toEqual(['notificationStartAction', 'sessionStarted', 'protectionRequested', 'protectionActivated']);
    const failed = { ...ok, protectionResult: 'failed' as const };
    expect(logSessionStart(s, failed, plan.plannedStartAt, ids).events.at(-1)!.type).toBe('protectionFailed');
  });
});

describe('recording finished sessions', () => {
  it('complete: a StudySession with truthful protection, plan completed, assignment history updated, retrieval offered', () => {
    const { s, plan, ids, assignmentId } = setup('reading');
    const ctx = { ...buildStudyContext(s, { planId: plan.id, source: 'planner', protectionMode: 'wholeApp' }, plan.plannedStartAt), protectionResult: 'activated' as const };
    const next = recordFinishedSession(s, finished(ctx, plan.plannedStartAt, 45), ids);
    const rec = Object.values(next.studySessions)[0]!;
    expect(rec).toMatchObject({ outcome: 'completed', actualFocusedMinutes: 45, protectionRequested: true, protectionActivated: true, sessionPlanId: plan.id, retrievalOffered: true, startSource: 'planner' });
    expect(next.plans[plan.id]!.status).toBe('completed');
    expect(assignmentProgress(next, assignmentId, plan.plannedStartAt + 3_600_000).studiedMinutes).toBe(45);
    expect(next.pendingRetrieval?.studySessionId).toBe(rec.id);
    // Recorded once even if seen again (reload).
    expect(recordFinishedSession(next, finished(ctx, plan.plannedStartAt, 45), ids)).toBe(next);
  });

  it('protection failure is recorded as not activated (never "protected")', () => {
    const { s, plan, ids } = setup();
    const ctx = buildStudyContext(s, { planId: plan.id, source: 'notification', protectionMode: 'wholeApp' }, plan.plannedStartAt);
    const rec = Object.values(recordFinishedSession(s, finished(ctx, plan.plannedStartAt, 45), ids).studySessions)[0]!;
    expect(rec).toMatchObject({ protectionRequested: true, protectionActivated: false });
  });

  it('end early is recorded as endedEarly with the real focused minutes', () => {
    const { s, plan, ids } = setup();
    const ctx = buildStudyContext(s, { planId: plan.id, source: 'planner', protectionMode: 'none' }, plan.plannedStartAt);
    const next = recordFinishedSession(s, finished(ctx, plan.plannedStartAt, 12, 'abandoned'), ids);
    expect(Object.values(next.studySessions)[0]).toMatchObject({ outcome: 'endedEarly', actualFocusedMinutes: 12 });
    expect(next.events.some((e) => e.type === 'sessionEndedEarly')).toBe(true);
  });

  it('survives a reload (serialised and migrated)', () => {
    const { s, plan, ids } = setup();
    const ctx = buildStudyContext(s, { planId: plan.id, source: 'widget', protectionMode: 'none' }, plan.plannedStartAt);
    const next = recordFinishedSession(s, finished(ctx, plan.plannedStartAt, 45), ids);
    const reloaded = migratePlanner(JSON.parse(serializePlannerState(next)), MON, TZ);
    expect(Object.values(reloaded.studySessions)[0]).toMatchObject({ startSource: 'widget' });
  });
});

describe('retrieval', () => {
  it('eligibility is a config rule by plan type and length', () => {
    expect(isRetrievalEligible('reading', 'completed', 30)).toBe(true);
    expect(isRetrievalEligible('examPrep', 'completed', 30)).toBe(true);
    expect(isRetrievalEligible('writing', 'completed', 30)).toBe(false);
    expect(isRetrievalEligible('admin', 'completed', 30)).toBe(false);
    expect(isRetrievalEligible('practice', 'completed', 30)).toBe(false);
    expect(isRetrievalEligible('reading', 'completed', 5)).toBe(false);
    expect(isRetrievalEligible(undefined, 'completed', 30)).toBe(false);
  });

  it('non-eligible sessions get no offer', () => {
    const { s, plan, ids } = setup('assignment');
    const ctx = buildStudyContext(s, { planId: plan.id, source: 'planner', protectionMode: 'none' }, plan.plannedStartAt);
    const next = recordFinishedSession(s, finished(ctx, plan.plannedStartAt, 45), ids);
    expect(next.pendingRetrieval).toBeNull();
    expect(Object.values(next.studySessions)[0]!.retrievalOffered).toBe(false);
  });

  function offered() {
    const { s, plan, ids } = setup('reading');
    const ctx = buildStudyContext(s, { planId: plan.id, source: 'planner', protectionMode: 'none' }, plan.plannedStartAt);
    return { s: recordFinishedSession(s, finished(ctx, plan.plannedStartAt, 45), ids), ids, plan };
  }

  it('brain dump: saved as free recall with the self-rating, linked to course, assignment and session; offered once', () => {
    const { s, ids, plan } = offered();
    const next = completeRetrievalOffer(s, { kind: 'brainDump', notes: 'Le Chatelier shifts equilibrium', result: 'partly' }, MON + DAY, ids);
    const item = Object.values(next.retrievalItems)[0]!;
    expect(item).toMatchObject({ type: 'freeRecall', lastResult: 'partly', attemptCount: 1, assignmentId: plan.assignmentId, courseId: plan.courseId, answer: 'Le Chatelier shifts equilibrium' });
    expect(item.sourceSessionId).toBe(Object.values(next.studySessions)[0]!.id);
    expect(item.nextDueAt).toBe(nextDueAfter('partly', MON + DAY));
    expect(next.pendingRetrieval).toBeNull();
    expect(Object.values(next.studySessions)[0]!.retrievalCompleted).toBe(true);
    expect(completeRetrievalOffer(next, { kind: 'skip' }, MON, ids)).toBe(next);
  });

  it('question/answer items and "Not now"', () => {
    const { s, ids } = offered();
    const q = completeRetrievalOffer(s, { kind: 'question', prompt: 'What shifts equilibrium?', answer: 'Changes in concentration, pressure, temperature' }, MON, ids);
    expect(Object.values(q.retrievalItems)[0]).toMatchObject({ type: 'questionAnswer', attemptCount: 0 });
    const skipped = completeRetrievalOffer(s, { kind: 'skip' }, MON, ids);
    expect(skipped.pendingRetrieval).toBeNull();
    expect(skipped.retrievalItems).toEqual({});
    expect(skipped.events.at(-1)!.type).toBe('retrievalSkipped');
  });

  it('attempts update result, count and a future-compatible nextDueAt; items persist', () => {
    const ids = counterIds();
    const base = withCourse().state;
    const { state, itemId } = addRetrievalItem(base, { type: 'concept', prompt: 'Activation energy' }, MON, ids);
    let s: PlannerState = recordAttempt(state, itemId, 'missed', MON, ids);
    s = recordAttempt(s, itemId, 'got', MON + DAY, ids);
    const item = s.retrievalItems[itemId]!;
    expect(item).toMatchObject({ attemptCount: 2, lastResult: 'got', nextDueAt: nextDueAfter('got', MON + DAY) });
    expect(item.attempts.map((a) => a.result)).toEqual(['missed', 'got']);
    expect(dueRetrievalItems(s, MON + 10 * DAY).map((i) => i.id)).toEqual([itemId]);
    expect(migratePlanner(JSON.parse(serializePlannerState(s)), MON, TZ).retrievalItems[itemId]).toEqual(item);
  });
});
