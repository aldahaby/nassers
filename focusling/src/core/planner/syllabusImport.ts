import { PARSER_VERSION, PLAN_TYPE_FOR, PLANNER_RULES, REVISION_MATCH, type ParserVersion } from '@/config/planner';
import { sha256Hex } from '../shared/sha256';
import type { Assignment, AssignmentType, ConfidenceLevel, Course, CourseDetails, Id, Inference, PlannerState, ReviewReason, SourceProvenance, SourceValues, Syllabus, SyllabusInsights, SyllabusSourceType, Timestamp } from '../models';
import { stripRunningHeaders } from '../documents/documentText';
import { extractInsights } from './syllabusInsights';
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
  /** How values were worked out from context (shown as "Inferred from context"). */
  inferences: Inference[];
  availableDayKey: string | null;
  /** Exam period with no exam date yet. */
  window: { from: string; to: string } | null;
  weightPercent: number | null;
  statedZone: { label: string; zone: string | null } | null;
  /** Explicit coverage (from the item's own line or an "X covers Y" statement), plus that schedule's topics. */
  coverage: { weeks: { from: number; to: number } | null; chapters: string | null; topics: string[] } | null;
  /** Revised syllabus: a new item that might be a renamed existing one. The student decides. */
  possibleMatch?: { assignmentId: Id; title: string };
}

/** What a student sees about one value: what Studyling knows, and what it doesn't. */
export type TrustStatus = 'confirmedByYou' | 'fromDocument' | 'inferred' | 'needsReview' | 'conflicting' | 'notSpecified';

export interface DetailDiff {
  area: 'grading' | 'schedule' | 'people' | 'meetings' | 'identity';
  label: string;
  from: string | null;
  to: string | null;
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
  /** Course-level understanding (identity, people, grading, schedule…), editable in review. */
  insights: SyllabusInsights;
  /** Whether to save course details, and whether to include people's email addresses (off by default). */
  details: { save: boolean; saveContacts: boolean };
  /** Revised syllabus: what changed in course details compared with what's saved. */
  detailsDiff: DetailDiff[];
  /** Running header/footer lines ignored (repeated on most pages). */
  ignoredHeaderLines: number;
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
  const cleaned = stripRunningHeaders(input.text);
  const parsed = parseSyllabus({ text: cleaned.text, timezone: input.timezone, referenceAt: input.now, parserVersion: input.parserVersion });
  const insights = extractInsights(cleaned.text);
  const courses: DraftCourse[] = parsed.courses.map((g, index) => {
    // The insights pass reads labelled headings ("Course title:", institution lines) the parser doesn't.
    const guess: CourseGuess =
      index === 0 && parsed.courses.length === 1
        ? { code: g.code ?? insights.identity.code, name: g.code && insights.identity.code === g.code ? insights.identity.title ?? g.name : g.name ?? insights.identity.title, term: g.term ?? (insights.identity.term ? `${insights.identity.term.season[0]!.toUpperCase()}${insights.identity.term.season.slice(1)} ${insights.identity.term.year}` : null) }
        : g;
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

  const items: DraftItem[] = parsed.candidates.map((c) => toDraftItem(c, courses[c.courseIndex]!, (titleCounts.get(`${c.courseIndex}|${c.normalizedTitle}`) ?? 1) > 1, insights));

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
    insights,
    details: { save: true, saveContacts: false },
    detailsDiff: primary.existingCourseId ? diffDetails(state.courses[primary.existingCourseId]?.details ?? null, insights) : [],
    ignoredHeaderLines: cleaned.removed,
  };
  return reconcileDraft(state, draft);
}

/** Coverage for an item: its own line first, then an explicit "X covers Y" line; topics come from those weeks of the schedule. */
function coverageFor(c: Candidate, insights: SyllabusInsights): DraftItem['coverage'] {
  const stated = insights.coverage.find((r) => r.itemKey === c.normalizedTitle || (c.normalizedTitle.startsWith(r.itemKey) && r.itemKey.length >= 4));
  const weeks = c.coverage?.weeks ?? stated?.weeks ?? null;
  const chapters = c.coverage?.chapters ?? stated?.chapters ?? null;
  if (!weeks && !chapters) return null;
  const topics = weeks ? insights.schedule.filter((w) => w.week >= weeks.from && w.week <= weeks.to).map((w) => w.topic) : [];
  return { weeks, chapters, topics };
}

function toDraftItem(c: Candidate, course: DraftCourse, series: boolean, insights: SyllabusInsights): DraftItem {
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
    inferences: c.inferences ?? [],
    availableDayKey: c.availableDayKey ?? null,
    window: c.window ?? null,
    weightPercent: c.weightPercent ?? null,
    statedZone: c.statedZone ?? null,
    coverage: coverageFor(c, insights),
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
        inferences: [],
        availableDayKey: null,
        window: null,
        weightPercent: null,
        statedZone: null,
        coverage: null,
      });
    }
  }
  // A new item that looks like a removed one (renamed? re-dated?) is offered as a possible match; never merged silently.
  const removed = items.filter((i) => i.change === 'removed');
  for (const item of items) {
    if (item.change !== 'new') continue;
    const course = draft.courses[item.courseIndex]!;
    const newDue = dueAtFor(item.dueDayKey, item.dueTime, course.timezone).dueAt;
    const firstWord = (t: string) => normalizeTitle(t).split(' ')[0] ?? '';
    const twin = removed.find((r) => {
      if (r.courseIndex !== item.courseIndex || r.type !== item.type) return false;
      if (titleSimilarity(r.title, item.title) >= REVISION_MATCH.minTitleSimilarity) return true;
      // "Homework 2" → "Homework Two" moved a few days: same kind, same leading word, close dates.
      const oldDue = state.assignments[r.existingAssignmentId!]?.dueAt;
      return firstWord(r.title) === firstWord(item.title) && newDue !== null && oldDue !== undefined && Math.abs(newDue - oldDue) <= REVISION_MATCH.dateWindowDays * 86_400_000;
    });
    if (twin) item.possibleMatch = { assignmentId: twin.existingAssignmentId!, title: twin.title };
  }
  return { ...draft, items };
}

