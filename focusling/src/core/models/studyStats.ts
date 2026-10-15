import type { DateKey, Id, Timestamp } from './common';
import type { GrowthStage } from './pet';

/**
 * Stats & Journey models (docs/STATS_AND_JOURNEY.md). Everything here is
 * derived from records the app already keeps (the planner's StudySession
 * ledger plus the game's recent focus history); nothing is estimated or
 * back-filled. Minutes are "focus time" (time inside a focus session), never
 * a measure of concentration.
 */

/** A finished focus session as Stats sees it. One per FocusSession id. */
export type SessionRecordStatus = 'completed' | 'endedEarly';

export interface FocusSessionRecord {
  /** The FocusSession id (stable; used to de-duplicate sources). */
  id: Id;
  startedAt: Timestamp;
  /**
   * startedAt + recordedMinutes. Not the stored `endedAt`, which for a
   * session that finished while the app was closed is the reopen time.
   */
  endedAt: Timestamp;
  /** Credited minutes, capped by real elapsed time (see recordedMinutesFor). */
  recordedMinutes: number;
  plannedMinutes: number;
  status: SessionRecordStatus;
  courseId?: Id;
  assignmentId?: Id;
  /** Started from an accepted planner block. */
  fromPlan: boolean;
  /** Where this record came from. Planner records win when both exist. */
  source: 'planner' | 'focusHistory';
  /** Growth stage this session's reward reached (game history only). */
  stageReached?: GrowthStage | null;
}

/** An academic task (planner assignment) the student marked complete. */
export interface TaskCompletionRecord {
  assignmentId: Id;
  courseId: Id;
  completedAt: Timestamp;
}

export interface DailyStudySummary {
  date: DateKey;
  /** Focus minutes that fell on this local calendar day (sessions are split at midnight). */
  focusMinutes: number;
  /** Sessions that ended on this day. */
  sessionsCompleted: number;
  sessionsEndedEarly: number;
  tasksCompleted: number;
}

export interface CourseStudySummary {
  /** null = focus time not linked to a course ("Unassigned"). */
  courseId: Id | null;
  focusMinutes: number;
  sessionsCompleted: number;
  tasksCompleted: number;
}

export interface WeekSummary {
  /** First day of the week (local). */
  start: DateKey;
  days: DailyStudySummary[];
  focusMinutes: number;
  sessionsCompleted: number;
  sessionsEndedEarly: number;
  tasksCompleted: number;
  daysStudied: number;
}

export interface StudyStatsSnapshot {
  timezone: string;
  today: DailyStudySummary;
  week: WeekSummary;
  /** Days with any focus time in the last N days (N from config); not a streak. */
  consistency: { daysStudied: number; windowDays: number };
  courses: CourseStudySummary[];
  totals: { focusMinutes: number; sessionsCompleted: number; sessionsEndedEarly: number; tasksCompleted: number };
  /** Earliest record Stats can see (null when there are none). */
  recordsSince: Timestamp | null;
  /** True when the game counted more completed sessions than records exist (older history not kept in detail). */
  hasOlderUntrackedHistory: boolean;
}

// ── Journey ──────────────────────────────────────────────────────────

export type JourneyMilestoneKind =
  | 'firstSession'
  | 'sessions'
  | 'focusHours'
  | 'firstTask'
  | 'tasks'
  | 'firstCourse'
  | 'firstSyllabus'
  | 'firstPlannedSession'
  | 'firstIndependentStart'
  | 'firstRetrieval'
  | 'petStage'
  | 'courseFirstSession'
  | 'firstSyllabusTaskDone'
  | 'firstTaskSession'
  | 'firstExamPrep';

/** A milestone the student reached. Stored once; never removed or re-awarded. */
export interface JourneyMilestone {
  /** Stable key, e.g. `sessions:10`, `petStage:young`, `courseFirstSession:<courseId>`. */
  id: string;
  kind: JourneyMilestoneKind;
  /**
   * When it happened, from a real record. null when it happened before the
   * app kept detailed records (shown as "Before Journey began"), never guessed.
   */
  achievedAt: Timestamp | null;
  /** When the app noticed and stored it. */
  recordedAt: Timestamp;
  threshold?: number;
  courseId?: Id;
  stage?: GrowthStage;
}

export interface JourneyState {
  /** When Journey started tracking on this device. */
  startedAt: Timestamp;
  milestones: Record<string, JourneyMilestone>;
  /** Pet XP at the last evaluation, so a growth stage reached later can be dated when it happens. */
  petXpSeen: number | null;
}
