/**
 * Trial lengths (docs/PREMIUM_ARCHITECTURE.md). Display copy only: the
 * server decides eligibility, activates a trial once, and reports its expiry.
 * The client never grants a trial from these numbers.
 */
export const TRIAL_CONFIG = {
  /** A verified email at an approved institution. */
  studentTrialDays: 30,
  /** Everyone else. */
  standardTrialDays: 14,
} as const;

/** Client-side limits that mirror (never replace) the server's own limits, for calm UI copy. */
export const VERIFICATION_UI = {
  codeLength: 6,
} as const;
