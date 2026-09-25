/** Session-length options and limits for the focus screen. */
export const FOCUS_CONFIG = {
  presetDurationsMinutes: [15, 30, 45, 60] as const,
  defaultMinutes: 30,
  /** Custom-duration stepper increment. */
  customStepMinutes: 5,
  minCustomMinutes: 5,
  maxCustomMinutes: 180,
  /** Finished sessions kept in history. */
  historyLimit: 50,
  /** Days of daily stats kept. */
  dailyStatsRetentionDays: 60,
} as const;

/** Day-streak rules. Deliberately forgiving. */
export const STREAK_CONFIG = {
  /** A freeze is earned every N consecutive days. */
  freezeEveryDays: 7,
  maxFreezes: 2,
  /** New players start with one, so the very first missed day is forgiven. */
  startingFreezes: 1,
} as const;
