import { PARSER_VERSION, PLAN_TYPE_FOR, PLANNER_RULES, REVISION_MATCH, type ParserVersion } from '@/config/planner';
import { sha256Hex } from '../shared/sha256';
import type { Assignment, AssignmentType, ConditionalDeadline, ConfidenceLevel, Course, CourseDetails, Id, Inference, LectureEntry, PlannerState, ReviewReason, SourceProvenance, SourceValues, Syllabus, SyllabusInsights, SyllabusSourceType, Timestamp, YearAnalysis } from '../models';
import { stripRunningHeaders } from '../documents/documentText';
import { extractInsights } from './syllabusInsights';
import { academicYearOf, analyzeYears, buildCatalog, calendarYearOf, cleanItemTitle, termDayKey, entryAliasIn, entryMentionedIn, isReferenceLine, readLines, weekdayMismatch, type CatalogEntry } from './academicReading';
import { logEvent, type IdGen } from './plannerState';
import { applySourceUpdate } from './sourceAuthority';
import { datesInLine, normalizeTitle, parseSyllabus, worst, type Candidate, type CourseGuess } from './syllabusParser';
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
  /** The named assessment this item is (academic reading), e.g. "assignment4". */
  catalogKey?: string;
  /** The date as written (month/day, year only if the syllabus gave one), so a year answer can place it. */
  writtenDate?: { month: number; day: number; explicitYear: number | null; text: string } | null;
  /** "Due 3 days before your assigned lecture": no date until the student answers. */
  conditional?: ConditionalDeadline | null;
  /** The item's own sentences: what to hand in, and how. */
  requirements?: string[];
  submission?: string | null;
  late?: string | null;
  /** Inconsistencies worth telling the student about (weekday/date mismatch). */
  notes?: string[];
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
  /** Year evidence; when the document disagrees with itself the student picks (`chosen`), never a silent default. */
  years: YearAnalysis;
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
        ? { code: insights.identity.code ?? g.code, name: insights.identity.title ?? g.name, term: g.term ?? (insights.identity.term ? `${insights.identity.term.season[0]!.toUpperCase()}${insights.identity.term.season.slice(1)} ${insights.identity.term.year}` : null) }
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

  let items: DraftItem[] = parsed.candidates.map((c) => toDraftItem(c, courses[c.courseIndex]!, (titleCounts.get(`${c.courseIndex}|${c.normalizedTitle}`) ?? 1) > 1, insights));
  // Academic reading (current parser only; older versions stay comparable in Syllabus Lab).
  const academic = parsed.parserVersion === PARSER_VERSION && courses.length === 1;
  const lines = readLines(cleaned.text);
  const years: YearAnalysis = { ...(insights.years ?? analyzeYears(lines)), chosen: null };
  let draftInsights = insights;
  if (academic) {
    const catalog = buildCatalog(lines);
    items = applyCatalog(items, catalog, courses[0]!, insights, years);
    // No grading table in the text, but items state their own weight ("Value: 5% of final grade").
    const weighted = catalog.filter((e) => e.weightPercent !== null);
    if (!insights.grading && weighted.length >= 2) {
      const totalPercent = weighted.reduce((n, e) => n + e.weightPercent!, 0);
      draftInsights = { ...insights, grading: { components: weighted.map((e) => ({ name: e.title, weightPercent: e.weightPercent!, provenance: e.provenance })), totalPercent, addsUp: Math.abs(totalPercent - 100) < 0.01 } };
    }
  }

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
    insights: draftInsights,
    details: { save: true, saveContacts: false },
    detailsDiff: primary.existingCourseId ? diffDetails(state.courses[primary.existingCourseId]?.details ?? null, draftInsights) : [],
    ignoredHeaderLines: cleaned.removed,
    years,
  };
  return reconcileDraft(state, academic ? placeYears(draft) : draft);
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

// ── Academic reading → draft ────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');

