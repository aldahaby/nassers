import { PARSER_VERSION, PLAN_TYPE_FOR, PLANNER_RULES, type ParserVersion } from '@/config/planner';
import { sha256Hex } from '../shared/sha256';
import type { Assignment, AssignmentType, ConfidenceLevel, Course, Id, PlannerState, ReviewReason, SourceProvenance, SourceValues, Syllabus, SyllabusSourceType, Timestamp } from '../models';
import { logEvent, type IdGen } from './plannerState';
import { applySourceUpdate } from './sourceAuthority';
import { normalizeTitle, parseSyllabus, worst, type Candidate, type CourseGuess } from './syllabusParser';
import { addDays, atMinute, weekdayOfKey } from './time';

/**
 * SOURCE → TEXT → NORMALISE → CANDIDATES → DATES → DEDUPE → CONFIDENCE →
 * STUDENT REVIEW → PERSIST. This module owns the last three steps: it turns
 * parser output into a reviewable draft, reconciles it with what's already
 * in the planner, and commits only what the student approved.
 *
 * The draft (including `rawText`) lives in memory only. `commitImport`
 * persists structured records and drops the raw text unless the student
 * explicitly chose to keep the original on this device.
 */

export type DraftChange = 'new' | 'unchanged' | 'changed' | 'removed';

export interface DraftCourse {
  index: number;
  guess: CourseGuess;
  name: string;
  code: string | null;
  term: string | null;
  timezone: string;
  /** Existing course this matches (same code, or same name). */
  existingCourseId: Id | null;
}

export interface DraftItem {
  key: string;
  courseIndex: number;
  title: string;
  type: AssignmentType;
  dueDayKey: string | null;
  dueTime: string | null;
  dueOptions?: string[];
  recurrence?: { weekday: number; time: string | null };
  estimatedMinutes: number | null;
  include: boolean;
  confidence: { title: ConfidenceLevel; type: ConfidenceLevel; due: ConfidenceLevel };
  reasons: ReviewReason[];
  provenance: SourceProvenance[];
  /** In-memory review context only. */
  snippet: string;
  fingerprint: string;
  change: DraftChange;
  existingAssignmentId?: Id;
  /** What a revised syllabus changed, for the review screen ("Oct 12 → Oct 14"). */
  diffs?: { field: 'title' | 'type' | 'due'; from: string; to: string }[];
}

export interface ImportDraft {
  sourceType: SyllabusSourceType;
  filename?: string;
  contentHash: string;
  parserVersion: string;
  extraction: Syllabus['extraction'];
  pageCount: number;
  courses: DraftCourse[];
  items: DraftItem[];
  /** Same text + parser version already imported for this course: nothing to do. */
  duplicateOfSyllabusId: Id | null;
  /** A previous syllabus for the same course (this import is a revision). */
  revisionOfSyllabusId: Id | null;
  dateRange: { first: string; last: string } | null;
  /** Memory only; dropped on commit unless keepOriginal. */
  rawText: string;
}

export interface CreateDraftInput {
  text: string;
  sourceType: SyllabusSourceType;
  filename?: string;
  timezone: string;
  now: Timestamp;
  parserVersion?: ParserVersion;
  extraction?: Syllabus['extraction'];
}

export function fingerprintOf(courseKey: string, normalizedTitle: string, dayKey?: string | null): string {
  return sha256Hex(`${courseKey}|${normalizedTitle}${dayKey ? `|${dayKey}` : ''}`).slice(0, 20);
}

const courseKeyOf = (c: { code: string | null | undefined; name: string | null | undefined }) => normalizeTitle(c.code ?? c.name ?? 'course');

export function dueAtFor(dayKey: string | null, time: string | null, timezone: string): { dueAt: Timestamp | null; dueDateOnly: boolean } {
  if (!dayKey) return { dueAt: null, dueDateOnly: false };
  if (!time) return { dueAt: atMinute(dayKey, 23 * 60 + 59, timezone), dueDateOnly: true };
  const [h, m] = time.split(':').map(Number);
  return { dueAt: atMinute(dayKey, (h ?? 0) * 60 + (m ?? 0), timezone), dueDateOnly: false };
}

