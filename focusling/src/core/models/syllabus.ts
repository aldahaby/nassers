import type { Id, Timestamp } from './common';

/**
 * Syllabus import records (docs/STUDYLING_PLANNER.md §2). Only structured
 * results are persisted; raw text lives in memory during review and is
 * discarded on commit unless the student explicitly keeps the original.
 */
export type SyllabusSourceType = 'pdf' | 'docx' | 'image' | 'emailText' | 'manual' | 'googleClassroom' | 'canvas';

export type ParseStatus = 'extracting' | 'parsed' | 'reviewed' | 'failed';

/**
 * The three human-readable trust states. Parsers never produce `confirmed`:
 * a field becomes confirmed only when a student reviews it (or types it).
 */
export type ConfidenceLevel = 'confirmed' | 'likely' | 'needsReview';

/** Why a field needs a second look (internal; the UI turns these into plain words). */
export type ReviewReason =
  | 'ambiguousWeek'
  | 'missingYear'
  | 'tba'
  | 'vagueTiming'
  | 'conflictingDates'
  | 'ocrDamage'
  | 'noDate'
  | 'typeUnknown'
  | 'timeAmbiguous'
  | 'numericDateOrder'
  | 'recurringRange'
  | 'tentative'
  | 'examPeriod'
  | 'timeZoneStated';

/**
 * How Studyling knows a value (shown to the student):
 * - stated: written in the syllabus;
 * - inferred: worked out from context (e.g. the year from "Fall 2026"), with a note saying how.
 */
export type FieldOrigin = 'stated' | 'inferred';

/** Something worked out rather than read, and how (shown as "Inferred from context"). */
export interface Inference {
  field: 'year' | 'week' | 'course';
  note: string;
}

export type RawTextRetention = 'discarded' | 'keptLocally';

/** Where in the source an item came from. No source text is stored. */
export interface SourceProvenance {
  page: number | null;
  line: number;
  /** Table row/cell or list section label, when the layout gave one. */
  section?: string;
}

export interface Syllabus {
  id: Id;
  courseId: Id;
  sourceType: SyllabusSourceType;
  sourceExternalId?: string;
  filename?: string;
  /** SHA-256 of the normalised text (not of the file bytes). */
  contentHash: string;
  importedAt: Timestamp;
  parserVersion: string;
  parseStatus: ParseStatus;
  overallConfidence: ConfidenceLevel;
  rawTextRetention: RawTextRetention;
  /** 1 for the first import of this course's syllabus; +1 for each revised import. */
  revision: number;
  lastSyncAt?: Timestamp;
  itemCount: number;
  extraction?: 'embeddedText' | 'ocr' | 'mixed' | 'pastedText' | 'docx';
}

// ── Course insights (Syllabus Intelligence 2.0) ─────────────────────

export type TermSeason = 'fall' | 'winter' | 'spring' | 'summer';

/** Normalised course identity (also the basis for future Course Spaces; never shared). */
export interface CourseIdentity {
  institution: string | null;
  /** "COMP 202" style, normalised to SUBJECT NUMBER. */
  code: string | null;
  subject: string | null;
  number: string | null;
  title: string | null;
  term: { season: TermSeason; year: number } | null;
  section: string | null;
}

export interface CoursePerson {
  role: 'instructor' | 'ta';
  name: string;
  /** Only kept if the student chooses to save contact details. */
  email?: string;
  provenance: SourceProvenance;
}

export interface OfficeHoursEntry {
  /** Whose office hours, when the line says. */
  who: string | null;
  meetings: { weekday: number; startMinute: number | null; endMinute: number | null }[];
  /** Short location/description when given (no sentences). */
  where: string | null;
  provenance: SourceProvenance;
}

export interface ClassMeeting {
  kind: 'lecture' | 'lab' | 'tutorial' | 'seminar' | 'class';
  weekday: number;
  startMinute: number | null;
  endMinute: number | null;
  provenance: SourceProvenance;
}

export interface GradingComponent {
  name: string;
  /** Percent of the final grade, as written. */
  weightPercent: number;
  /** "4 × 5%" style: how many items share the weight, when stated. */
  count?: number;
  provenance: SourceProvenance;
}

export interface GradingBreakdown {
  components: GradingComponent[];
  totalPercent: number;
  /** False when the components don't add up to 100% (shown, never "fixed"). */
  addsUp: boolean;
}

export interface ScheduleWeek {
  week: number;
  /** First day of that week, when the schedule gives a date. */
  startDayKey: string | null;
  topic: string;
  readings: string | null;
  provenance: SourceProvenance;
}

/** An explicit "X covers Y" statement. Never inferred. */
export interface CoverageRelation {
  /** Normalised title of the assessment it describes. */
  itemKey: string;
  itemTitle: string;
  weeks: { from: number; to: number } | null;
  chapters: string | null;
  provenance: SourceProvenance;
}

export interface KeyDate {
  label: string;
  dayKey: string | null;
  kind: 'drop' | 'withdraw' | 'noClass' | 'other';
  provenance: SourceProvenance;
}

export interface PolicyRef {
  /** Heading only, e.g. "Late submission policy". No policy text is stored. */
  title: string;
  provenance: SourceProvenance;
}

export interface SyllabusInsights {
  identity: CourseIdentity;
  people: CoursePerson[];
  officeHours: OfficeHoursEntry[];
  meetings: ClassMeeting[];
  grading: GradingBreakdown | null;
  schedule: ScheduleWeek[];
  coverage: CoverageRelation[];
  keyDates: KeyDate[];
  policies: PolicyRef[];
}

/** What a course keeps from its syllabus after review (local only). */
export interface CourseDetails extends SyllabusInsights {
  fromSyllabusId: Id | null;
  reviewedAt: Timestamp;
}
