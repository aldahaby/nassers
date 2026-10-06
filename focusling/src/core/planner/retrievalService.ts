import { RETRIEVAL_RULES } from '@/config/planner';
import type { Id, PlannerState, RetrievalItem, RetrievalItemType, RetrievalResult, Timestamp } from '../models';
import { logEvent, type IdGen } from './plannerState';

const DAY = 24 * 60 * 60_000;

/**
 * Lightweight, student-made retrieval practice. No generated questions and no
 * spaced-repetition algorithm: a fixed, documented follow-up interval per
 * result keeps `nextDueAt` meaningful until a scheduler replaces it.
 */

export function nextDueAfter(result: RetrievalResult, at: Timestamp): Timestamp {
  return at + RETRIEVAL_RULES.nextDueDays[result] * DAY;
}

export interface NewRetrievalItem {
  type: RetrievalItemType;
  prompt: string;
  answer?: string;
  courseId?: Id;
  assignmentId?: Id;
  sourceSessionId?: Id;
}

export function addRetrievalItem(state: PlannerState, input: NewRetrievalItem, now: Timestamp, ids: IdGen, firstResult?: RetrievalResult): { state: PlannerState; itemId: Id } {
  const id = ids('recall');
  const item: RetrievalItem = {
    id,
    type: input.type,
    prompt: input.prompt.trim(),
    answer: input.answer?.trim() || undefined,
    courseId: input.courseId,
    assignmentId: input.assignmentId,
    sourceSessionId: input.sourceSessionId,
    createdAt: now,
    attemptCount: 0,
    attempts: [],
  };
  let next: PlannerState = { ...state, retrievalItems: { ...state.retrievalItems, [id]: item } };
  if (firstResult) next = recordAttempt(next, id, firstResult, now, ids, input.sourceSessionId);
  return { state: next, itemId: id };
}

export function recordAttempt(state: PlannerState, itemId: Id, result: RetrievalResult, now: Timestamp, ids: IdGen, sessionId?: Id): PlannerState {
  const item = state.retrievalItems[itemId];
  if (!item) return state;
  const updated: RetrievalItem = {
    ...item,
    lastResult: result,
    lastAttemptAt: now,
    nextDueAt: nextDueAfter(result, now),
    attemptCount: item.attemptCount + 1,
    attempts: [...item.attempts, { at: now, result, ...(sessionId ? { sessionId } : {}) }].slice(-50),
  };
  const next: PlannerState = { ...state, retrievalItems: { ...state.retrievalItems, [itemId]: updated } };
  return logEvent(next, ids, now, 'retrievalCompleted', { courseId: item.courseId, assignmentId: item.assignmentId, data: { result, type: item.type } });
}

/**
 * Finish the post-session offer. A brain dump is saved as a free-recall item
 * (the student's own words stay on this device); "Not now" just closes it.
 * The offer is made once per session either way.
 */
export function completeRetrievalOffer(
  state: PlannerState,
  outcome: { kind: 'brainDump'; notes?: string; result: RetrievalResult } | { kind: 'question'; prompt: string; answer?: string; result?: RetrievalResult } | { kind: 'skip' },
  now: Timestamp,
  ids: IdGen,
): PlannerState {
  const pending = state.pendingRetrieval;
  if (!pending) return state;
  const session = state.studySessions[pending.studySessionId];
  let next: PlannerState = { ...state, pendingRetrieval: null };
  if (!session) return next;
  const base = { courseId: session.courseId, assignmentId: session.assignmentId, sourceSessionId: session.id };
  if (outcome.kind === 'skip') return logEvent(next, ids, now, 'retrievalSkipped', { courseId: session.courseId, assignmentId: session.assignmentId, sessionId: session.id });
  if (outcome.kind === 'brainDump') {
    const assignment = session.assignmentId ? state.assignments[session.assignmentId] : undefined;
    next = addRetrievalItem(next, { type: 'freeRecall', prompt: `What do I remember about ${assignment?.title ?? 'this session'}?`, answer: outcome.notes, ...base }, now, ids, outcome.result).state;
  } else {
    next = addRetrievalItem(next, { type: 'questionAnswer', prompt: outcome.prompt, answer: outcome.answer, ...base }, now, ids, outcome.result).state;
  }
  return { ...next, studySessions: { ...next.studySessions, [session.id]: { ...session, retrievalCompleted: true } } };
}

export function dueRetrievalItems(state: PlannerState, now: Timestamp): RetrievalItem[] {
  return Object.values(state.retrievalItems)
    .filter((i) => i.nextDueAt !== undefined && i.nextDueAt <= now)
    .sort((a, b) => (a.nextDueAt ?? 0) - (b.nextDueAt ?? 0));
}
