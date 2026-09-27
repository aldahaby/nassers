/** Local parent gate settings. See docs/FAMILY_MODE.md. */
export const PARENT_GATE = {
  pinLength: 4,
  /** SHA-256 rounds. Slows guessing a little; throttling is the real protection. */
  hashIterations: 2000,
  /** Wrong attempts allowed before a pause. */
  freeAttempts: 5,
  /** First pause length; doubles for each further wrong attempt, up to the max. */
  lockoutMs: 30_000,
  maxLockoutMs: 5 * 60_000,
} as const;

export const CHILD_NICKNAME_MAX_LENGTH = 16;
