/** Stats tunables (docs/STATS_AND_JOURNEY.md). */
export const STATS_CONFIG = {
  /** 0 = Sunday, 1 = Monday. Weeks in Stats start on this day (local time). */
  weekStartsOn: 1,
  /** "Days studied in the last N days" (consistency; not a streak). */
  consistencyWindowDays: 7,
  /** Recent sessions shown before "Show more". */
  historyPageSize: 10,
  /** Weekly totals shown in Progress over time (Free). */
  trendWeeks: 4,
  /** Longer range for the extended-stats capability (Premium, later). */
  extendedTrendWeeks: 12,
  /** A session shorter than this (after capping to real elapsed time) adds no focus time. */
  minRecordedMinutes: 1,
} as const;
