import { RETRIEVAL_ELIGIBLE, RETRIEVAL_RULES } from '@/config/planner';
import type { FocusSession, Id, PlanType, PlannerState, ProtectionMode, ProtectionResult, StartContext, StartSource, StudyContext, StudySession, Timestamp } from '../models';
import { logEvent, type IdGen } from './plannerState';
import { deliveredStartCue } from './reminderPolicy';

/**
 * Study sessions ride on the one canonical timer (the game's FocusSession).
 * This module (1) builds the StudyContext attached when a session starts and
 * (2) writes the durable StudySession record when it ends.
 *
 * Independent start (docs/STUDYLING_PLANNER.md §8): a planned session that
 * starts without relying on its start notification, i.e. not from the
 * notification action and before any start cue for that plan was delivered.
 * A cue counts as delivered when the OS reported it, or (when the OS can't
 * tell us) once its fire time passed without being cancelled.
 */
export function classifyStart(state: PlannerState, planId: Id | undefined, source: StartSource, at: Timestamp): { startContext: StartContext; independentStart: boolean; reminderExposureId?: Id } {
  if (!planId) return { startContext: 'unscheduled', independentStart: true };
  const cue = deliveredStartCue(state, planId, at);
  if (source === 'notification') return { startContext: 'notificationAction', independentStart: false, reminderExposureId: cue?.id };
  if (cue) return { startContext: 'afterReminderWithoutAction', independentStart: false, reminderExposureId: cue.id };
  const anyCue = Object.values(state.exposures).some((e) => e.kind === 'startCue' && e.planIds.includes(planId) && !e.cancelledAt);
  if (anyCue) return { startContext: 'beforeReminder', independentStart: true };
  return { startContext: source === 'widget' || source === 'liveActivity' ? 'widget' : 'plannerOrApp', independentStart: true };
}

export interface StartRequest {
  planId?: Id;
  assignmentId?: Id;
  courseId?: Id;
  source: StartSource;
  protectionMode: ProtectionMode;
}

/** The context stored on the FocusSession. Protection fields are filled in after the protection service answers. */
export function buildStudyContext(state: PlannerState, req: StartRequest, at: Timestamp): StudyContext {
  const plan = req.planId ? state.plans[req.planId] : undefined;
  const assignmentId = plan?.assignmentId ?? req.assignmentId;
  const assignment = assignmentId ? state.assignments[assignmentId] : undefined;
  const cls = classifyStart(state, plan?.id, req.source, at);
  return {
    courseId: plan?.courseId ?? assignment?.courseId ?? req.courseId,
    assignmentId,
    sessionPlanId: plan?.id,
    plannedStartAt: plan?.plannedStartAt,
    startSource: req.source,
    ...cls,
    protectionRequested: req.protectionMode !== 'none',
    protectionResult: req.protectionMode === 'none' ? 'notRequested' : 'failed',
    protectionMode: req.protectionMode,
    planType: plan?.planType,
  };
}

export function protectionActivated(result: ProtectionResult): boolean {
  return result === 'activated';
}

export function isRetrievalEligible(planType: PlanType | undefined, outcome: StudySession['outcome'], focusedMinutes: number): boolean {
  if (!planType || !RETRIEVAL_ELIGIBLE[planType]) return false;
  if (focusedMinutes < RETRIEVAL_RULES.minFocusedMinutes) return false;
  return outcome === 'completed' || focusedMinutes >= RETRIEVAL_RULES.minFocusedMinutes;
}

/**
 * Record a finished FocusSession as a StudySession (once per session), mark
 * its plan completed, log events, and queue a retrieval offer when eligible.
 */
export function recordFinishedSession(state: PlannerState, session: FocusSession, ids: IdGen): PlannerState {
  if (session.status === 'active' || !session.endedAt) return state;
  if (Object.values(state.studySessions).some((s) => s.focusSessionId === session.id)) return state;
  const ctx: StudyContext = session.study ?? { startSource: 'app', startContext: 'unscheduled', independentStart: true, protectionRequested: session.protectionMode !== 'none', protectionResult: session.protectionMode !== 'none' ? 'unknown' : 'notRequested', protectionMode: session.protectionMode };
  const outcome = session.status === 'completed' ? 'completed' : 'endedEarly';
  const focused = session.reward?.focusedMinutes ?? Math.round((session.endedAt - session.startedAt) / 60_000);
  const eligible = isRetrievalEligible(ctx.planType, outcome, focused);
  const id = ids('study');
  const record: StudySession = {
    id,
    focusSessionId: session.id,
    courseId: ctx.courseId,
    assignmentId: ctx.assignmentId,
    sessionPlanId: ctx.sessionPlanId,
    plannedStartAt: ctx.plannedStartAt,
    actualStartAt: session.startedAt,
    endedAt: session.endedAt,
    plannedMinutes: session.plannedDurationMinutes,
    actualFocusedMinutes: focused,
    outcome,
    protectionRequested: ctx.protectionRequested,
    protectionActivated: protectionActivated(ctx.protectionResult),
    protectionMode: ctx.protectionMode,
    startSource: ctx.startSource,
    startContext: ctx.startContext,
    reminderExposureId: ctx.reminderExposureId,
    independentStart: ctx.independentStart,
    retrievalOffered: eligible,
    retrievalCompleted: false,
    planType: ctx.planType,
  };
  let next: PlannerState = { ...state, studySessions: { ...state.studySessions, [id]: record } };
  if (ctx.sessionPlanId && next.plans[ctx.sessionPlanId]) {
    next = { ...next, plans: { ...next.plans, [ctx.sessionPlanId]: { ...next.plans[ctx.sessionPlanId]!, status: 'completed', updatedAt: session.endedAt } } };
  }
  const base = { courseId: ctx.courseId, assignmentId: ctx.assignmentId, planId: ctx.sessionPlanId, sessionId: id };
  next = logEvent(next, ids, session.endedAt, outcome === 'completed' ? 'sessionCompleted' : 'sessionEndedEarly', { ...base, data: { focusedMinutes: focused, source: ctx.startSource, independent: ctx.independentStart } });
  if (eligible) {
    next = { ...next, pendingRetrieval: { studySessionId: id, offeredAt: session.endedAt } };
    next = logEvent(next, ids, session.endedAt, 'retrievalOffered', base);
  }
  return next;
}

/** Events for a session start (the start itself and the protection result). */
export function logSessionStart(state: PlannerState, ctx: StudyContext, at: Timestamp, ids: IdGen): PlannerState {
  const base = { courseId: ctx.courseId, assignmentId: ctx.assignmentId, planId: ctx.sessionPlanId };
  let next = state;
  if (ctx.startSource === 'notification') next = logEvent(next, ids, at, 'notificationStartAction', base);
  next = logEvent(next, ids, at, 'sessionStarted', { ...base, data: { source: ctx.startSource, context: ctx.startContext, independent: ctx.independentStart } });
  if (ctx.protectionRequested) {
    next = logEvent(next, ids, at, 'protectionRequested', { ...base, data: { mode: ctx.protectionMode ?? 'none' } });
    next = logEvent(next, ids, at, ctx.protectionResult === 'failed' ? 'protectionFailed' : 'protectionActivated', { ...base, data: { result: ctx.protectionResult } });
  }
  return next;
}