function matchCourse(state: PlannerState, guess: CourseGuess): Course | null {
  const all = Object.values(state.courses).filter((c) => c.active);
  if (guess.code) {
    const byCode = all.find((c) => c.code && normalizeTitle(c.code) === normalizeTitle(guess.code!));
    if (byCode) return byCode;
  }
  if (guess.name) return all.find((c) => normalizeTitle(c.name) === normalizeTitle(guess.name!)) ?? null;
  return null;
}

export function createImportDraft(state: PlannerState, input: CreateDraftInput): ImportDraft {
  const parsed = parseSyllabus({ text: input.text, timezone: input.timezone, referenceAt: input.now, parserVersion: input.parserVersion });
  const courses: DraftCourse[] = parsed.courses.map((guess, index) => {
    const existing = matchCourse(state, guess);
    return {
      index,
      guess,
      name: existing?.name ?? guess.name ?? guess.code ?? 'New course',
      code: existing?.code ?? guess.code,
      term: existing?.term ?? guess.term,
      timezone: existing?.timezone ?? input.timezone,
      existingCourseId: existing?.id ?? null,
    };
  });

  // Repeated generic titles ("Quiz" every week) need the date in their identity.
  const titleCounts = new Map<string, number>();
  parsed.candidates.forEach((c) => titleCounts.set(`${c.courseIndex}|${c.normalizedTitle}`, (titleCounts.get(`${c.courseIndex}|${c.normalizedTitle}`) ?? 0) + 1));

  const items: DraftItem[] = parsed.candidates.map((c) => toDraftItem(c, courses[c.courseIndex]!, (titleCounts.get(`${c.courseIndex}|${c.normalizedTitle}`) ?? 1) > 1));

  const primary = courses[0]!;
  const prior = primary.existingCourseId
    ? Object.values(state.syllabi)
        .filter((s) => s.courseId === primary.existingCourseId)
        .sort((a, b) => b.revision - a.revision)
    : [];
  const duplicate = prior.find((s) => s.contentHash === parsed.contentHash && s.parserVersion === parsed.parserVersion) ?? null;

  const draft: ImportDraft = {
    sourceType: input.sourceType,
    filename: input.filename,
    contentHash: parsed.contentHash,
    parserVersion: parsed.parserVersion,
    extraction: input.extraction ?? (input.sourceType === 'pdf' ? 'embeddedText' : 'pastedText'),
    pageCount: parsed.pageCount,
    courses,
    items,
    duplicateOfSyllabusId: duplicate?.id ?? null,
    revisionOfSyllabusId: prior[0]?.id ?? null,
    dateRange: parsed.dateRange,
    rawText: input.text,
  };
  return reconcileDraft(state, draft);
}

function toDraftItem(c: Candidate, course: DraftCourse, series: boolean): DraftItem {
  return {
    key: c.key,
    courseIndex: c.courseIndex,
    title: c.title,
    type: c.type,
    dueDayKey: c.dueDayKey,
    dueTime: c.dueTime,
    dueOptions: c.dueOptions,
    recurrence: c.recurrence,
    estimatedMinutes: null,
    include: true,
    confidence: { title: 'likely', type: c.typeConfidence, due: worst(c.dateConfidence, c.timeConfidence) },
    reasons: c.reasons,
    provenance: c.provenance,
    snippet: c.snippet,
    fingerprint: fingerprintOf(courseKeyOf(course), c.normalizedTitle, series ? c.dueDayKey : null),
    change: 'new',
  };
}

const fmtDue = (dueAt: Timestamp | null | undefined) => (dueAt ? new Date(dueAt).toISOString() : 'none');