/** Word-overlap similarity of two titles (0–1). */
export function titleSimilarity(a: string, b: string): number {
  const words = (t: string) => new Set(normalizeTitle(t).split(' ').filter(Boolean));
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / new Set([...A, ...B]).size;
}

/** Student says a new item IS the existing one: it becomes an update to that assignment. */
export function linkDraftItem(state: PlannerState, draft: ImportDraft, key: string): ImportDraft {
  const item = draft.items.find((i) => i.key === key);
  if (!item?.possibleMatch) return draft;
  const existing = state.assignments[item.possibleMatch.assignmentId];
  if (!existing) return draft;
  const course = draft.courses[item.courseIndex]!;
  const { dueAt } = dueAtFor(item.dueDayKey, item.dueTime, course.timezone);
  const was = existing.sourceValues ?? { title: existing.title, type: existing.type, dueAt: existing.dueAt ?? null, dueDateOnly: existing.dueDateOnly ?? false };
  const diffs: NonNullable<DraftItem['diffs']> = [];
  if (was.title !== item.title) diffs.push({ field: 'title', from: was.title, to: item.title });
  if (was.type !== item.type) diffs.push({ field: 'type', from: was.type, to: item.type });
  if ((was.dueAt ?? null) !== dueAt) diffs.push({ field: 'due', from: fmtDue(was.dueAt), to: fmtDue(dueAt) });
  const linked: DraftItem = { ...item, change: diffs.length ? 'changed' : 'unchanged', existingAssignmentId: existing.id, diffs: diffs.length ? diffs : undefined, possibleMatch: undefined, estimatedMinutes: existing.estimatedMinutes ?? item.estimatedMinutes };
  return { ...draft, items: draft.items.filter((i) => !(i.change === 'removed' && i.existingAssignmentId === existing.id)).map((i) => (i.key === key ? linked : i)) };
}

/** Student says they're different items: keep both (the old one stays flagged as no longer listed). */
export function unlinkDraftItem(draft: ImportDraft, key: string): ImportDraft {
  return { ...draft, items: draft.items.map((i) => (i.key === key ? { ...i, possibleMatch: undefined } : i)) };
}

export function setDraftDetails(draft: ImportDraft, patch: Partial<ImportDraft['details']>): ImportDraft {
  return { ...draft, details: { ...draft.details, ...patch } };
}

/** What the student sees about an item in review. */
export function trustStatusOf(item: DraftItem): TrustStatus {
  const c = item.confidence;
  if (c.title === 'confirmed' && c.type === 'confirmed' && c.due === 'confirmed') return 'confirmedByYou';
  if (item.dueOptions?.length || item.reasons.includes('conflictingDates')) return 'conflicting';
  if (!item.dueDayKey && !item.recurrence) return 'notSpecified';
  if (worst(c.title, c.type, c.due) === 'needsReview') return 'needsReview';
  if (item.inferences.length) return 'inferred';
  return 'fromDocument';
}

/** The same question for a saved assignment. */
export function assignmentTrustStatus(a: Assignment): TrustStatus {
  if (a.sourceAuthority === 'user' || a.reviewState === 'userEntered') return 'confirmedByYou';
  if (a.reviewState === 'sourceConflict' || a.reviewReasons?.includes('conflictingDates')) return 'conflicting';
  if (!a.dueAt) return 'notSpecified';
  if (Object.values(a.fieldConfidence).includes('needsReview')) return 'needsReview';
  if (Object.keys(a.userOverrides).length) return 'confirmedByYou';
  if (a.inferenceNotes?.length) return 'inferred';
  return 'fromDocument';
}