function blankItem(e: CatalogEntry, course: DraftCourse): DraftItem {
  return {
    key: `catalog-${e.key}`,
    courseIndex: course.index,
    title: e.title,
    type: e.type,
    dueDayKey: null,
    dueTime: null,
    estimatedMinutes: null,
    include: true,
    confidence: { title: 'likely', type: 'likely', due: 'needsReview' },
    reasons: [],
    provenance: [e.provenance],
    snippet: e.dates[0]?.text ?? e.conditional?.anchor ?? e.title,
    fingerprint: '',
    change: 'new',
    inferences: [],
    availableDayKey: null,
    window: null,
    weightPercent: null,
    statedZone: null,
    coverage: null,
  };
}

/** "lectures 1–10" → those lectures' topics, when the syllabus lists them. */
function coverageFromText(text: string | null, lectures: LectureEntry[]): DraftItem['coverage'] {
  if (!text) return null;
  const m = /lectures?\s+(\d{1,2})\s*(?:[–—-]|to|through)\s*(\d{1,2})/i.exec(text);
  const topics = m ? lectures.filter((l) => l.number >= Number(m[1]) && l.number <= Number(m[2])).map((l) => l.topic) : [];
  return { weeks: null, chapters: text, topics };
}

/**
 * Named assessments replace sentence fragments: "The video must be uploaded to
 * myCourses Assignment 4 tab" becomes "Assignment 4 — Literature Assignment B",
 * with its weight, requirements and submission method. Assessments the line
 * parser missed (conditional deadlines, undated ones) are added, never dated
 * by guesswork.
 */