/** Marks items new / unchanged / changed against existing assignments, and lists removed ones. */
function reconcileDraft(state: PlannerState, draft: ImportDraft): ImportDraft {
  const items: DraftItem[] = [];
  const matched = new Set<Id>();
  for (const item of draft.items) {
    const course = draft.courses[item.courseIndex]!;
    const existing = course.existingCourseId
      ? Object.values(state.assignments).find((a) => a.courseId === course.existingCourseId && !a.deletedAt && a.sourceFingerprint === item.fingerprint)
      : undefined;
    if (!existing) {
      items.push(item);
      continue;
    }
    matched.add(existing.id);
    const { dueAt } = dueAtFor(item.dueDayKey, item.dueTime, course.timezone);
    const was = existing.sourceValues ?? { title: existing.title, type: existing.type, dueAt: existing.dueAt ?? null, dueDateOnly: existing.dueDateOnly ?? false };
    const diffs: NonNullable<DraftItem['diffs']> = [];
    if (was.title !== item.title) diffs.push({ field: 'title', from: was.title, to: item.title });
    if (was.type !== item.type) diffs.push({ field: 'type', from: was.type, to: item.type });
    if ((was.dueAt ?? null) !== dueAt) diffs.push({ field: 'due', from: fmtDue(was.dueAt), to: fmtDue(dueAt) });
    items.push({
      ...item,
      change: diffs.length ? 'changed' : 'unchanged',
      existingAssignmentId: existing.id,
      diffs: diffs.length ? diffs : undefined,
      estimatedMinutes: existing.estimatedMinutes ?? null,
    });
  }
  // Items a previous import of this course created that this version no longer lists.
  for (const course of draft.courses) {
    if (!course.existingCourseId || draft.duplicateOfSyllabusId) continue;
    for (const a of Object.values(state.assignments)) {
      if (a.courseId !== course.existingCourseId || a.deletedAt || matched.has(a.id) || !a.syllabusId || a.sourceAuthority === 'lms') continue;
      items.push({
        key: `removed-${a.id}`,
        courseIndex: course.index,
        title: a.title,
        type: a.type,
        dueDayKey: null,
        dueTime: null,
        estimatedMinutes: a.estimatedMinutes ?? null,
        // Kept by default: the student decides whether it's really gone.
        include: true,
        confidence: { title: 'likely', type: 'likely', due: 'needsReview' },
        reasons: [],
        provenance: [],
        snippet: '',
        fingerprint: a.sourceFingerprint,
        change: 'removed',
        existingAssignmentId: a.id,
      });
    }
  }
  return { ...draft, items };
}

// ── Review edits (all pure) ─────────────────────────────────────────

export type DraftItemPatch = Partial<Pick<DraftItem, 'title' | 'type' | 'dueDayKey' | 'dueTime' | 'estimatedMinutes' | 'include'>>;

/** A student edit confirms the field it touches. Choosing a date settles conflicts/ambiguity. */
export function editDraftItem(draft: ImportDraft, key: string, patch: DraftItemPatch): ImportDraft {
  return {
    ...draft,
    items: draft.items.map((i) => {
      if (i.key !== key) return i;
      const next: DraftItem = { ...i, ...patch, confidence: { ...i.confidence } };
      if ('title' in patch) next.confidence.title = 'confirmed';
      if ('type' in patch) next.confidence.type = 'confirmed';
      if ('dueDayKey' in patch || 'dueTime' in patch) {
        next.confidence.due = next.dueDayKey ? 'confirmed' : 'needsReview';
        if (next.dueDayKey) next.dueOptions = undefined;
      }
      return next;
    }),
  };
}

/** "Looks right": confirm every field of one item as it stands (dates must exist). */
export function confirmDraftItem(draft: ImportDraft, key: string): ImportDraft {
  return {
    ...draft,
    items: draft.items.map((i) => (i.key === key && (i.dueDayKey || i.recurrence) ? { ...i, confidence: { title: 'confirmed', type: 'confirmed', due: 'confirmed' }, dueOptions: undefined } : i)),
  };
}

export function draftCounts(draft: ImportDraft) {
  const included = draft.items.filter((i) => i.include && i.change !== 'removed');
  const level = (i: DraftItem) => worst(i.confidence.title, i.confidence.type, i.confidence.due);
  return {
    found: draft.items.filter((i) => i.change !== 'removed').length,
    included: included.length,
    needsReview: included.filter((i) => level(i) === 'needsReview').length,
    likely: included.filter((i) => level(i) === 'likely').length,
    confirmed: included.filter((i) => level(i) === 'confirmed').length,
    changed: draft.items.filter((i) => i.change === 'changed').length,
    removed: draft.items.filter((i) => i.change === 'removed').length,
  };
}

