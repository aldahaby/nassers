import type { AssignmentType, LectureEntry, SourceProvenance, TermSeason, YearAnalysis, YearEvidence } from '../models';
import { datesInLine, normalizeText, normalizeTitle, TERM_RE } from './syllabusParser';

/**
 * Academic reading (Syllabus Intelligence rebuild). Works on the syllabus as
 * a student would: it finds the named assessments (from headings and the
 * grading list), reads each one's own section for its deadline, requirements
 * and submission method, notices deadlines that depend on the student
 * ("three days before your assigned lecture"), and checks whether the
 * document's years agree. Everything is evidence-backed; nothing is guessed.
 */

export interface ReadLine {
  text: string;
  provenance: SourceProvenance;
}

export function readLines(text: string): ReadLine[] {
  const out: ReadLine[] = [];
  normalizeText(text)
    .split('\f')
    .forEach((page, p) =>
      page.split('\n').forEach((raw, i) => {
        const t = raw.trim();
        if (t) out.push({ text: t, provenance: { page: p + 1, line: i + 1 } });
      }),
    );
  return out;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAY = /\b(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*\.?,?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(,?\s*(\d{4}))?/gi;
const WD: Record<string, number> = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
const weekdayOf = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
const WEEKDAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAME = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Term-start ("academic") year for a calendar date in a term: January of a Fall term belongs to the previous fall. */
export function academicYearOf(month: number, calendarYear: number, season: TermSeason | null): number {
  if (season === 'fall' && month <= 4) return calendarYear - 1;
  if (season === 'winter' && month === 12) return calendarYear + 1;
  return calendarYear;
}

/** Calendar year of a month in a term that starts in `academicYear`. */
export function calendarYearOf(month: number, academicYear: number, season: TermSeason | null): number {
  if (season === 'fall' && month <= 4) return academicYear + 1;
  if (season === 'winter' && month === 12) return academicYear - 1;
  return academicYear;
}

export function termDayKey(month: number, day: number, academicYear: number, season: TermSeason | null): string {
  return `${calendarYearOf(month, academicYear, season)}-${pad2(month)}-${pad2(day)}`;
}

// ── Year analysis ───────────────────────────────────────────────────

export function analyzeYears(lines: ReadLine[]): YearAnalysis {
  const termLine = lines.map((l) => ({ l, m: TERM_RE.exec(l.text) })).find((x) => x.m);
  const season = termLine ? (termLine.m![1]!.toLowerCase().replace('autumn', 'fall') as TermSeason) : null;
  const termYear = termLine ? Number(termLine.m![2]) : null;
  const evidence: YearEvidence[] = [];
  if (termLine && termYear !== null) evidence.push({ year: termYear, kind: 'heading', note: `The heading says “${termLine.m![0]}”`, provenance: termLine.l.provenance });

  for (const l of lines) {
    if (TERM_RE.test(l.text) && l === termLine?.l) continue;
    // Dates written with a year.
    for (const d of datesInLine(l.text)) {
      if (d.year === null) continue;
      const ay = academicYearOf(d.month, d.year, season);
      evidence.push({ year: ay, kind: 'explicitDate', note: `“${MONTH_NAME[d.month - 1]} ${d.day}, ${d.year}” is written with a year`, provenance: l.provenance });
    }
    // Weekday + date with no year: which nearby year makes the weekday true?
    for (const m of l.text.matchAll(WEEKDAY)) {
      if (m[5]) continue;
      const wd = WD[m[1]!.toLowerCase()];
      const month = MONTHS.indexOf(m[2]!.toLowerCase().slice(0, 3)) + 1;
      const day = Number(m[3]);
      if (wd === undefined || month < 1) continue;
      const base = termYear ?? null;
      if (base === null) continue;
      const matches = [base - 1, base, base + 1].filter((ay) => weekdayOf(calendarYearOf(month, ay, season), month, day) === wd);
      if (matches.length === 1) {
        const ay = matches[0]!;
        evidence.push({ year: ay, kind: 'weekday', note: `“${WEEKDAY_NAME[wd]}, ${MONTH_NAME[month - 1]} ${day}” is a ${WEEKDAY_NAME[wd]} in ${calendarYearOf(month, ay, season)}`, provenance: l.provenance });
      }
    }
  }
  const options = [...new Set(evidence.map((e) => e.year))].sort((a, b) => a - b);
  return { termYear, season, options, conflict: options.length > 1, evidence };
}

/** Does a weekday written next to a date match it in the chosen year? */
export function weekdayMismatch(text: string, month: number, day: number, academicYear: number, season: TermSeason | null): string | null {
  for (const m of text.matchAll(WEEKDAY)) {
    const mm = MONTHS.indexOf(m[2]!.toLowerCase().slice(0, 3)) + 1;
    if (mm !== month || Number(m[3]) !== day) continue;
    const wd = WD[m[1]!.toLowerCase()];
    const y = calendarYearOf(month, academicYear, season);
    const actual = weekdayOf(y, month, day);
    if (wd !== undefined && wd !== actual) return `The syllabus says ${WEEKDAY_NAME[wd]}, but ${MONTH_NAME[month - 1]} ${day}, ${y} is a ${WEEKDAY_NAME[actual]}.`;
  }
  return null;
}

// ── Assessment catalog ──────────────────────────────────────────────

const KIND = '(assignment|homework|hw|problem\\s+set|lab\\s+report|lab|quiz|project|term\\s+paper|paper|essay|report|presentation|coursework|mid-?term(?:\\s+exam(?:ination)?)?|final\\s+exam(?:ination)?|final(?!\\s+(?:project|paper|report|essay|presentation|grade|mark|draft|submission))|exam(?:ination)?|test)';
const HEAD = new RegExp(`^${KIND}\\s*(?:#\\s*)?(\\d{1,2}|[A-D](?![a-z])|I{1,3}V?(?![a-z]))?\\s*(?:[:\\-–—]\\s*|\\(|\\s*\\|\\s*|\\s+(?=\\d{1,3}(?:\\.\\d+)?\\s?%)|$)(.*)$`, 'i');
const MENTION = new RegExp(`\\b${KIND}\\s*(?:#\\s*)?(\\d{1,2}|[A-D](?![a-z])|I{1,3}V?(?![a-z]))?\\b`, 'gi');

export interface ConditionalRule {
  offsetDays: number;
  direction: 'before' | 'after';
  /** What the date depends on, in the syllabus's words ("your assigned lecture"). */
  anchor: string;
  anchorKind: 'lecture' | 'presentation' | 'lab' | 'tutorial' | 'other';
  time: string | null;
}

export interface DateMention {
  month: number;
  day: number;
  explicitYear: number | null;
  time: string | null;
  role: 'due' | 'release' | 'exam';
  /** Exam window end (exam periods). */
  end?: { month: number; day: number } | null;
  text: string;
  provenance: SourceProvenance;
}

export interface CatalogEntry {
  key: string;
  type: AssignmentType;
  /** "Assignment 4", "Midterm Exam", "Final Exam". */
  base: string;
  /** The syllabus's own name for it ("Literature Assignment B – Video"), if any. */
  subtitle: string | null;
  title: string;
  weightPercent: number | null;
  weights: number[];
  provenance: SourceProvenance;
  dates: DateMention[];
  conditional: ConditionalRule | null;
  examPeriod: { text: string; end: DateMention | null; start: DateMention | null } | null;
  tba: boolean;
  tentative: boolean;
  requirements: string[];
  submission: string | null;
  coverage: string | null;
}

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14, '24 hours': 1, '48 hours': 2 };
const CONDITIONAL = /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen)\s+(day|week)s?\s+(before|after|prior to|following)\s+((?:your|the|each student'?s|their)\s+(?:own\s+)?(?:assigned|scheduled|chosen|selected|designated)?\s*(lecture|presentation|class|tutorial|lab|session|seminar|group meeting|talk))/i;
const EXAM_PERIOD = /\b(?:final\s+)?exam(?:ination)?s?\s+period\b|\bfinals?\s+(?:period|week)\b|\bdate\s+(?:will be\s+)?(?:set|scheduled|published)\s+by\b|\bofficial\s+(?:final\s+)?exam(?:ination)?\s+schedule\b/i;
const TBA = /\b(tba|tbd|to be announced|to be determined|to be confirmed|date to be published)\b/i;
const TENTATIVE = /\b(tentative|subject to change|provisional)\b/i;
const RELEASE = /\b(released?|available|posted|assigned|opens?|handed out)\b/i;
const PLATFORM = /\b(mycourses|canvas|moodle|brightspace|d2l|blackboard|gradescope|crowdmark|turnitin|e-?mail(?:ed)? to)\b/i;
const SUBMISSION = /\b(mycourses|canvas|moodle|brightspace|d2l|blackboard|gradescope|crowdmark|turnitin|upload(?:ed)?|submit(?:ted)?|hand(?:ed)? in|e-?mail(?:ed)? to)\b/i;

function typeOf(kind: string): AssignmentType {
  const k = kind.toLowerCase();
  if (/mid-?term|final|exam|test/.test(k)) return 'exam';
  if (k.startsWith('quiz')) return 'quiz';
  if (k.startsWith('lab')) return 'lab';
  if (k.startsWith('project')) return 'project';
  if (/paper|essay|report/.test(k)) return 'paper';
  if (k.startsWith('presentation')) return 'presentation';
  return 'assignment';
}

function baseOf(kind: string, num: string | undefined): { key: string; base: string } {
  const k = kind.toLowerCase().replace(/\s+/g, ' ');
  const n = num ? num.toUpperCase() : '';
  if (/mid-?term/.test(k)) return { key: `midterm${n}`, base: n ? `Midterm ${n}` : 'Midterm Exam' };
  if (k.startsWith('final')) return { key: 'final', base: 'Final Exam' };
  if (/^exam/.test(k)) return { key: `exam${n}`, base: n ? `Exam ${n}` : 'Exam' };
  if (k === 'test') return { key: `test${n}`, base: n ? `Test ${n}` : 'Test' };
  const pretty: Record<string, string> = { hw: 'Homework', homework: 'Homework', assignment: 'Assignment', 'problem set': 'Problem Set', 'lab report': 'Lab Report', lab: 'Lab', quiz: 'Quiz', project: 'Project', 'term paper': 'Term Paper', paper: 'Paper', essay: 'Essay', report: 'Report', presentation: 'Presentation', coursework: 'Coursework' };
  const word = pretty[k] ?? k[0]!.toUpperCase() + k.slice(1);
  const keyWord = k === 'hw' ? 'homework' : k.replace(/\s+/g, '');
  return { key: `${keyWord}${n}`, base: n ? `${word} ${n}` : word };
}

const cleanSub = (s: string) => {
  const out = s
    .split('|')[0]!
    .replace(/\(\s*\d{1,3}(?:\.\d+)?\s?%\s*\)/g, ' ')
    .replace(/\b\d{1,3}(?:\.\d+)?\s?%(\s*of\s+(the\s+)?(final\s+)?grade)?/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:–—-]+|[\s:–—,.-]+$/g, '')
    .trim();
  // Unbalanced or wrapping parentheses: "(video)" → "video", "problem set)" → "problem set".
  const open = (out.match(/\(/g) ?? []).length;
  const close = (out.match(/\)/g) ?? []).length;
  const bare = open !== close || /^\(.*\)$/.test(out) ? out.replace(/^\(|\)$/g, '').replace(open !== close ? /[()]/g : /$^/, '').trim() : out;
  return bare ? bare[0]!.toUpperCase() + bare.slice(1) : bare;
};

/** Subtitle text that is really a date, a timing note or a coverage note, not a name. */
const NOT_A_NAME = /\b(due|in class|during|tentative|tba|tbd|to be|period|deadline|date|covers?)\b|\d{1,2}\/\d{1,2}|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d|\d\s*x\s*\d/i;
const COVERAGE_NAME = /^(?:ch(?:apters?|\.)?|weeks?|lectures?|units?|modules?)\s*\d/i;

/** A line that reads like a sentence rather than a heading. */
const SENTENCE = /\b(will|must|should|is|are|be|was|were|has|have|can|may)\b/i;

interface Heading {
  key: string;
  base: string;
  type: AssignmentType;
  subtitle: string | null;
  weight: number | null;
  coverage: string | null;
  category: boolean;
  dated: boolean;
}

function headingOf(text: string): Heading | null {
  const m = HEAD.exec(text);
  if (!m) return null;
  const rest = m[3] ?? '';
  if (text.length > 110) return null;
  // "Final exam" alone, "Assignment 3: Literature Assignment A (15%)", "Midterm exam 20%". Not "Final exams are…".
  if (SENTENCE.test(rest.split(/[.;]/)[0] ?? '') && rest.length > 30) return null;
  if (!m[2] && /^(exam(?:ination)?|test|project|paper|essay|report|presentation|lab|quiz)$/i.test(m[1]!.trim()) && rest && !/%|^\(|^[:–—-]/.test(text.slice(m[1]!.length).trim())) return null;
  const { key, base } = baseOf(m[1]!, m[2]);
  const weights = [...text.matchAll(/(\d{1,3}(?:\.\d+)?)\s?%/g)];
  const subtitle = cleanSub(rest);
  const coverage = COVERAGE_NAME.test(subtitle) ? subtitle : null;
  const named = subtitle && subtitle.length >= 2 && !/^\d+$/.test(subtitle) && !NOT_A_NAME.test(subtitle) && !coverage ? subtitle : null;
  // "Homework (8 x 4%) 32%": a category row, its weight is the last number.
  const category = !m[2] && /\d\s*x\s*\d/i.test(text);
  return { key, base, type: typeOf(m[1]!), subtitle: named, weight: weights.length ? Number(weights[weights.length - 1]![1]) : null, coverage, category, dated: datesInLine(text).length > 0 || EXAM_PERIOD.test(text) || TBA.test(text) };
}

const SECTION_BREAK = /^(late|use of|generative|academic integrity|plagiarism|policy|policies|lecture schedule|course schedule|schedule|calendar|evaluation|grading|assessments?|important dates|textbook|required (?:text|materials)|course (?:description|objectives|outcomes|materials)|office hours|contact|accommodations?|accessibility|resources|copyright|language of submission|mcgill)/i;

function timeIn(text: string): string | null {
  const m = /\b(\d{1,2})(?::(\d{2}))?\s*(?:[–—-]\s*\d{1,2}(?::\d{2})?\s*)?(a\.?m\.?|p\.?m\.?)/i.exec(text);
  if (m) {
    let h = Number(m[1]);
    const pm = m[3]!.toLowerCase().startsWith('p');
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    return `${pad2(h)}:${pad2(Number(m[2] ?? 0))}`;
  }
  if (/\bmidnight\b/i.test(text)) return '23:59';
  if (/\bnoon\b/i.test(text)) return '12:00';
  const h24 = /\b(?:at|by)\s+([01]?\d|2[0-3]):([0-5]\d)\b/.exec(text);
  return h24 ? `${pad2(Number(h24[1]))}:${h24[2]}` : null;
}

export function conditionalIn(text: string): ConditionalRule | null {
  const m = CONDITIONAL.exec(text);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]!) ? Number(m[1]) : NUMBER_WORDS[m[1]!.toLowerCase()] ?? null;
  if (!n) return null;
  const days = m[2]!.toLowerCase().startsWith('week') ? n * 7 : n;
  const dir = /before|prior/i.test(m[3]!) ? 'before' : 'after';
  const what = m[5]!.toLowerCase();
  return { offsetDays: days, direction: dir, anchor: m[4]!.replace(/\s+/g, ' ').trim(), anchorKind: what === 'lecture' || what === 'class' || what === 'talk' ? 'lecture' : what === 'presentation' ? 'presentation' : what === 'lab' ? 'lab' : what === 'tutorial' ? 'tutorial' : 'other', time: timeIn(text) };
}

