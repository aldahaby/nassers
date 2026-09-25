import { STREAK_CONFIG } from '@/config/focus';
import { daysBetween } from '../shared/dates';
import type { DateKey, FocusOutcome, StreakState } from '../models';

export function createStreakState(): StreakState {
  return {
    currentDays: 0,
    bestDays: 0,
    lastActiveDate: null,
    freezesAvailable: STREAK_CONFIG.startingFreezes,
    currentSessionStreak: 0,
    bestSessionStreak: 0,
  };
}

/** Days missed between the last active day and `today` (0 if active today or yesterday). */
function missedDays(streak: StreakState, today: DateKey): number {
  if (!streak.lastActiveDate) return 0;
  return Math.max(0, daysBetween(streak.lastActiveDate, today) - 1);
}

/**
 * The streak to show today. A streak survives as long as the missed days can be
 * covered by freezes; otherwise it reads 0 (the saved record is untouched until
 * the next completed session, and `bestDays` is always kept).
 */
export function getEffectiveStreakDays(streak: StreakState, today: DateKey): number {
  if (streak.currentDays === 0 || !streak.lastActiveDate) return 0;
  return missedDays(streak, today) <= streak.freezesAvailable ? streak.currentDays : 0;
}

/** Update streaks after a session ends on `today`. */
export function recordSessionForStreak(streak: StreakState, outcome: FocusOutcome, today: DateKey): StreakState {
  if (outcome === 'abandoned') {
    // Only the session streak resets. Day streaks are about showing up, not perfection.
    return { ...streak, currentSessionStreak: 0 };
  }

  const sessionStreak = streak.currentSessionStreak + 1;
  const base = {
    ...streak,
    currentSessionStreak: sessionStreak,
    bestSessionStreak: Math.max(streak.bestSessionStreak, sessionStreak),
  };

  if (streak.lastActiveDate === today) return base;

  let days: number;
  let freezes = streak.freezesAvailable;
  const missed = missedDays(streak, today);

  if (!streak.lastActiveDate || streak.currentDays === 0) {
    days = 1;
  } else if (missed === 0) {
    days = streak.currentDays + 1;
  } else if (missed <= freezes) {
    freezes -= missed;
    days = streak.currentDays + 1;
  } else {
    days = 1;
  }

  if (days % STREAK_CONFIG.freezeEveryDays === 0) {
    freezes = Math.min(STREAK_CONFIG.maxFreezes, freezes + 1);
  }

  return {
    ...base,
    currentDays: days,
    bestDays: Math.max(streak.bestDays, days),
    lastActiveDate: today,
    freezesAvailable: freezes,
  };
}