// ── Commit ──────────────────────────────────────────────────────────

export interface CommitOptions {
  now: Timestamp;
  ids: IdGen;
  keepOriginal: boolean;
  /** Which draft courses to create/update (default all). */
  courseColors?: string[];
}

export interface CommitResult {
  state: PlannerState;
  syllabusIds: Id[];
  courseIds: Id[];
  createdAssignmentIds: Id[];
  changedAssignmentIds: Id[];
  /** Plans cancelled because their assignment's deadline moved before them. */
  cancelledPlanIds: Id[];
}

export function commitImport(state: PlannerState, draft: ImportDraft, opts: CommitOptions): CommitResult {
  const { now, ids } = opts;
  let next: PlannerState = { ...state, courses: { ...state.courses }, assignments: { ...state.assignments }, syllabi: { ...state.syllabi }, plans: { ...state.plans }, originals: { ...state.originals } };
  const result: Omit<CommitResult, 'state'> = { syllabusIds: [], courseIds: [], createdAssignmentIds: [], changedAssignmentIds: [], cancelledPlanIds: [] };
  if (draft.duplicateOfSyllabusId) return { state, ...result };

  for (const dc of draft.courses) {
    const courseItems = draft.items.filter((i) => i.courseIndex === dc.index);
    if (!courseItems.length && draft.courses.length > 1) continue;
    let courseId = dc.existingCourseId;
    if (!courseId) {
      courseId = ids('course');
      next.courses[courseId] = {
        id: courseId,
        name: dc.name,
        code: dc.code ?? undefined,
        term: dc.term ?? undefined,
        color: opts.courseColors?.[dc.index],
        timezone: dc.timezone,
        sourceType: draft.sourceType,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
    }
    result.courseIds.push(courseId);

    const priorRevision = Math.max(0, ...Object.values(next.syllabi).filter((s) => s.courseId === courseId).map((s) => s.revision));
    const syllabusId = ids('syllabus');
    result.syllabusIds.push(syllabusId);
    const kept = courseItems.filter((i) => i.include && i.change !== 'removed');
    next.syllabi[syllabusId] = {
      id: syllabusId,
      courseId,
      sourceType: draft.sourceType,
      filename: draft.filename,
      contentHash: draft.contentHash,
      importedAt: now,
      parserVersion: draft.parserVersion,
      parseStatus: 'reviewed',
      overallConfidence: worst(...kept.map((i) => worst(i.confidence.title, i.confidence.type, i.confidence.due))),
      rawTextRetention: opts.keepOriginal ? 'keptLocally' : 'discarded',
      revision: priorRevision + 1,
      itemCount: kept.length,
      extraction: draft.extraction,
    };
    if (opts.keepOriginal) next.originals[syllabusId] = draft.rawText;

    for (const item of courseItems) {
      if (item.change === 'removed') {
        const existing = next.assignments[item.existingAssignmentId!];
        if (!existing) continue;
        next.assignments[existing.id] = item.include ? { ...existing, missingFromSource: true, updatedAt: now } : { ...existing, deletedAt: now, updatedAt: now };
        if (!item.include) result.cancelledPlanIds.push(...cancelPlansFor(next, existing.id, null, now));
        continue;
      }
      const occurrences = expandItem(item, draft, dc.timezone);
      for (const occ of occurrences) {
        const { dueAt, dueDateOnly } = dueAtFor(occ.dueDayKey, occ.dueTime, dc.timezone);
        const sourceValues: SourceValues = { title: occ.title, type: item.type, dueAt, dueDateOnly };
        const existing = item.existingAssignmentId ? next.assignments[item.existingAssignmentId] : undefined;
        if (existing && occurrences.length === 1) {
          if (!item.include) {
            next.assignments[existing.id] = { ...existing, deletedAt: now, updatedAt: now };
            result.cancelledPlanIds.push(...cancelPlansFor(next, existing.id, null, now));
            continue;
          }
          const upd = applySourceUpdate(existing, sourceValues, 'syllabus', now);
          const a: Assignment = { ...upd.assignment, syllabusId, estimatedMinutes: item.estimatedMinutes ?? existing.estimatedMinutes };
          next.assignments[a.id] = a;
          if (upd.changedFields.length || upd.conflictFields.length) {
            result.changedAssignmentIds.push(a.id);
            next = logEvent(next, ids, now, 'sourceUpdated', { courseId, assignmentId: a.id, data: { fields: upd.changedFields.join(','), conflicts: upd.conflictFields.length } });
            if (upd.changedFields.includes('due')) result.cancelledPlanIds.push(...cancelPlansFor(next, a.id, a.dueAt ?? null, now));
          }
          continue;
        }
        if (!item.include) continue;
        const id = ids('assignment');
        const needsReview = item.confidence.due === 'needsReview' || !dueAt;
        next.assignments[id] = {
          id,
          courseId,
          syllabusId,
          title: occ.title,
          type: item.type,
          dueAt: dueAt ?? undefined,
          dueDateOnly: dueAt ? dueDateOnly : undefined,
          estimatedMinutes: item.estimatedMinutes ?? undefined,
          status: 'open',
          reviewState: needsReview ? 'needsReview' : 'reviewed',
          // "Add to planner" is the student's confirmation; only fields still needing review stay flagged.
          fieldConfidence: {
            title: confirmLikely(item.confidence.title),
            type: confirmLikely(item.confidence.type),
            due: dueAt ? confirmLikely(item.confidence.due) : 'needsReview',
            ...(item.estimatedMinutes ? { estimate: 'confirmed' as const } : {}),
          },
          reviewReasons: item.reasons.length ? item.reasons : undefined,
          provenance: item.provenance[0],
          sourceFingerprint: occurrences.length > 1 ? `${item.fingerprint}:${occ.dueDayKey}` : item.fingerprint,
          sourceAuthority: needsReview ? 'parser' : 'syllabus',
          sourceValues,
          sourceUpdatedAt: now,
          userOverrides: {},
          createdAt: now,
          updatedAt: now,
        };
        result.createdAssignmentIds.push(id);
      }
    }
  }
  return { state: next, ...result };
}

const confirmLikely = (c: ConfidenceLevel): ConfidenceLevel => (c === 'likely' ? 'confirmed' : c);

/** Weekly items become one assignment per week inside the document's date range. */
function expandItem(item: DraftItem, draft: ImportDraft, _timezone: string): { title: string; dueDayKey: string | null; dueTime: string | null }[] {
  if (!item.recurrence || !draft.dateRange || item.confidence.due === 'needsReview') return [{ title: item.title, dueDayKey: item.dueDayKey, dueTime: item.dueTime }];
  const out: { title: string; dueDayKey: string; dueTime: string | null }[] = [];
  let day = draft.dateRange.first;
  while (weekdayOfKey(day) !== item.recurrence.weekday) day = addDays(day, 1);
  let week = 1;
  while (day <= draft.dateRange.last && out.length < 30) {
    out.push({ title: `${item.title} · week ${week}`, dueDayKey: day, dueTime: item.recurrence.time });
    day = addDays(day, 7);
    week += 1;
  }
  return out;
}

/** Cancel future plans that now fall after the (new) deadline. Returns their ids. */
export function cancelPlansFor(state: PlannerState, assignmentId: Id, newDueAt: Timestamp | null, now: Timestamp): Id[] {
  const cancelled: Id[] = [];
  for (const p of Object.values(state.plans)) {
    if (p.assignmentId !== assignmentId || p.plannedStartAt < now) continue;
    if (p.status !== 'accepted' && p.status !== 'proposed' && p.status !== 'rescheduled') continue;
    const limit = newDueAt === null ? -Infinity : newDueAt - PLANNER_RULES.deadlineBufferMinutes * 60_000;
    if (p.plannedStartAt + p.plannedMinutes * 60_000 > limit) {
      state.plans[p.id] = { ...p, status: 'cancelled', updatedAt: now };
      cancelled.push(p.id);
    }
  }
  return cancelled;
}

export const planTypeFor = (type: AssignmentType) => PLAN_TYPE_FOR[type];

export { PARSER_VERSION };
