import type { AssignmentType, AvailabilityWindow, PlanType, PlannerPreferences, QuietWindow, RetrievalResult, SupportLevel } from '@/core/models';

/**
 * Studyling planner configuration: every tunable number for import, planning,
 * reminders and retrieval lives here (docs/STUDYLING_PLANNER.md,
 * docs/PLANNER_EVIDENCE.md). Values marked HYPOTHESIS are Studyling's own
 * starting guesses, not established findings.
 */

export const PLANNER_SCHEMA_VERSION = 1;

// ── Parser ──────────────────────────────────────────────────────────

/** Current deterministic, on-device parser. */
export const PARSER_VERSION = 'syllabus-parser-1.0';
/** Older behaviour kept for Syllabus Lab comparison (no table splitting, no recurrence). */
export const PARSER_VERSIONS = [PARSER_VERSION, 'syllabus-parser-0.9'] as const;
export type ParserVersion = (typeof PARSER_VERSIONS)[number];

/** Month/day order for numeric dates like 3/4 when the document doesn't make it obvious. */
export const DEFAULT_NUMERIC_DATE_ORDER: 'MDY' | 'DMY' = 'MDY';

/** Keywords → assignment type, checked in order (first match wins). */
export const TYPE_KEYWORDS: readonly { type: AssignmentType; words: readonly string[] }[] = [
  { type: 'exam', words: ['final exam', 'midterm', 'exam', 'final examination', 'test'] },
  { type: 'quiz', words: ['quiz'] },
  { type: 'paper', words: ['paper', 'essay', 'research report', 'term paper', 'reflection'] },
  { type: 'project', words: ['project', 'capstone', 'portfolio'] },
  { type: 'presentation', words: ['presentation', 'present', 'poster'] },
  { type: 'lab', words: ['lab report', 'lab '] },
  { type: 'reading', words: ['reading', 'read ', 'chapter', 'ch.', 'pp.', 'pages'] },
  { type: 'review', words: ['review session', 'study guide', 'review'] },
  { type: 'assignment', words: ['problem set', 'pset', 'homework', 'hw', 'assignment', 'worksheet', 'exercise', 'response', 'discussion post', 'summary', 'proposal', 'draft', 'module'] },
];

/** Words that make a line an assignment candidate even without a type keyword. */
export const DUE_WORDS: readonly string[] = ['due', 'submit', 'deadline', 'turn in', 'hand in'];

/** Lines that look like dates but are not work (holidays, no class). */
export const NON_WORK_WORDS: readonly string[] = ['no class', 'holiday', 'break', 'recess', 'office hours', 'class cancelled', 'reading day', 'last day to drop', 'add/drop'];

export const VAGUE_TIMING_WORDS: readonly string[] = ['near the end of the term', 'near the end of term', 'end of term', 'end of the term', 'end of semester', 'end of the semester', 'near the end', 'finals week', 'last week of class', 'last week of classes', 'later in the term'];

export const TBA_WORDS: readonly string[] = ['tba', 'tbd', 'to be announced', 'to be determined'];

// ── Effort and planning ─────────────────────────────────────────────

/** Effort choices on the review screen (minutes). "Custom" is free entry. */
export const EFFORT_CHOICES: readonly { label: string; minutes: number }[] = [
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
  { label: '4h+', minutes: 240 },
];

export const SESSION_LENGTH_CHOICES: readonly number[] = [25, 30, 45, 60, 90];

export const PLANNER_RULES = {
  /** Proposed plans start on these minute boundaries. */
  slotGranularityMinutes: 15,
  /** Breathing room between two planned blocks. */
  gapBetweenPlansMinutes: 10,
  /** Shortest block worth proposing. */
  minSessionMinutes: 15,
  /** Finish planned study this long before a deadline. */
  deadlineBufferMinutes: 60,
  /** Planning never looks further ahead than this. */
  horizonDays: 42,
  /**
   * HYPOTHESIS: spread an assignment's blocks across distinct days when there
   * are enough days, rather than one long block. No single interval is claimed
   * to be optimal; spreading is simply even across the available days.
   */
  spreadAcrossDays: true,
  /** At most this many blocks of one assignment on the same day when spreading. */
  maxBlocksPerAssignmentPerDay: 1,
  /**
   * Blocks go in the last few days before a deadline (not weeks early), then
   * spread evenly inside that window: at least `minLeadDays`, plus
   * `leadDaysPerSession` per block. Earlier days are used only if needed.
   */
  minLeadDays: 4,
  leadDaysPerSession: 2,
  /** A plan counts as "missed" this long after its planned start with no session. */
  missedAfterMinutes: 90,
} as const;

