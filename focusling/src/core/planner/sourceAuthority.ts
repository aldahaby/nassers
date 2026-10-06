import type { Assignment, AssignmentField, AssignmentType, SourceAuthority, SourceValues, Timestamp } from '../models';

/**
 * Source authority (docs/STUDYLING_PLANNER.md §5):
 *   USER OVERRIDE > LIVE LMS VALUE > REVIEWED STATIC SYLLABUS > UNREVIEWED PARSER SUGGESTION
 * A source never silently overwrites a field the student edited; a
 * difference becomes a visible conflict instead.
 */
export const AUTHORITY_RANK: Record<SourceAuthority, number> = { parser: 0, syllabus: 1, lms: 2, user: 3 };

const FIELDS: readonly (AssignmentField & keyof SourceValues)[] = ['title', 'type'];

function display(field: AssignmentField, v: SourceValues): string {
  if (field === 'title') return v.title;
  if (field === 'type') return v.type;
  return v.dueAt === null ? 'none' : String(v.dueAt);
}

export interface SourceUpdateResult {
  assignment: Assignment;
  changedFields: AssignmentField[];
  conflictFields: AssignmentField[];
  /** True when the incoming source was lower authority than the current one and was ignored. */
  ignored: boolean;
}

/** Apply new values from a source (revised syllabus or LMS) to an existing assignment. */
export function applySourceUpdate(a: Assignment, incoming: SourceValues, authority: Exclude<SourceAuthority, 'user'>, now: Timestamp): SourceUpdateResult {
  const currentRank = a.sourceAuthority === 'user' ? -1 : AUTHORITY_RANK[a.sourceAuthority];
  if (AUTHORITY_RANK[authority] < currentRank) return { assignment: a, changedFields: [], conflictFields: [], ignored: true };

  const previous: SourceValues = a.sourceValues ?? { title: a.title, type: a.type, dueAt: a.dueAt ?? null, dueDateOnly: a.dueDateOnly ?? false };
  const next: Assignment = { ...a, conflicts: { ...(a.conflicts ?? {}) }, fieldConfidence: { ...a.fieldConfidence } };
  const changedFields: AssignmentField[] = [];
  const conflictFields: AssignmentField[] = [];

  const consider = (field: AssignmentField, differs: boolean, apply: () => void, sameAsShown: boolean) => {
    if (!differs) return;
    if (a.userOverrides[field]) {
      if (sameAsShown) delete next.conflicts![field];
      else {
        next.conflicts![field] = { sourceValue: display(field, incoming), detectedAt: now };
        conflictFields.push(field);
      }
      return;
    }
    apply();
    changedFields.push(field);
  };

  for (const field of FIELDS) {
    const differs = previous[field] !== incoming[field];
    consider(
      field,
      differs,
      () => {
        if (field === 'title') next.title = incoming.title;
        else next.type = incoming.type as AssignmentType;
      },
      a[field] === incoming[field],
    );
  }
  const dueDiffers = previous.dueAt !== incoming.dueAt || previous.dueDateOnly !== incoming.dueDateOnly;
  consider(
    'due',
    dueDiffers,
    () => {
      next.dueAt = incoming.dueAt ?? undefined;
      next.dueDateOnly = incoming.dueDateOnly;
    },
    (a.dueAt ?? null) === incoming.dueAt,
  );

  next.sourceValues = incoming;
  next.sourceAuthority = AUTHORITY_RANK[authority] >= currentRank ? authority : a.sourceAuthority;
  next.sourceUpdatedAt = now;
  next.missingFromSource = false;
  if (Object.keys(next.conflicts!).length) next.reviewState = 'sourceConflict';
  else {
    delete next.conflicts;
    if (a.reviewState === 'sourceConflict') next.reviewState = 'reviewed';
  }
  if (changedFields.length || conflictFields.length) next.updatedAt = now;
  return { assignment: next, changedFields, conflictFields, ignored: false };
}

/** The student settles a conflict: keep their value or take the source's. */
export function resolveConflict(a: Assignment, field: AssignmentField, keep: 'mine' | 'source', now: Timestamp): Assignment {
  if (!a.conflicts?.[field]) return a;
  const next: Assignment = { ...a, conflicts: { ...a.conflicts }, userOverrides: { ...a.userOverrides }, updatedAt: now };
  if (keep === 'source' && a.sourceValues) {
    if (field === 'title') next.title = a.sourceValues.title;
    if (field === 'type') next.type = a.sourceValues.type;
    if (field === 'due') {
      next.dueAt = a.sourceValues.dueAt ?? undefined;
      next.dueDateOnly = a.sourceValues.dueDateOnly;
    }
    delete next.userOverrides[field];
  }
  delete next.conflicts![field];
  if (!Object.keys(next.conflicts!).length) {
    delete next.conflicts;
    next.reviewState = 'reviewed';
  }
  return next;
}
