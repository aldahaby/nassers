import type { Id, Timestamp } from './common';

/**
 * Syllabus import records (docs/STUDYLING_PLANNER.md §2). Only structured
 * results are persisted; raw text lives in memory during review and is
 * discarded on commit unless the student explicitly keeps the original.
 */
export type SyllabusSourceType = 'pdf' | 'emailText' | 'manual' | 'googleClassroom' | 'canvas';

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
  | 'recurringRange';

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
  extraction?: 'embeddedText' | 'ocr' | 'mixed' | 'pastedText';
}