function datesFrom(text: string, provenance: SourceProvenance, type: AssignmentType): DateMention[] {
  const out: DateMention[] = [];
  const lower = text.toLowerCase();
  for (const d of datesInLine(text)) {
    const at = lower.search(new RegExp(`\\b(${MONTHS.join('|')})[a-z]*\\.?\\s+${d.day}\\b|\\b${d.month}/${d.day}\\b`));
    const before = at >= 0 ? lower.slice(Math.max(0, at - 30), at) : lower;
    const role: DateMention['role'] = RELEASE.test(before) && !/\bdue\b/.test(before) ? 'release' : type === 'exam' || type === 'quiz' ? 'exam' : 'due';
    out.push({ month: d.month, day: d.day, explicitYear: d.year, time: timeIn(text), role, end: d.endDay ? { month: d.endMonth ?? d.month, day: d.endDay } : null, text, provenance });
  }
  return out;
}

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Named assessments, from headings and the grading list. Each entry gathers
 * its own section (lines up to the next heading) for dates, requirements and
 * submission method, plus any other line that names it ("the midterm…").
 */
export function buildCatalog(lines: ReadLine[]): CatalogEntry[] {
  const entries = new Map<string, CatalogEntry>();
  const categories = new Set<string>();
  const ensure = (h: NonNullable<ReturnType<typeof headingOf>>, prov: SourceProvenance) => {
    let e = entries.get(h.key);
    if (!e) {
      e = { key: h.key, type: h.type, base: h.base, subtitle: null, title: h.base, weightPercent: null, weights: [], provenance: prov, dates: [], conditional: null, examPeriod: null, tba: false, tentative: false, requirements: [], submission: null, coverage: null };
      entries.set(h.key, e);
    }
    if (h.subtitle && (!e.subtitle || h.subtitle.length > e.subtitle.length)) e.subtitle = h.subtitle;
    if (h.weight !== null && !e.weights.includes(h.weight)) e.weights.push(h.weight);
    if (h.coverage && !e.coverage) e.coverage = h.coverage;
    if (h.category) categories.add(h.key);
    return e;
  };

  // Pass 1: headings define entries and own the lines below them.
  let current: CatalogEntry | null = null;
  const owned = new Map<CatalogEntry, ReadLine[]>();
  for (const l of lines) {
    const h = headingOf(l.text);
    if (h) {
      current = ensure(h, l.provenance);
      const rest = l.text.slice(l.text.search(/[:–—(]/) + 1);
      // A heading that carries its own sentence or date ("Final exam: during the exam period…",
      // "Midterm Exam: October 21, in class") is a one-line statement: it owns only itself.
      if (h.dated || (/[:–—]/.test(l.text) && SENTENCE.test(rest))) owned.set(current, [...(owned.get(current) ?? []), l]);
      if (h.dated) current = null;
      continue;
    }
    if (current && (SECTION_BREAK.test(l.text) && l.text.length < 60)) current = null;
    // A line about a different numbered item ("Coursework 1 deadline: …") isn't this section's.
    if (current && mentionsOther(l.text, current.key)) continue;
    if (current) owned.set(current, [...(owned.get(current) ?? []), l]);
  }

  // Pass 2: lines elsewhere that name an entry ("The midterm will be written on…").
  for (const l of lines) {
    for (const m of l.text.matchAll(MENTION)) {
      const { key } = baseOf(m[1]!, m[2]);
      const e = entries.get(key) ?? (key === 'midterm' ? entries.get('midterm1') : undefined);
      if (!e) continue;
      const own = owned.get(e) ?? [];
      if (!own.includes(l) && (datesInLine(l.text).length || CONDITIONAL.test(l.text) || EXAM_PERIOD.test(l.text) || TBA.test(l.text))) owned.set(e, [...own, l]);
    }
  }

  // Category rows ("Homework (8 x 4%)") and an unnumbered row next to numbered ones are groups, not items.
  for (const e of [...entries.values()]) {
    const kindKey = e.key.replace(/[0-9A-Z]+$/, '');
    const numbered = e.key === kindKey && [...entries.keys()].some((k) => k !== e.key && k.startsWith(kindKey) && /\d$/.test(k));
    if (categories.has(e.key) || (numbered && !['final', 'midterm'].includes(e.key))) entries.delete(e.key);
  }

  for (const e of entries.values()) {
    const own = owned.get(e) ?? [];
    e.weightPercent = e.weights.length === 1 ? e.weights[0]! : e.weights.length ? e.weights[0]! : null;
    for (const l of own) {
      e.dates.push(...datesFrom(l.text, l.provenance, e.type));
      e.conditional ??= conditionalIn(l.text);
      if (EXAM_PERIOD.test(l.text)) {
        const ds = datesFrom(l.text, l.provenance, e.type);
        e.examPeriod = { text: l.text, start: ds[0] ?? null, end: ds[0]?.end ? { ...ds[0], month: ds[0].end.month, day: ds[0].end.day } : null };
        e.dates = e.dates.filter((d) => d.text !== l.text);
      }
      if (TBA.test(l.text)) e.tba = true;
      if (TENTATIVE.test(l.text)) e.tentative = true;
      if (SUBMISSION.test(l.text)) {
        const s = sentencesOf(l.text).find((x) => SUBMISSION.test(x));
        // A sentence naming the platform ("uploaded to myCourses") beats a generic "submit…".
        if (s && s.length <= 200 && (!e.submission || (PLATFORM.test(s) && !PLATFORM.test(e.submission)))) e.submission = s;
      }
      const cov = /\bcovers?\s+((?:lectures?|weeks?|chapters?|ch\.|units?|modules?)\s+[\w\s,–-]+?)(?:[.;]|$)/i.exec(l.text);
      if (cov) e.coverage = cov[1]!.trim();
    }
    // Requirements: the section's own sentences that aren't just the deadline.
    const seen = new Set<string>();
    for (const l of own) {
      for (const s of sentencesOf(l.text)) {
        if (s.length < 12 || s.length > 220) continue;
        if (datesInLine(s).length || CONDITIONAL.test(s) || EXAM_PERIOD.test(s) || TBA.test(s)) continue;
        if (headingOf(s)) continue;
        // Grading rows and labels aren't requirements.
        if (/%/.test(s) && s.split(/\s+/).length < 9) continue;
        if (s.split(/\s+/).length < 4) continue;
        const k = normalizeTitle(s);
        if (seen.has(k)) continue;
        seen.add(k);
        e.requirements.push(s);
      }
    }
    e.requirements = e.requirements.slice(0, 6);
    e.title = e.subtitle ? `${e.base} — ${e.subtitle}` : e.base;
  }
  return [...entries.values()];
}

function mentionsOther(text: string, key: string): boolean {
  for (const m of text.matchAll(MENTION)) {
    const other = baseOf(m[1]!, m[2]).key;
    if (other === key || (key === 'midterm1' && other === 'midterm')) continue;
    if (m[2] && /\d/.test(m[2])) return true;
    if (/^(final|midterm)/.test(other) && /^(final|midterm)/.test(key)) return true;
  }
  return false;
}

/** Aliases a free-text line may use for an entry. */
export function entryMentionedIn(e: CatalogEntry, text: string): boolean {
  for (const m of text.matchAll(MENTION)) {
    const { key } = baseOf(m[1]!, m[2]);
    if (key === e.key || (e.key === 'midterm1' && key === 'midterm')) return true;
  }
  return Boolean(e.subtitle && e.subtitle.length > 6 && normalizeTitle(text).includes(normalizeTitle(e.subtitle)));
}

/**
 * Student-facing title for an item whose title came from a sentence:
 * "uploaded to myCourses Assignment 4 tab" → "Assignment 4",
 * "The midterm will be written" → "Midterm Exam". Clean titles pass through.
 */
export function cleanItemTitle(title: string, type: AssignmentType): string {
  const words = title.split(/\s+/).filter(Boolean);
  const sentence = words.length >= 7 || /^(the|your|this|all|each|students?|you|it|please|submit|upload|uploaded|due)\b/i.test(title) || SENTENCE.test(title);
  if (!sentence) return title;
  const m = new RegExp(`\\b${KIND}\\s*(?:#\\s*)?(\\d{1,2}|[A-D](?![a-z])|I{1,3}V?(?![a-z]))?\\b`, 'i').exec(title);
  if (m) return baseOf(m[1]!, m[2]).base;
  const defaults: Record<AssignmentType, string> = { assignment: 'Assignment', exam: 'Exam', quiz: 'Quiz', paper: 'Paper', project: 'Project', reading: 'Reading', lab: 'Lab', presentation: 'Presentation', review: 'Review', other: 'Course item' };
  return defaults[type];
}

// ── Lectures ────────────────────────────────────────────────────────

const LECTURE_SECTION = /^(lecture schedule|lecture topics|course schedule|class schedule|schedule of (?:lectures|topics)|course calendar|tentative schedule|weekly schedule|topics)\b/i;

/** Dated lectures from a lecture schedule ("Tuesday, September 2 | Introduction: What is life?"). */
export function lecturesOf(lines: ReadLine[]): LectureEntry[] {
  const out: LectureEntry[] = [];
  let inSection = false;
  for (const l of lines) {
    if (LECTURE_SECTION.test(l.text)) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;
    const m = /^(?:(?:lecture|class|lec\.?)\s*(\d{1,2})\s*[|:\-–]\s*)?(?:(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*\.?,?\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*[|:\-–—]\s*(.+)$/i.exec(l.text);
    if (!m) {
      if (out.length && l.text.length < 60 && !/\d/.test(l.text) && /^[A-Z]/.test(l.text)) inSection = false;
      continue;
    }
    const topic = m[5]!.replace(/\s*\|\s*/g, ' · ').trim();
    if (!topic || /\b(no class|holiday|reading week|study break)\b/i.test(topic)) continue;
    out.push({ number: m[1] ? Number(m[1]) : out.length + 1, month: MONTHS.indexOf(m[3]!.toLowerCase().slice(0, 3)) + 1, day: Number(m[4]), weekday: m[2] ? WD[m[2].toLowerCase()] ?? null : null, topic, provenance: l.provenance });
  }
  return out;
}