function applyCatalog(items: DraftItem[], catalog: CatalogEntry[], course: DraftCourse, insights: SyllabusInsights, years: YearAnalysis): DraftItem[] {
  const out: DraftItem[] = [];
  const consumed = new Set<string>();
  const merged = new Map<string, DraftItem>();
  const courseKey = courseKeyOf(course);
  const lectures = insights.lectures ?? [];
  for (const e of catalog) {
    const matches = items.filter((i) => !consumed.has(i.key) && i.change !== 'removed' && (normalizeTitle(i.title) === normalizeTitle(e.base) || normalizeTitle(i.title) === normalizeTitle(e.title) || (entryMentionedIn(e, i.title) && (i.type === e.type || cleanItemTitle(i.title, i.type) !== i.title)) || entryAliasIn(e, i.snippet) || (e.examPeriod !== null && i.reasons.includes('examPeriod') && /^(?:final\s+)?exam(?:ination)?s?\s+period\.?$/i.test(i.title.trim()))));
    matches.forEach((i) => consumed.add(i.key));
    const target = matches[0];
    const due = e.dates.find((d) => d.role !== 'release') ?? null;
    const release = e.dates.find((d) => d.role === 'release') ?? null;
    const base = target ?? blankItem(e, course);
    const reasons = new Set<ReviewReason>(base.reasons.filter((r) => r !== 'typeUnknown'));
    if (e.tentative) reasons.add('tentative');
    const item: DraftItem = {
      ...base,
      title: e.title,
      type: e.type,
      catalogKey: e.key,
      weightPercent: e.weightPercent ?? base.weightPercent,
      requirements: e.requirements,
      submission: e.submission,
      late: e.late,
      conditional: null,
      fingerprint: fingerprintOf(courseKey, normalizeTitle(e.title)),
      confidence: { ...base.confidence, title: 'likely', type: 'likely' },
      coverage: base.coverage ?? coverageFromText(e.coverage, lectures),
      provenance: [...new Map([...base.provenance, e.provenance].map((p) => [`${p.page}:${p.line}`, p])).values()],
    };
    if (due) {
      item.writtenDate = { month: due.month, day: due.day, explicitYear: due.explicitYear, text: due.text };
      item.dueTime = due.time ?? (target && target.dueDayKey?.endsWith(`-${pad2(due.month)}-${pad2(due.day)}`) ? target.dueTime : null);
      if (!item.dueDayKey || !item.dueDayKey.endsWith(`-${pad2(due.month)}-${pad2(due.day)}`)) item.dueDayKey = years.termYear !== null ? termDayKey(due.month, due.day, due.explicitYear !== null ? academicYearOf(due.month, due.explicitYear, years.season) : years.termYear, years.season) : null;
      if (!target && item.dueDayKey) item.confidence.due = reasons.has('tentative') ? 'needsReview' : 'likely';
      // Other lines naming the same item with a different date: the student picks.
      const sameDay = (k: string) => k.endsWith(`-${pad2(due.month)}-${pad2(due.day)}`);
      const statedDays = years.termYear !== null ? e.dates.filter((d) => d.role !== 'release' && d !== due && (d.month !== due.month || d.day !== due.day)).map((d) => termDayKey(d.month, d.day, d.explicitYear !== null ? academicYearOf(d.month, d.explicitYear, years.season) : years.termYear!, years.season)) : [];
      const otherDays = [...matches.map((m) => m.dueDayKey), ...statedDays].filter((k): k is string => Boolean(k) && k !== item.dueDayKey && !sameDay(k as string));
      if (otherDays.length && item.dueDayKey) {
        item.dueOptions = [...new Set([item.dueDayKey, ...otherDays])].sort();
        reasons.add('conflictingDates');
        item.confidence.due = 'needsReview';
      }
      if (release && years.termYear !== null && !item.availableDayKey) item.availableDayKey = termDayKey(release.month, release.day, release.explicitYear !== null ? academicYearOf(release.month, release.explicitYear, years.season) : years.termYear, years.season);
    } else if (e.conditional) {
      item.conditional = { ...e.conditional };
      item.dueDayKey = null;
      item.dueOptions = undefined;
      item.dueTime = e.conditional.time;
      item.window = null;
      item.confidence.due = 'needsReview';
      reasons.add('conditional');
    } else if (e.examPeriod) {
      item.dueDayKey = null;
      item.dueTime = null;
      item.dueOptions = undefined;
      item.confidence.due = 'needsReview';
      reasons.add('examPeriod');
      if (!item.window && e.examPeriod.start && e.examPeriod.end && years.termYear !== null) {
        const y = (d: { month: number; explicitYear?: number | null }) => (d.explicitYear ? academicYearOf(d.month, d.explicitYear, years.season) : years.termYear!);
        item.window = { from: termDayKey(e.examPeriod.start.month, e.examPeriod.start.day, y(e.examPeriod.start), years.season), to: termDayKey(e.examPeriod.end.month, e.examPeriod.end.day, y(e.examPeriod.start), years.season) };
      }
    } else if (e.tba) {
      item.dueDayKey = null;
      item.dueOptions = undefined;
      item.confidence.due = 'needsReview';
      reasons.add('tba');
    }
    item.reasons = [...reasons];
    if (target) merged.set(target.key, item);
    else out.push(item);
  }
  const result: DraftItem[] = [];
  for (const i of items) {
    if (merged.has(i.key)) result.push(merged.get(i.key)!);
    else if (consumed.has(i.key)) continue;
    // "(Approved by Senate on 21 January 2009)", "Writer, A. (2021, September 14)": not course work.
    else if (i.change !== 'removed' && isReferenceLine(i.snippet)) continue;
    else {
      const title = cleanItemTitle(i.title, i.type);
      result.push(title === i.title ? i : { ...i, title, fingerprint: fingerprintOf(courseKey, normalizeTitle(title), i.dueDayKey) });
    }
  }
  result.push(...out);
  // Two items that ended up with the same identity keep distinct fingerprints.
  const seen = new Set<string>();
  return result.map((i) => {
    if (!seen.has(i.fingerprint)) {
      seen.add(i.fingerprint);
      return i;
    }
    const fingerprint = fingerprintOf(courseKey, normalizeTitle(i.title), i.dueDayKey ?? i.key);
    seen.add(fingerprint);
    return { ...i, fingerprint };
  });
}

/** The date as the syllabus wrote it, for parser items that weren't matched to a named assessment. */
function withWrittenDate(i: DraftItem): DraftItem {
  if (i.writtenDate !== undefined || !i.dueDayKey || i.recurrence) return i;
  const [, mm, dd] = i.dueDayKey.split('-').map(Number);
  const d = datesInLine(i.snippet).find((x) => x.month === mm && x.day === dd);
  return { ...i, writtenDate: d ? { month: d.month, day: d.day, explicitYear: d.year, text: i.snippet } : null };
}

/** The year the student's dates are placed in: the document's own when it agrees with itself, otherwise the student's answer (or none yet). */
export function placementYear(years: YearAnalysis): number | null {
  return years.conflict ? (years.chosen ?? null) : years.termYear;
}

