import type { Id, Timestamp } from './common';
import type { ProtectionMode } from './protection';
import type { RetrievalItem } from './retrieval';
import type { ConfidenceLevel, ReviewReason, SourceProvenance, Syllabus, SyllabusSourceType } from './syllabus';

/**
 * Studyling planner records. Normalised (one table per entity, keyed by id)
 * and persisted separately from the pet/game save under `plannerSchemaVersion`.
 * See docs/STUDYLING_PLANNER.md.
 */

// ── Courses and assignments ──────────────────────────────────────────

export interface MeetingTime {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** Minutes after local midnight. */
  startMinute: number;
  endMinute: number;
}

export interface Course {
  id: Id;
  name: string;
  code?: string;
  term?: string;
  /** Secondary cue only: every course also has a text label. */
  color?: string;
  /** IANA zone, e.g. "America/New_York". Due times are interpreted here. */
  timezone: string;
  sourceType: SyllabusSourceType;
  externalId?: string;
  meetingSchedule?: MeetingTime[];
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AssignmentType = 'assignment' | 'exam' | 'quiz' | 'paper' | 'project' | 'reading' | 'lab' | 'presentation' | 'review' | 'other';

export type AssignmentStatus = 'open' | 'completed';

/**
 * `needsReview`: has a field a student must look at before anything is
 * scheduled. `reviewed`: confirmed by the student. `userEntered`: typed by
 * the student. `sourceConflict`: a source changed a field the student edited.
 */
export type AssignmentReviewState = 'needsReview' | 'reviewed' | 'userEntered' | 'sourceConflict';

export type AssignmentField = 'title' | 'type' | 'due' | 'estimate';

/** Where the current value of the source-controlled fields came from (§ source authority). */
export type SourceAuthority = 'parser' | 'syllabus' | 'lms' | 'user';

/** The last values a source reported, kept for reconciliation and conflict display. */
export interface SourceValues {
  title: string;
  type: AssignmentType;
  dueAt: Timestamp | null;
  dueDateOnly: boolean;
}

export interface FieldConflict {
  sourceValue: string;
  detectedAt: Timestamp;
}

export interface Assignment {
  id: Id;
  courseId: Id;
  syllabusId?: Id;
  externalId?: string;
  title: string;
  description?: string;
  type: AssignmentType;
  /** For a date-only due date this is 23:59 local time on that day. */
  dueAt?: Timestamp;
  dueDateOnly?: boolean;
  availableAt?: Timestamp;
  /** Student's own estimate of study effort. Never inferred from titles. */
  estimatedMinutes?: number;
  weight?: number;
  points?: number;
  status: AssignmentStatus;
  reviewState: AssignmentReviewState;
  fieldConfidence: Partial<Record<AssignmentField, ConfidenceLevel>>;
  reviewReasons?: ReviewReason[];
  provenance?: SourceProvenance;
  /** Stable identity across revised imports: hash of normalised title + type + course. */
  sourceFingerprint: string;
  sourceAuthority: SourceAuthority;
  sourceValues?: SourceValues;
  sourceUpdatedAt?: Timestamp;
  /** Fields the student explicitly edited. Sources never overwrite these silently. */
  userOverrides: Partial<Record<AssignmentField, true>>;
  conflicts?: Partial<Record<AssignmentField, FieldConflict>>;
  /** Set when a revised syllabus no longer lists this item (kept, flagged). */
  missingFromSource?: boolean;
  completedAt?: Timestamp;
  /** "I'll handle it" on a capacity note: don't show it again for this deadline. */
  capacityNoteDismissedFor?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
}

// ── Plans ────────────────────────────────────────────────────────────

/** What kind of studying a block is; decides retrieval eligibility (config). */
export type PlanType = 'learn' | 'reading' | 'review' | 'examPrep' | 'practice' | 'writing' | 'project' | 'admin';

export type SessionPlanStatus = 'proposed' | 'accepted' | 'rescheduled' | 'completed' | 'skipped' | 'cancelled';

/** `default` = whatever the student set in Focus protection. */
export type ProtectionProfileId = 'default' | ProtectionMode;

export interface SessionPlan {
  id: Id;
  courseId: Id;
  assignmentId?: Id;
  plannedStartAt: Timestamp;
  plannedMinutes: number;
  planType: PlanType;
  protectionProfileId?: ProtectionProfileId;
  status: SessionPlanStatus;
  createdBy: 'planner' | 'student';
  reminderRuleId?: Id;
  sequenceIndex?: number;
  sequenceCount?: number;
  /** Original start when the plan was moved. */
  rescheduledFrom?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Reminders ────────────────────────────────────────────────────────

export type SupportLevel = 'standard' | 'light' | 'ambient';

export interface QuietWindow {
  /** Minutes after local midnight; the window may wrap past midnight. */
  startMinute: number;
  endMinute: number;
}

export interface ReminderRule {
  id: Id;
  targetType: 'sessionPlan' | 'dailyDigest';
  targetId: Id;
  enabled: boolean;
  supportLevel: SupportLevel;
  /** Minutes before the plan's start. */
  leadTimes: number[];
  digestEligible: boolean;
  quietWindow: QuietWindow;
  batchGroup?: string;
  lastTriggeredAt?: Timestamp;
  successCount: number;
  missCount: number;
  policyVersion: string;
}

/** A local notification the app has asked the OS to deliver (persisted for reload and dedupe). */
export interface ScheduledReminder {
  key: string;
  kind: 'startCue' | 'digest';
  osId: string;
  fireAt: Timestamp;
  planId?: Id;
  planIds?: Id[];
  exposureId: Id;
  /** Hash of the delivered text, so a privacy or title change reschedules it. */
  sig: string;
}

/** One scheduled cue, and whether it was presented. Used for "independent start". */
export interface ReminderExposure {
  id: Id;
  kind: 'startCue' | 'digest';
  planIds: Id[];
  scheduledFor: Timestamp;
  scheduledAt: Timestamp;
  presentedAt?: Timestamp;
  cancelledAt?: Timestamp;
  respondedAt?: Timestamp;
}

export type ReminderPreference = 'always' | 'adaptive' | 'minimal';

export interface SupportObservation {
  planId: Id;
  plannedStartAt: Timestamp;
  started: boolean;
  onTime: boolean;
  independent: boolean;
}

export interface UserProgress {
  /** Adaptive level (the effective level also depends on the student's preference). */
  supportLevel: SupportLevel;
  supportChangedAt: Timestamp;
  /** Plain-language reason for the last change, shown in Reminder settings. */
  supportReason: string;
  policyVersion: string;
  /** Plans already counted toward support, so each is counted once. */
  observedPlanIds: Id[];
  observations: SupportObservation[];
  recoveryOffer: 'none' | 'pending';
  recoveryDismissedAt?: Timestamp;
}

// ── Sessions ─────────────────────────────────────────────────────────

export type StartSource = 'app' | 'planner' | 'notification' | 'widget' | 'liveActivity' | 'manual';

/** How a start relates to its reminder (for future research on independence). */
export type StartContext = 'beforeReminder' | 'notificationAction' | 'afterReminderWithoutAction' | 'widget' | 'plannerOrApp' | 'unscheduled';

export type StudyOutcome = 'completed' | 'endedEarly';

export type ProtectionResult = 'activated' | 'simulated' | 'notRequested' | 'failed' | 'unknown';

/**
 * Study context carried by the canonical FocusSession (the one timer).
 * Written when a session starts; the protection result comes from the
 * protection service, never assumed.
 */
export interface StudyContext {
  courseId?: Id;
  assignmentId?: Id;
  sessionPlanId?: Id;
  plannedStartAt?: Timestamp;
  startSource: StartSource;
  startContext: StartContext;
  reminderExposureId?: Id;
  independentStart: boolean;
  protectionRequested: boolean;
  protectionResult: ProtectionResult;
  protectionMode?: ProtectionMode;
  protectionError?: string;
  planType?: PlanType;
}

/**
 * Durable record of a finished study session (the game save keeps only a
 * bounded focus history). `actualFocusedMinutes` is protected/focused session
 * time, not a measure of concentration.
 */
export interface StudySession {
  id: Id;
  focusSessionId: Id;
  courseId?: Id;
  assignmentId?: Id;
  sessionPlanId?: Id;
  plannedStartAt?: Timestamp;
  actualStartAt: Timestamp;
  endedAt: Timestamp;
  plannedMinutes: number;
  actualFocusedMinutes: number;
  outcome: StudyOutcome;
  protectionRequested: boolean;
  protectionActivated: boolean;
  protectionMode?: ProtectionMode;
  startSource: StartSource;
  startContext: StartContext;
  reminderExposureId?: Id;
  independentStart: boolean;
  focusRating?: 1 | 2 | 3;
  retrievalOffered: boolean;
  retrievalCompleted: boolean;
  planType?: PlanType;
}

// ── Events (local only, never sent anywhere) ─────────────────────────

export type PlannerEventType =
  | 'planCreated'
  | 'planAccepted'
  | 'planRescheduled'
  | 'planSkipped'
  | 'planCancelled'
  | 'reminderScheduled'
  | 'reminderCancelled'
  | 'reminderPresented'
  | 'notificationStartAction'
  | 'sessionStarted'
  | 'protectionRequested'
  | 'protectionActivated'
  | 'protectionFailed'
  | 'sessionCompleted'
  | 'sessionEndedEarly'
  | 'retrievalOffered'
  | 'retrievalCompleted'
  | 'retrievalSkipped'
  | 'assignmentCompleted'
  | 'sourceUpdated'
  | 'supportLevelChanged';

export interface PlannerEvent {
  id: Id;
  at: Timestamp;
  type: PlannerEventType;
  courseId?: Id;
  assignmentId?: Id;
  planId?: Id;
  sessionId?: Id;
  /** Small, non-textual facts only (no titles, notes or syllabus text). */
  data?: Record<string, string | number | boolean>;
}

// ── Preferences ──────────────────────────────────────────────────────

export interface AvailabilityWindow {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export type LockScreenDetail = 'private' | 'detailed';

export type NotificationPermission = 'unknown' | 'granted' | 'denied';

export interface PlannerPreferences {
  timezone: string;
  availability: AvailabilityWindow[];
  preferredSessionMinutes: number;
  remindersEnabled: boolean;
  reminderPreference: ReminderPreference;
  quietHours: QuietWindow;
  lockScreenDetail: LockScreenDetail;
  notificationPermission: NotificationPermission;
  /** Keep imported originals on this device (explicit opt-in; default off). */
  keepOriginals: boolean;
}

// ── The persisted planner document ───────────────────────────────────

export interface PendingRetrieval {
  studySessionId: Id;
  offeredAt: Timestamp;
}

export interface PlannerState {
  plannerSchemaVersion: number;
  courses: Record<Id, Course>;
  assignments: Record<Id, Assignment>;
  syllabi: Record<Id, Syllabus>;
  plans: Record<Id, SessionPlan>;
  reminderRules: Record<Id, ReminderRule>;
  scheduledReminders: Record<string, ScheduledReminder>;
  exposures: Record<Id, ReminderExposure>;
  studySessions: Record<Id, StudySession>;
  retrievalItems: Record<Id, RetrievalItem>;
  events: PlannerEvent[];
  progress: UserProgress;
  preferences: PlannerPreferences;
  /** Only present when the student turned on "Keep original locally". */
  originals: Record<Id, string>;
  pendingRetrieval: PendingRetrieval | null;
}
