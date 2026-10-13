import { STATS_CONFIG } from '@/config/stats';
import type { FocusSession, FocusSessionRecord, PlannerState, TaskCompletionRecord, Timestamp } from '../models';

/**
 * Minutes Stats counts for a session: what the session credited, capped by
 * the real time between start and end. This keeps a developer "complete now"
 * or any clock oddity from inventing focus time; a session that finished while
 * the app was closed still counts its full planned length (elapsed ≥ planned).
 */
export function recordedMinutesFor(creditedMinutes: number, startedAt: Timestamp, endedAt: Timestamp): number {
  const elapsed = Math.floor(Math.max(0, endedAt - startedAt) / 60_000);
  const minutes = Math.max(0, Math.min(Math.floor(creditedMinutes), elapsed));
  return minutes < STATS_CONFIG.minRecordedMinutes ? 0 : minutes;
}

const byStart = (a: FocusSessionRecord, b: FocusSessionRecord) => a.startedAt - b.startedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * One record per finished focus session, oldest first. The planner's
 * StudySession ledger is durable and wins; the game's recent history (the
 * last FOCUS_CONFIG.historyLimit sessions) fills in sessions from before the
 * planner existed. A FocusSession id never appears twice. Active sessions are
 * not records.
 */
export function buildSessionRecords(planner: PlannerState | null, history: readonly FocusSession[]): FocusSessionRecord[] {
  const out = new Map<string, FocusSessionRecord>();
  const stageById = new Map<string, FocusSession>();
  for (const f of history) if (!stageById.has(f.id)) stageById.set(f.id, f);

  if (planner) {
    const sessions = Object.values(planner.studySessions).sort((a, b) => a.actualStartAt - b.actualStartAt || (a.id < b.id ? -1 : 1));
    for (const s of sessions) {
      if (out.has(s.focusSessionId)) continue;
      const minutes = recordedMinutesFor(s.actualFocusedMinutes, s.actualStartAt, s.endedAt);
      out.set(s.focusSessionId, {
        id: s.focusSessionId,
        startedAt: s.actualStartAt,
        endedAt: s.actualStartAt + minutes * 60_000,
        recordedMinutes: minutes,
        plannedMinutes: s.plannedMinutes,
        status: s.outcome === 'completed' ? 'completed' : 'endedEarly',
        courseId: s.courseId,
        assignmentId: s.assignmentId,
        fromPlan: !!s.sessionPlanId,
        source: 'planner',
        stageReached: stageById.get(s.focusSessionId)?.reward?.stageReached ?? null,
      });
    }
  }

  for (const f of stageById.values()) {
    if (out.has(f.id) || f.status === 'active' || f.endedAt == null) continue;
    const credited = f.reward?.focusedMinutes ?? Math.floor((f.endedAt - f.startedAt) / 60_000);
    const minutes = recordedMinutesFor(credited, f.startedAt, f.endedAt);
    out.set(f.id, {
      id: f.id,
      startedAt: f.startedAt,
      endedAt: f.startedAt + minutes * 60_000,
      recordedMinutes: minutes,
      plannedMinutes: f.plannedDurationMinutes,
      status: f.status === 'completed' ? 'completed' : 'endedEarly',
      courseId: f.study?.courseId,
      assignmentId: f.study?.assignmentId,
      fromPlan: !!f.study?.sessionPlanId,
      source: 'focusHistory',
      stageReached: f.reward?.stageReached ?? null,
    });
  }

  return [...out.values()].sort(byStart);
}

/** Minutes the session credited (before capping); used only to compare with lifetime counters. */
export function creditedMinutesOf(planner: PlannerState | null, history: readonly FocusSession[], recordIds: readonly string[]): number {
  const ids = new Set(recordIds);
  const seen = new Set<string>();
  let total = 0;
  if (planner) {
    for (const s of Object.values(planner.studySessions)) {
      if (!ids.has(s.focusSessionId) || seen.has(s.focusSessionId)) continue;
      seen.add(s.focusSessionId);
      total += Math.max(0, s.actualFocusedMinutes);
    }
  }
  for (const f of history) {
    if (!ids.has(f.id) || seen.has(f.id) || f.status === 'active') continue;
    seen.add(f.id);
    total += Math.max(0, f.reward?.focusedMinutes ?? 0);
  }
  return total;
}

/** Completed planner tasks (assignments), oldest first. Deleted or reopened tasks don't count. */
export function taskCompletions(planner: PlannerState | null): TaskCompletionRecord[] {
  if (!planner) return [];
  return Object.values(planner.assignments)
    .filter((a) => a.status === 'completed' && a.completedAt != null && !a.deletedAt)
    .map((a) => ({ assignmentId: a.id, courseId: a.courseId, completedAt: a.completedAt! }))
    .sort((a, b) => a.completedAt - b.completedAt || (a.assignmentId < b.assignmentId ? -1 : 1));
}
