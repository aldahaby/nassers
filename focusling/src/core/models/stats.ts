import type { DateKey } from './common';

export interface DailyStats {
  date: DateKey;
  focusMinutes: number;
  sessionsCompleted: number;
  sessionsAbandoned: number;
  coinsEarned: number;
  xpEarned: number;
}

export interface LifetimeStats {
  sessionsCompleted: number;
  sessionsAbandoned: number;
  totalFocusMinutes: number;
  lifetimeCoinsEarned: number;
  longestSessionMinutes: number;
}

export interface StreakState {
  /** Consecutive days with at least one completed session. */
  currentDays: number;
  bestDays: number;
  lastActiveDate: DateKey | null;
  /** Freezes silently cover missed days so one busy day doesn't wipe a streak. */
  freezesAvailable: number;
  /** Consecutive completed sessions; abandoning resets only this. */
  currentSessionStreak: number;
  bestSessionStreak: number;
}