function placeItem(i: DraftItem, y: YearAnalysis, lectures: LectureEntry[]): DraftItem {
  // The student's own date stays; a lecture answer follows the year (the lecture moves with it).
  if (i.change === 'removed' || (i.confidence.due === 'confirmed' && i.conditional?.anchorLecture === undefined)) return i;
  const year = placementYear(y);
  const hadYearConflict = i.reasons.includes('yearConflict');
  const reasons: ReviewReason[] = i.reasons.filter((r) => r !== 'yearConflict' && r !== 'weekdayMismatch');
  const notes: string[] = [];
  const next: DraftItem = { ...i, confidence: { ...i.confidence } };
  if (hadYearConflict) next.dueOptions = undefined;

  if (i.conditional?.anchorLecture !== undefined) {
    const lec = lectures.find((l) => l.number === i.conditional!.anchorLecture);
    const anchorDayKey = lec && year !== null ? termDayKey(lec.month, lec.day, year, y.season) : null;
    next.conditional = { ...i.conditional, anchorDayKey: anchorDayKey ?? undefined };
    next.dueDayKey = anchorDayKey ? conditionalDueDay(i.conditional, anchorDayKey) : null;
    next.confidence.due = next.dueDayKey ? 'confirmed' : 'needsReview';
  }

  const w = i.writtenDate;
  if (w) {
    if (w.explicitYear !== null) {
      const explicitKey = `${w.explicitYear}-${pad2(w.month)}-${pad2(w.day)}`;
      const ay = academicYearOf(w.month, w.explicitYear, y.season);
      const against = year ?? y.termYear;
      if (y.conflict && against !== null && ay !== against) {
        next.dueOptions = [termDayKey(w.month, w.day, against, y.season), explicitKey].sort();
        next.dueDayKey = null;
        next.confidence.due = 'needsReview';
        reasons.push('yearConflict');
      } else next.dueDayKey = explicitKey;
    } else if (year === null) {
      if (y.conflict) {
        next.dueDayKey = null;
        next.confidence.due = 'needsReview';
        reasons.push('yearConflict');
      }
    } else next.dueDayKey = termDayKey(w.month, w.day, year, y.season);
    const ay = w.explicitYear !== null ? academicYearOf(w.month, w.explicitYear, y.season) : year;
    if (ay !== null && !reasons.includes('yearConflict')) {
      const mismatch = weekdayMismatch(w.text, w.month, w.day, ay, y.season);
      if (mismatch) {
        notes.push(mismatch);
        reasons.push('weekdayMismatch');
      }
    }
    if (hadYearConflict && !reasons.includes('yearConflict') && next.dueDayKey) next.confidence.due = 'likely';
    const yearNote = i.inferences.find((x) => x.field === 'year');
    next.inferences = i.inferences.filter((x) => x.field !== 'year');
    if (w.explicitYear === null && year !== null && next.dueDayKey) {
      const heading = y.evidence.find((e) => e.kind === 'heading');
      const note = y.conflict ? `Year ${calendarYearOf(w.month, year, y.season)}: you chose it (the syllabus mentions ${y.options.join(' and ')})` : yearNote && !y.conflict ? yearNote.note : `Year ${calendarYearOf(w.month, year, y.season)} from ${heading ? heading.note.replace(/^The heading says /, '') : 'the syllabus'}`;
      next.inferences.push({ field: 'year', note });
    }
  }
  next.reasons = reasons;
  next.notes = notes.length ? notes : undefined;
  return next;
}

function placeYears(draft: ImportDraft): ImportDraft {
  const lectures = draft.insights.lectures ?? [];
  return { ...draft, items: draft.items.map((i) => placeItem(withWrittenDate(i), draft.years, lectures)) };
}

/** Student answers "which year is this course?" when the syllabus disagrees with itself. Their own date edits are kept. */
export function chooseDraftYear(draft: ImportDraft, year: number): ImportDraft {
  if (!draft.years.options.includes(year)) return draft;
  const years = { ...draft.years, chosen: year };
  return placeYears({ ...draft, years, insights: { ...draft.insights, years } });
}

