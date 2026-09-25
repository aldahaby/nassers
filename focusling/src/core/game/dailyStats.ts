import { FOCUS_CONFIG } from '@/config/focus';
import { daysBetween } from '../shared/dates';
import type { DailyStats, DateKey } from '../models';

export function emptyDailyStats(date: DateKey): DailyStats {
  return { date, focusMinutes: 0, sessionsCompleted: 0, sessionsAbandoned: 0, coinsEarned: 0, xpEarned: 0 };
}

/** Drop days older than the retention window. */
export function pruneDailyStats(daily: Record<string, DailyStats>, today: DateKey): Record<string, DailyStats> {
  const kept: Record<string, DailyStats> = {};
  for (const [key, value] of Object.entries(daily)) {
    if (daysBetween(key, today) < FOCUS_CONFIG.dailyStatsRetentionDays) kept[key] = value;
  }
  return kept;
}
