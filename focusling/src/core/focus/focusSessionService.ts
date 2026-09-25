import { FOCUS_CONFIG } from '@/config/focus';
import { MINUTE_MS } from '../shared/dates';
import { createId } from '../shared/ids';
import { fail, ok, type Result } from '../shared/result';
import type { BlockTarget, FocusSession, Timestamp } from '../models';

export type FocusError = 'invalid-duration' | 'session-already-active' | 'no-active-session' | 'no-pet';

export function isValidDuration(minutes: number): boolean {
  return (
    Number.isInteger(minutes) && minutes >= FOCUS_CONFIG.minCustomMinutes && minutes <= FOCUS_CONFIG.maxCustomMinutes
  );
}

export function createFocusSession(
  plannedDurationMinutes: number,
  blockedTargets: BlockTarget[],
  now: Timestamp,
): Result<FocusSession, FocusError> {
  if (!isValidDuration(plannedDurationMinutes)) return fail('invalid-duration');
  return ok({
    id: createId('session'),
    plannedDurationMinutes,
    startedAt: now,
    endedAt: null,
    status: 'active',
    blockedTargets,
    reward: null,
  });
}

/**
 * Timing is derived from `startedAt` and the wall clock rather than a ticking
 * counter, so a session survives the app being backgrounded or killed.
 */
export function getEndsAt(session: FocusSession): Timestamp {
  return session.startedAt + session.plannedDurationMinutes * MINUTE_MS;
}

export function getRemainingMs(session: FocusSession, now: Timestamp): number {
  return Math.max(0, getEndsAt(session) - now);
}

export function getElapsedMinutes(session: FocusSession, now: Timestamp): number {
  const elapsed = Math.min(now, getEndsAt(session)) - session.startedAt;
  return Math.max(0, Math.floor(elapsed / MINUTE_MS));
}

export function isSessionDue(session: FocusSession, now: Timestamp): boolean {
  return session.status === 'active' && now >= getEndsAt(session);
}

export function getProgressFraction(session: FocusSession, now: Timestamp): number {
  const total = session.plannedDurationMinutes * MINUTE_MS;
  return Math.min(1, Math.max(0, (now - session.startedAt) / total));
}