/** Due day for a conditional deadline once its anchor is known. */
export function conditionalDueDay(rule: Pick<ConditionalDeadline, 'offsetDays' | 'direction'>, anchorDayKey: string): string {
  return addDays(anchorDayKey, rule.direction === 'before' ? -rule.offsetDays : rule.offsetDays);
}

/** Day of a listed lecture in the year being used (null until the year is known). */
export function lectureDayKey(years: YearAnalysis, lecture: Pick<LectureEntry, 'month' | 'day'>): string | null {
  const year = placementYear(years);
  return year === null ? null : termDayKey(lecture.month, lecture.day, year, years.season);
}

/** "Which lecture were you assigned?" Answer with a listed lecture or a date. */
export function resolveDraftConditional(draft: ImportDraft, key: string, answer: { lecture: number } | { dayKey: string; label?: string }): ImportDraft {
  const lectures = draft.insights.lectures ?? [];
  return {
    ...draft,
    items: draft.items.map((i) => {
      if (i.key !== key || !i.conditional) return i;
      if ('lecture' in answer) {
        const lec = lectures.find((l) => l.number === answer.lecture);
        if (!lec) return i;
        const anchorDayKey = lectureDayKey(draft.years, lec);
        const conditional: ConditionalDeadline = { ...i.conditional, anchorLecture: lec.number, anchorLabel: `Lecture ${lec.number}: ${lec.topic}`, anchorDayKey: anchorDayKey ?? undefined };
        return { ...i, conditional, dueDayKey: anchorDayKey ? conditionalDueDay(conditional, anchorDayKey) : null, dueTime: conditional.time, confidence: { ...i.confidence, due: anchorDayKey ? 'confirmed' : 'needsReview' }, reasons: anchorDayKey ? i.reasons.filter((r) => r !== 'conditional') : i.reasons };
      }
      const conditional: ConditionalDeadline = { ...i.conditional, anchorLecture: undefined, anchorLabel: answer.label ?? undefined, anchorDayKey: answer.dayKey };
      return { ...i, conditional, dueDayKey: conditionalDueDay(conditional, answer.dayKey), dueTime: conditional.time, confidence: { ...i.confidence, due: 'confirmed' }, reasons: i.reasons.filter((r) => r !== 'conditional') };
    }),
  };
}

export type AttentionItem =
  | { kind: 'year'; options: number[]; evidence: YearAnalysis['evidence'] }
  | { kind: 'conditional'; key: string; title: string; question: string }
  | { kind: 'choose'; key: string; title: string; options: string[] }
  | { kind: 'noDate'; key: string; title: string }
  | { kind: 'mismatch'; key: string; title: string; note: string }
  | { kind: 'grading'; total: number; missing: string[] };

/** What genuinely needs the student before the planner can use this syllabus (not diagnostics). */
export function draftAttention(draft: ImportDraft): AttentionItem[] {
  const out: AttentionItem[] = [];
  if (draft.years.conflict && draft.years.chosen == null) out.push({ kind: 'year', options: draft.years.options, evidence: draft.years.evidence });
  for (const i of draft.items) {
    if (!i.include || i.change === 'removed') continue;
    if (i.conditional && !i.dueDayKey) out.push({ kind: 'conditional', key: i.key, title: i.title, question: conditionalQuestion(i.conditional) });
    else if (i.dueOptions?.length && i.confidence.due !== 'confirmed') out.push({ kind: 'choose', key: i.key, title: i.title, options: i.dueOptions });
    else if (!i.dueDayKey && !i.recurrence && !i.reasons.some((r) => r === 'examPeriod' || r === 'tba' || r === 'yearConflict')) out.push({ kind: 'noDate', key: i.key, title: i.title });
    if (i.confidence.due !== 'confirmed') for (const note of i.notes ?? []) out.push({ kind: 'mismatch', key: i.key, title: i.title, note });
  }
  const g = draft.insights.grading;
  if (g && !g.addsUp && g.totalPercent < 100) {
    const missing = draft.items.filter((i) => i.include && i.change !== 'removed' && i.catalogKey && i.weightPercent === null).map((i) => i.title);
    out.push({ kind: 'grading', total: g.totalPercent, missing });
  }
  return out;
}

