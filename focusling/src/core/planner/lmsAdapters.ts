import type { Assignment, AssignmentType, Id, PlannerState, SourceValues, Timestamp } from '../models';
import { logEvent, type IdGen } from './plannerState';
import { applySourceUpdate } from './sourceAuthority';
import { cancelPlansFor, fingerprintOf } from './syllabusImport';
import { normalizeTitle } from './syllabusParser';

/**
 * LMS adapter boundary (Google Classroom, Canvas). INTERFACES AND FIXTURES
 * ONLY: there is no OAuth and no network code in this build, and the UI never
 * says a platform is connected. See docs/STUDYLING_PLANNER.md §11.
 *
 * Google Classroom (future): read-only student scopes only
 * (courses.readonly, coursework.me.readonly); no roster, grading or teacher
 * permissions. Canvas (future): per-institution URL + developer key, OAuth2
 * with scoped endpoints (courses, assignments, calendar events); never
 * manually generated personal tokens as the consumer design.
 */
export interface LmsCourse {
  externalId: string;
  name: string;
  code?: string;
  term?: string;
}

export interface LmsCoursework {
  externalId: string;
  courseExternalId: string;
  title: string;
  type?: AssignmentType;
  /** Absolute instant when the LMS gives a time; date-only otherwise. */
  dueAt?: Timestamp;
  dueDateOnly?: boolean;
  /** Only published work is listed. */
  state: 'published';
  updatedAt: Timestamp;
}

export interface LmsAdapter {
  readonly kind: 'googleClassroom' | 'canvas';
  /** Whether a real connection exists. Always false in this build. */
  readonly connected: boolean;
  listCourses(): Promise<LmsCourse[]>;
  listCoursework(courseExternalId: string): Promise<LmsCoursework[]>;
}

/** Test/dev adapter that replays fixture data. */
export class FixtureLmsAdapter implements LmsAdapter {
  readonly connected = false;
  constructor(
    readonly kind: 'googleClassroom' | 'canvas',
    private courses: LmsCourse[],
    private work: LmsCoursework[],
  ) {}
  async listCourses() {
    return this.courses;
  }
  async listCoursework(courseExternalId: string) {
    return this.work.filter((w) => w.courseExternalId === courseExternalId && w.state === 'published');
  }
  replace(work: LmsCoursework[]) {
    this.work = work;
  }
}

export interface LmsReconcileResult {
  state: PlannerState;
  created: Id[];
  updated: Id[];
  conflicts: Id[];
  cancelledPlanIds: Id[];
}

/**
 * Apply LMS coursework to a course. Matches by external id (never duplicates),
 * applies LMS authority (over syllabus values), and turns differences from
 * student edits into visible conflicts instead of overwriting them.
 */
export function reconcileLmsCoursework(state: PlannerState, courseId: Id, items: LmsCoursework[], now: Timestamp, ids: IdGen): LmsReconcileResult {
  const course = state.courses[courseId];
  const res: Omit<LmsReconcileResult, 'state'> = { created: [], updated: [], conflicts: [], cancelledPlanIds: [] };
  if (!course) return { state, ...res };
  let next: PlannerState = { ...state, assignments: { ...state.assignments }, plans: { ...state.plans } };
  for (const w of items) {
    const incoming: SourceValues = { title: w.title, type: w.type ?? 'assignment', dueAt: w.dueAt ?? null, dueDateOnly: w.dueDateOnly ?? false };
    const existing = Object.values(next.assignments).find((a) => a.courseId === courseId && !a.deletedAt && a.externalId === w.externalId);
    if (existing) {
      const upd = applySourceUpdate(existing, incoming, 'lms', now);
      if (upd.ignored) continue;
      next.assignments[existing.id] = { ...upd.assignment, sourceUpdatedAt: w.updatedAt };
      if (upd.changedFields.length) res.updated.push(existing.id);
      if (upd.conflictFields.length) res.conflicts.push(existing.id);
      if (upd.changedFields.includes('due')) res.cancelledPlanIds.push(...cancelPlansFor(next, existing.id, upd.assignment.dueAt ?? null, now));
      if (upd.changedFields.length || upd.conflictFields.length) next = logEvent(next, ids, now, 'sourceUpdated', { courseId, assignmentId: existing.id, data: { source: 'lms', fields: upd.changedFields.join(',') } });
      continue;
    }
    const id = ids('assignment');
    const a: Assignment = {
      id,
      courseId,
      externalId: w.externalId,
      title: w.title,
      type: incoming.type,
      dueAt: w.dueAt,
      dueDateOnly: w.dueAt ? incoming.dueDateOnly : undefined,
      status: 'open',
      // An LMS date is structured data, but the student still confirms what it means for them.
      reviewState: w.dueAt ? 'reviewed' : 'needsReview',
      fieldConfidence: { title: 'confirmed', type: w.type ? 'confirmed' : 'needsReview', due: w.dueAt ? 'confirmed' : 'needsReview' },
      sourceFingerprint: fingerprintOf(normalizeTitle(course.code ?? course.name), normalizeTitle(w.title)),
      sourceAuthority: 'lms',
      sourceValues: incoming,
      sourceUpdatedAt: w.updatedAt,
      userOverrides: {},
      createdAt: now,
      updatedAt: now,
    };
    next.assignments[id] = a;
    res.created.push(id);
  }
  return { state: next, ...res };
}

// Synthetic fixtures (no real school data).
export const CLASSROOM_FIXTURE: { courses: LmsCourse[]; work: LmsCoursework[] } = {
  courses: [{ externalId: 'gc-course-1', name: 'Biology 9 (synthetic)', code: 'BIO 9' }],
  work: [
    { externalId: 'gc-work-1', courseExternalId: 'gc-course-1', title: 'Cell diagram', type: 'assignment', dueAt: Date.UTC(2026, 9, 2, 3, 59), state: 'published', updatedAt: Date.UTC(2026, 8, 20) },
    { externalId: 'gc-work-2', courseExternalId: 'gc-course-1', title: 'Unit 1 quiz', type: 'quiz', dueAt: Date.UTC(2026, 9, 6, 14, 0), state: 'published', updatedAt: Date.UTC(2026, 8, 20) },
  ],
};

export const CANVAS_FIXTURE: { courses: LmsCourse[]; work: LmsCoursework[] } = {
  courses: [{ externalId: 'cv-101', name: 'Statistics (synthetic)', code: 'STAT 101', term: 'Fall 2026' }],
  work: [
    { externalId: 'cv-a-1', courseExternalId: 'cv-101', title: 'Homework 1', type: 'assignment', dueAt: Date.UTC(2026, 8, 25, 3, 59), state: 'published', updatedAt: Date.UTC(2026, 8, 1) },
    { externalId: 'cv-a-2', courseExternalId: 'cv-101', title: 'Midterm', type: 'exam', dueAt: Date.UTC(2026, 9, 15, 16, 0), state: 'published', updatedAt: Date.UTC(2026, 8, 1) },
  ],
};