export const PLAN_TYPE_FOR: Record<AssignmentType, PlanType> = {
  exam: 'examPrep',
  quiz: 'examPrep',
  reading: 'reading',
  review: 'review',
  paper: 'writing',
  project: 'project',
  lab: 'practice',
  presentation: 'practice',
  assignment: 'practice',
  other: 'learn',
};

export const DEFAULT_AVAILABILITY: readonly AvailabilityWindow[] = [
  { weekday: 1, startMinute: 18 * 60, endMinute: 22 * 60 },
  { weekday: 2, startMinute: 18 * 60, endMinute: 22 * 60 },
  { weekday: 3, startMinute: 18 * 60, endMinute: 22 * 60 },
  { weekday: 4, startMinute: 18 * 60, endMinute: 22 * 60 },
  { weekday: 0, startMinute: 13 * 60, endMinute: 18 * 60 },
];

export const DEFAULT_QUIET_HOURS: QuietWindow = { startMinute: 22 * 60 + 30, endMinute: 7 * 60 + 30 };

export function defaultPreferences(timezone: string): PlannerPreferences {
  return {
    timezone,
    availability: [...DEFAULT_AVAILABILITY],
    preferredSessionMinutes: 45,
    remindersEnabled: false,
    reminderPreference: 'adaptive',
    quietHours: { ...DEFAULT_QUIET_HOURS },
    // Privacy first: lock screen and widgets show "Study session" until the student opts in.
    lockScreenDetail: 'private',
    notificationPermission: 'unknown',
    keepOriginals: false,
  };
}

// ── Reminders ───────────────────────────────────────────────────────

export const REMINDER_RULES = {
  /** Start cues fire this many minutes before a planned start (0 = at start). */
  startCueLeadMinutes: [0] as readonly number[],
  /** Notifications are scheduled only this far ahead (rolling horizon). */
  horizonHours: 72,
  /** A digest is only worth sending when a day has at least this many plans. */
  digestMinPlans: 2,
  /** The digest goes out this long before the day's first plan… */
  digestLeadMinutes: 120,
  /** …but never earlier than this local time. */
  digestEarliestMinute: 8 * 60,
  /** iOS keeps at most 64 pending local notifications per app; stay well under. */
  maxPending: 40,
} as const;

/**
 * REMINDER FADING (EXPERIMENTAL HYPOTHESIS, not a proven intervention).
 * Deterministic: the same observations always give the same level.
 * Bump `version` whenever a threshold changes; the version is stored with
 * the student's progress so later analysis knows which rules applied.
 */
export const REMINDER_FADING_POLICY = {
  version: 'fading-v1',
  /** A start counts as on time within this many minutes after the planned start (or any time before it). */
  onTimeWindowMinutes: 15,
  /** Standard → Light: of the last `window` observed plans, at least `minOnTime` on time and `minIndependent` independent. */
  toLight: { window: 4, minOnTime: 3, minIndependent: 2 },
  /** Light → Ambient: another window after reaching Light, with mostly independent starts. */
  toAmbient: { window: 4, minOnTime: 3, minIndependent: 3 },
  /** Offer (never force) more help when this many of the last `missWindow` plans were missed. */
  missWindow: 3,
  missesForRecoveryOffer: 2,
  /** After "Keep it calm", don't ask again for this long. */
  recoveryQuietDays: 7,
} as const;

export const SUPPORT_LEVEL_COPY: Record<SupportLevel, { title: string; body: string }> = {
  standard: { title: 'Standard', body: 'A short plan for the day when it helps, plus a cue when each block is ready.' },
  light: { title: 'Light', body: 'Just a cue when a block is ready. No daily digest.' },
  ambient: { title: 'Ambient', body: 'No routine reminders. Your plan stays in Studyling and the widget.' },
};

// ── Retrieval ───────────────────────────────────────────────────────

/** Plan types where a quick retrieval check fits (rule, not screen logic). */
export const RETRIEVAL_ELIGIBLE: Record<PlanType, boolean> = {
  learn: true,
  reading: true,
  review: true,
  examPrep: true,
  practice: false,
  writing: false,
  project: false,
  admin: false,
};

export const RETRIEVAL_RULES = {
  /** Sessions shorter than this don't get a retrieval offer. */
  minFocusedMinutes: 10,
  /** V1 fixed follow-up intervals (days) by result. Not a spaced-repetition algorithm. */
  nextDueDays: { got: 4, partly: 2, missed: 1 } as Record<RetrievalResult, number>,
} as const;

// ── Records ─────────────────────────────────────────────────────────

/** Local event log cap (oldest dropped first). */
export const EVENT_LOG_LIMIT = 5000;