/** Course-detail changes between what's saved and a revised syllabus. */
export function diffDetails(old: CourseDetails | null, next: SyllabusInsights): DetailDiff[] {
  if (!old) return [];
  const out: DetailDiff[] = [];
  const oldGrades = new Map((old.grading?.components ?? []).map((c) => [normalizeTitle(c.name), c]));
  const newGrades = new Map((next.grading?.components ?? []).map((c) => [normalizeTitle(c.name), c]));
  for (const [k, c] of newGrades) {
    const was = oldGrades.get(k);
    if (!was) out.push({ area: 'grading', label: c.name, from: null, to: `${c.weightPercent}%` });
    else if (was.weightPercent !== c.weightPercent) out.push({ area: 'grading', label: c.name, from: `${was.weightPercent}%`, to: `${c.weightPercent}%` });
  }
  for (const [k, c] of oldGrades) if (!newGrades.has(k)) out.push({ area: 'grading', label: c.name, from: `${c.weightPercent}%`, to: null });
  const oldWeeks = new Map(old.schedule.map((w) => [w.week, w]));
  for (const w of next.schedule) {
    const was = oldWeeks.get(w.week);
    if (!was) out.push({ area: 'schedule', label: `Week ${w.week}`, from: null, to: w.topic });
    else if (normalizeTitle(was.topic) !== normalizeTitle(w.topic)) out.push({ area: 'schedule', label: `Week ${w.week}`, from: was.topic, to: w.topic });
  }
  const names = (d: { people: { role: string; name: string }[] }) => d.people.map((p) => `${p.role}:${p.name}`).sort().join(', ');
  if (names(old) !== names(next) && next.people.length) out.push({ area: 'people', label: 'Instructor and TAs', from: old.people.map((p) => p.name).join(', ') || null, to: next.people.map((p) => p.name).join(', ') });
  const meets = (m: { kind: string; weekday: number; startMinute: number | null }[]) => m.map((x) => `${x.kind}:${x.weekday}:${x.startMinute}`).sort().join(',');
  if (meets(old.meetings) !== meets(next.meetings) && next.meetings.length) out.push({ area: 'meetings', label: 'Class times', from: null, to: null });
  return out;
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
    const willSaveDetails = dc.index === 0 && draft.details.save;

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
    if (willSaveDetails) {
      const course = next.courses[courseId]!;
      const ins = draft.insights;
      const details: CourseDetails = {
        ...ins,
        // People's email addresses are kept only when the student asks.
        people: ins.people.map((p) => (draft.details.saveContacts ? p : { role: p.role, name: p.name, provenance: p.provenance })),
        fromSyllabusId: syllabusId,
        reviewedAt: now,
      };
      const lectures = ins.meetings.filter((m) => m.startMinute !== null && m.endMinute !== null && m.kind !== 'tutorial' && m.kind !== 'lab');
      next.courses[courseId] = {
        ...course,
        details,
        code: course.code ?? ins.identity.code ?? undefined,
        meetingSchedule: course.meetingSchedule?.length ? course.meetingSchedule : lectures.length ? lectures.map((m) => ({ weekday: m.weekday, startMinute: m.startMinute!, endMinute: m.endMinute! })) : course.meetingSchedule,
        updatedAt: now,
      };
    }

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
          const a: Assignment = { ...upd.assignment, syllabusId, estimatedMinutes: item.estimatedMinutes ?? existing.estimatedMinutes, ...academicFields(item, dc.timezone, existing) };
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
          ...academicFields(item, dc.timezone),
        };
        result.createdAssignmentIds.push(id);
      }
    }
  }
  return { state: next, ...result };
}

const confirmLikely = (c: ConfidenceLevel): ConfidenceLevel => (c === 'likely' ? 'confirmed' : c);

/** Weight, release date, exam window, coverage and inference notes from a reviewed item. Existing values the student set are kept. */
function academicFields(item: DraftItem, timezone: string, existing?: Assignment): Partial<Assignment> {
  const out: Partial<Assignment> = {};
  if (item.weightPercent !== null && existing?.weight === undefined) out.weight = item.weightPercent;
  if (item.availableDayKey && existing?.availableAt === undefined) out.availableAt = atMinute(item.availableDayKey, 0, timezone);
  if (item.window && !item.dueDayKey) out.window = { from: atMinute(item.window.from, 0, timezone), to: atMinute(item.window.to, 23 * 60 + 59, timezone) };
  if (!item.dueDayKey && !item.recurrence) out.unresolved = item.reasons.includes('examPeriod') ? 'examPeriod' : item.reasons.includes('tba') ? 'tba' : undefined;
  if (item.dueDayKey && existing?.unresolved) out.unresolved = undefined;
  if (item.coverage) out.coverage = item.coverage;
  if (item.inferences.length) out.inferenceNotes = item.inferences.map((i) => i.note);
  return out;
}

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