export function conditionalQuestion(c: Pick<ConditionalDeadline, 'anchorKind' | 'anchor'>): string {
  const what: Record<ConditionalDeadline['anchorKind'], string> = { lecture: 'Which lecture were you assigned?', presentation: 'When is your presentation?', lab: 'Which lab session are you in?', tutorial: 'Which tutorial are you in?', other: `When is ${c.anchor.replace(/^your\s+/i, 'your ')}?` };
  return what[c.anchorKind];
}

/** "Due 3 days before your assigned lecture, 11:59 PM." */
export function conditionalRuleText(c: Pick<ConditionalDeadline, 'offsetDays' | 'direction' | 'anchor'>): string {
  const n = c.offsetDays % 7 === 0 && c.offsetDays >= 7 ? `${c.offsetDays / 7} week${c.offsetDays === 7 ? '' : 's'}` : `${c.offsetDays} day${c.offsetDays === 1 ? '' : 's'}`;
  return `${n} ${c.direction} ${c.anchor}`;
}

/** Possible dates for an item whose year the student hasn't confirmed. */
function yearCandidates(item: DraftItem, years: YearAnalysis): { dayKey: string; time: string | null; note: string }[] {
  if (item.dueOptions?.length) return item.dueOptions.map((k) => ({ dayKey: k, time: item.dueTime, note: item.reasons.includes('yearConflict') ? `If the course runs in ${k.slice(0, 4)}` : 'Stated in the syllabus' }));
  const w = item.writtenDate;
  if (!w || !item.reasons.includes('yearConflict')) return [];
  return years.options.map((y) => ({ dayKey: termDayKey(w.month, w.day, y, years.season), time: item.dueTime, note: `If the course runs in ${calendarYearOf(w.month, y, years.season)}` }));
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
          const a: Assignment = { ...upd.assignment, syllabusId, estimatedMinutes: item.estimatedMinutes ?? existing.estimatedMinutes, ...academicFields(item, draft, dc.timezone, existing) };
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
          ...academicFields(item, draft, dc.timezone),
        };
        result.createdAssignmentIds.push(id);
      }
    }
  }
  return { state: next, ...result };
}

const confirmLikely = (c: ConfidenceLevel): ConfidenceLevel => (c === 'likely' ? 'confirmed' : c);

/** Weight, release date, exam window, coverage and inference notes from a reviewed item. Existing values the student set are kept. */
function academicFields(item: DraftItem, draft: ImportDraft, timezone: string, existing?: Assignment): Partial<Assignment> {
  const out: Partial<Assignment> = {};
  if (item.requirements?.length) out.requirements = item.requirements;
  if (item.submission) out.submission = item.submission;
  if (item.late) out.latePolicy = item.late;
  out.attentionNotes = item.notes?.length ? item.notes : undefined;
  // A deadline the student already placed (or edited) is theirs; the syllabus never resets it.
  const studentOwnsDue = Boolean(existing?.userOverrides.due || existing?.conditional?.anchorDayKey);
  if (item.conditional) out.conditional = studentOwnsDue && existing?.conditional ? existing.conditional : item.conditional;
  if (!item.dueDayKey && !item.recurrence && !studentOwnsDue) {
    const candidates = yearCandidates(item, draft.years);
    out.dueCandidates = candidates.length ? candidates : undefined;
  } else if (item.dueDayKey) out.dueCandidates = undefined;
  if (item.weightPercent !== null && existing?.weight === undefined) out.weight = item.weightPercent;
  if (item.availableDayKey && existing?.availableAt === undefined) out.availableAt = atMinute(item.availableDayKey, 0, timezone);
  if (item.window && !item.dueDayKey) out.window = { from: atMinute(item.window.from, 0, timezone), to: atMinute(item.window.to, 23 * 60 + 59, timezone) };
  if (!item.dueDayKey && !item.recurrence && !studentOwnsDue) out.unresolved = item.reasons.includes('examPeriod') ? 'examPeriod' : item.reasons.includes('tba') ? 'tba' : item.conditional ? 'conditional' : item.reasons.includes('yearConflict') || item.dueOptions?.length ? 'yearConflict' : undefined;
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
