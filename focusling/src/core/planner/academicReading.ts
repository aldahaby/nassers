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
    // Approval dates, publication cut-offs and citations are not course dates.
    const notCourseDate = /approved|senate|since|published|copyright|©|retrieved|accessed|https?:|\(\d{4}[,)]/i.test(l.text);
    for (const d of datesInLine(l.text)) {
      if (d.year === null || notCourseDate) continue;
      if (termYear !== null && Math.abs(academicYearOf(d.month, d.year, season) - termYear) > 1) continue;
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
  return summarizeYears({ termYear, season, options: [], conflict: false, evidence });
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
  /** Where the student finds their answer ("myCourses -> Groups -> Multiple Choice"). */
  anchorHint?: string | null;
  /** Assignable lectures start here ("assignments start with lecture 4"). */
  fromLecture?: number | null;
}

export interface DateMention {
  month: number;
  day: number;
  explicitYear: number | null;
  time: string | null;
  role: 'due' | 'release' | 'exam';
  /** 3: a "Deadline:" line; 2: the line talks about the deadline (due, by, written, table row); 1: a bare date. */
  priority: number;
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
  /** The item's own late rule ("A late penalty of 10% per day…"). */
  late: string | null;
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
  const trimmed = subtitle.replace(/\s+assignment$/i, '').trim();
  const named = trimmed && trimmed.length >= 2 && !/^\d+$/.test(trimmed) && !NOT_A_NAME.test(trimmed) && !coverage ? trimmed : null;
  // "Homework (8 x 4%) 32%": a category row, its weight is the last number.
  const category = !m[2] && /\d\s*x\s*\d/i.test(text);
  return { key, base, type: typeOf(m[1]!), subtitle: named ? trimmed : null, weight: weights.length ? Number(weights[weights.length - 1]![1]) : null, coverage, category, dated: datesInLine(text).length > 0 || EXAM_PERIOD.test(text) || TBA.test(text) };
}

const SECTION_BREAK = /^(grading scheme|rubric\b|total\s*:|late|use of|generative|academic integrity|plagiarism|policy|policies|lecture schedule|course schedule|schedule|calendar|evaluation|grading|assessments?|important dates|textbook|required (?:text|materials)|course (?:description|objectives|outcomes|materials)|office hours|contact|accommodations?|accessibility|resources|copyright|language of submission|mcgill)/i;

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

/** A line whose date is about something else: an approval, a citation, a link, a publication cut-off. */
export function isReferenceLine(text: string): boolean {
  return /\(\d{4},|https?:|retrieved|accessed|\bsenate\b|\bapproved\b|\bpublished\b|\bcopyright\b|©/i.test(text);
}

/** Dates that describe something else: "published since January 1, 2026", citations, approvals. */
const REFERENCE_BEFORE = /\b(since|published|after|approved|from|example|e\.g\.)\s*(?:on\s+)?$/i;

function datesFrom(text: string, provenance: SourceProvenance, type: AssignmentType): DateMention[] {
  const out: DateMention[] = [];
  const lower = text.toLowerCase();
  if (/\(\d{4},|https?:|retrieved|senate/i.test(text)) return out;
  const priority = /^\s*(deadline|due(?: date)?|date)\s*[:\-]/i.test(text) ? 3 : /\b(due|deadline|submit|upload|by|written|exam|held|takes place|in class)\b|\|/i.test(text) ? 2 : 1;
  for (const d of datesInLine(text)) {
    const at = lower.search(new RegExp(`\\b(${MONTHS.join('|')})[a-z]*\\.?\\s*${d.day}\\b|\\b${d.month}/${d.day}\\b|\\b${d.day}[-\\s](${MONTHS.join('|')})`));
    const before = at >= 0 ? lower.slice(Math.max(0, at - 30), at) : lower;
    if (REFERENCE_BEFORE.test(before.trim())) continue;
    const role: DateMention['role'] = RELEASE.test(before) && !/\bdue\b/.test(before) ? 'release' : type === 'exam' || type === 'quiz' ? 'exam' : 'due';
    out.push({ month: d.month, day: d.day, explicitYear: d.year, time: timeIn(text), role, priority, end: d.endDay ? { month: d.endMonth ?? d.month, day: d.endDay } : null, text, provenance });
  }
  return out;
}

/** Short names a syllabus uses for an item: "Literature assignment A" → "Lit A", "LitA", "Lit.A". */
function aliasOf(e: Pick<CatalogEntry, 'subtitle'>): RegExp | null {
  const m = e.subtitle ? /^([A-Za-z]{3,})\b.*?\b([A-D])$/.exec(e.subtitle.split(/[:(]/)[0]!.trim()) : null;
  return m ? new RegExp(`\\b${m[1]!.slice(0, 3)}\\.?\\s?${m[2]}\\b`, 'i') : null;
}

function sentencesOf(text: string): string[] {
  // Abbreviations aren't sentence ends ("(e.g. PowerPoint…", "i.e. found…").
  const guarded = text.replace(/\b(e\.g|i\.e|etc|vs|approx|incl)\./gi, (m) => m.replace(/\./g, '\u0000'));
  return guarded
    .split(/(?<=[.!?])\s+(?=[A-Z*"(])/)
    .map((s) => s.replace(/\u0000/g, '.').trim())
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
      e = { key: h.key, type: h.type, base: h.base, subtitle: null, title: h.base, weightPercent: null, weights: [], provenance: prov, dates: [], conditional: null, examPeriod: null, tba: false, tentative: false, requirements: [], submission: null, coverage: null, late: null };
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

  // Pass 2: lines elsewhere that name an entry ("The midterm will be written on…", "Deadline for
  // LitA short essay Nov 24"). A midterm or final described only in prose becomes an entry too.
  lines.forEach((l, i) => {
    const next = lines[i + 1];
    // A sentence wrapped onto the next line ("…written during the final" / "exam period.").
    const joined = next && !/[.!?]$/.test(l.text) && /^[a-z(]/.test(next.text) ? `${l.text} ${next.text}` : l.text;
    // Rules for every exam ("All exams will … multiple-choice questions", "Exams must be written in person").
    if (/^(?:all\s+)?exams\b/i.test(l.text)) {
      for (const e of entries.values()) if (e.type === 'exam') owned.set(e, [...(owned.get(e) ?? []), l]);
    }
    const dated = (t: string) => datesInLine(t).length > 0 || CONDITIONAL.test(t) || EXAM_PERIOD.test(t) || TBA.test(t);
    const claim = (e: CatalogEntry) => {
      const own = owned.get(e) ?? [];
      if (own.some((x) => x.text === l.text || x.text === joined)) return;
      const continues = joined !== l.text;
      owned.set(e, [...own, continues ? { text: joined, provenance: l.provenance } : l]);
    };
    let examClaimed = false;
    for (const m of l.text.matchAll(MENTION)) {
      const k = baseOf(m[1]!, m[2]);
      // "The final exam will cover material presented after the midterm": the line is about the
      // first exam it names, not every exam it mentions.
      if (/^(midterm|final|exam|test)/.test(k.key)) {
        if (examClaimed) continue;
        examClaimed = true;
      }
      let e = entries.get(k.key) ?? (k.key === 'midterm' ? entries.get('midterm1') : undefined);
      if (!e && /^(midterm|final)/.test(k.key) && dated(joined) && !/\b(miss|deferred|supplemental|if you)\b/i.test(l.text)) e = ensure({ ...k, type: 'exam', subtitle: null, weight: null, coverage: null, category: false, dated: true }, l.provenance);
      if (e && dated(joined)) claim(e);
    }
    for (const e of entries.values()) {
      const alias = aliasOf(e);
      if (alias && alias.test(l.text) && dated(l.text)) claim(e);
    }
  });

  // Category rows ("Homework (8 x 4%)") and an unnumbered row next to numbered ones are groups, not items.
  for (const e of [...entries.values()]) {
    const kindKey = e.key.replace(/[0-9A-Z]+$/, '');
    const numbered = e.key === kindKey && [...entries.keys()].some((k) => k !== e.key && k.startsWith(kindKey) && /\d$/.test(k));
    if (categories.has(e.key) || (numbered && !['final', 'midterm'].includes(e.key))) entries.delete(e.key);
  }

  const fromLecture = lines.map((l) => /\bstart(?:s|ing)? (?:with|at|from) lecture (\d{1,2})\b/i.exec(l.text)).find(Boolean);
  for (const e of entries.values()) {
    const own = owned.get(e) ?? [];
    if (!e.weights.length) {
      // "Value: 5% of final grade" inside the item's own section.
      const v = own.map((l) => /^(?:value|weight(?:ing)?|worth|grade value|percentage)\s*[:\-]?\s*(\d{1,3}(?:\.\d+)?)\s?%/i.exec(l.text)).find(Boolean);
      if (v) e.weights.push(Number(v[1]));
    }
    e.weightPercent = e.weights.length === 1 ? e.weights[0]! : e.weights.length ? e.weights[0]! : null;
    for (const l of own) {
      e.dates.push(...datesFrom(l.text, l.provenance, e.type));
      if (!e.conditional) {
        e.conditional = conditionalIn(l.text);
        if (e.conditional) {
          const hint = own.find((x) => /\b(?:lectures?|presentations?|groups?) (?:are|is) assigned\b|\bgroups? tab\b|->|→/i.test(x.text));
          e.conditional.anchorHint = hint ? hint.text.replace(/\s+/g, ' ').trim() : null;
          e.conditional.fromLecture = e.conditional.anchorKind === 'lecture' && fromLecture ? Number(fromLecture[1]) : null;
        }
      }
      if (EXAM_PERIOD.test(l.text)) {
        const ds = datesFrom(l.text, l.provenance, e.type);
        e.examPeriod = { text: l.text, start: ds[0] ?? null, end: ds[0]?.end ? { ...ds[0], month: ds[0].end.month, day: ds[0].end.day } : null };
        e.dates = e.dates.filter((d) => d.text !== l.text);
      }
      if (TBA.test(l.text)) e.tba = true;
      if (TENTATIVE.test(l.text)) e.tentative = true;
      const label = /^submission\s*:\s*(.+)$/i.exec(l.text);
      if (label) e.submission = label[1]!.trim();
      else if (SUBMISSION.test(l.text) && !/^submission\s*:/i.test(e.submission ?? '') && !own.some((x) => /^submission\s*:/i.test(x.text))) {
        const s = sentencesOf(l.text).find((x) => SUBMISSION.test(x));
        // A sentence naming the platform ("uploaded to myCourses") beats a generic "submit…".
        if (s && s.length <= 200 && (!e.submission || (PLATFORM.test(s) && !PLATFORM.test(e.submission)))) e.submission = s;
      }
      const cov = /\b(?:covers?|will cover)\s+((?:lectures?|weeks?|chapters?|ch\.|units?|modules?|material)\s+[\w\s,–&-]+?)(?:[.;]|\s+and\s+(?:will|is|are|must)\b|$)/i.exec(l.text);
      if (cov && !e.coverage) e.coverage = cov[1]!.trim();
    }
    // The best deadline evidence wins: a "Deadline:" line over a sentence about the deadline over a bare date.
    const top = Math.max(0, ...e.dates.map((d) => d.priority));
    e.dates = e.dates.filter((d) => d.priority >= Math.min(top, 2) || d.role === 'release').sort((a, b) => b.priority - a.priority);
    // Requirements: the section's own sentences (PDF line wraps joined back) that aren't the deadline.
    const paragraphs: string[] = [];
    for (const l of own) {
      const prev = paragraphs[paragraphs.length - 1];
      // A PDF line wrap continues mid-sentence: lowercase or "(" next, or a dangling comma/word before.
      const wraps = prev !== undefined && !/[.!?:]$/.test(prev) && (/^[a-z(&]/.test(l.text) || /(?:[,;&-]|\b(?:and|or|the|a|an|to|of|in|on|for|with|by|as|your|their))$/i.test(prev));
      if (wraps && !/^(\d+[.)]|[a-z][.)]|[-*•])\s/.test(l.text) && !/^[A-Z][A-Za-z ]{2,25}:/.test(l.text)) paragraphs[paragraphs.length - 1] = `${prev} ${l.text}`;
      else paragraphs.push(l.text);
    }
    for (const p of paragraphs) {
      if (/^(value|deadline|submission|due)\s*:/i.test(p)) continue;
      const lateRule = sentencesOf(p).find((x) => /\blate penalty|\bbank of extension|\blate\b.{0,30}(?:per day|deduct)/i.test(x));
      if (lateRule && !e.late) e.late = lateRule;
    }
    const seen = new Set<string>();
    for (const l of paragraphs.map((text) => ({ text }))) {
      if (/^(value|deadline|submission)\s*:/i.test(l.text) || /\/\d(?:\.\d+)?\b/.test(l.text)) continue;
      for (const s of sentencesOf(l.text)) {
        if (e.late && s === e.late) continue;
        if (/:$/.test(s) || /^instructions\b/i.test(s) && s.split(' ').length < 3) continue;
        // A fragment cut off by the page ("Students will be spread") isn't a requirement; labels are.
        if (!/[.!?)"]$/.test(s) && !/^[A-Z][A-Za-z ]{2,25}:/.test(s)) continue;
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

/** Whether text uses the entry's short name ("LitA" for "Literature assignment A"). */
export function entryAliasIn(e: Pick<CatalogEntry, 'subtitle'>, text: string): boolean {
  const a = aliasOf(e);
  return Boolean(a && a.test(text));
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
  // "The Research Proposal is due…": the sentence names the item.
  const subject = /^(?:[Tt]he|[Yy]our)\s+((?:[A-Z][\w-]*)(?:\s+[A-Z][\w-]*){0,4})(?:\s+(?:is|are|will be)\b|$)/.exec(title);
  if (subject) return subject[1]!;
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

// ── Lecture tables (PDF layout) ─────────────────────────────────────

const TABLE_ROW = /^(\s{0,10})(\d{1,2})[-\s](jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*\.?(?:\s+(?:lect(?:ure)?\.?|lec\.?)\s*(\d{1,2}))?\b(.*)$/i;
const LECT_ONLY = /^(\s*)(?:lect(?:ure)?\.?|lec\.?)\s*(\d{1,2})\b(.*)$/i;
/** Where the assignments column starts inside a topic line ("…Macromolecules Midterm Exam…"). */
const ASSIGNMENT_CUE = /\s(?=(?:lit\.?\s?[a-d]\b|midterm|deadline|fun facts?\b|q&a|quiz|final exam|assignment|due\b|lecture \d|\(fun))/gi;
const ASSIGNMENT_COLUMN = 44;

interface RawLine {
  raw: string;
  page: number;
  line: number;
}

const indentOf = (raw: string) => raw.length - raw.trimStart().length;

/** Text of a line that belongs to the topic column (cut where the assignments column starts). */
function topicPart(raw: string, from = 0): string {
  const start = Math.max(from, indentOf(raw));
  if (start >= ASSIGNMENT_COLUMN) return '';
  let cut = raw.length;
  for (const m of raw.matchAll(ASSIGNMENT_CUE)) {
    if (m.index !== undefined && m.index + 1 >= ASSIGNMENT_COLUMN - 4 && m.index > start) {
      cut = m.index;
      break;
    }
  }
  const gap = /\s{4,}\S/.exec(raw.slice(start));
  if (gap && start + gap.index + gap[0].length - 1 >= ASSIGNMENT_COLUMN - 4) cut = Math.min(cut, start + gap.index);
  return raw.slice(start, cut).trim();
}

/**
 * A lecture schedule laid out as a PDF table ("3-Sep  Thurs  Lect.1  Scientific Method"), where
 * a topic wraps onto the lines above and below its date and rows are separated by blank lines.
 * Rows without a lecture number (review sessions, breaks) are not lectures.
 */
export function lectureTableOf(text: string): LectureEntry[] {
  const blocks: RawLine[][] = [];
  let current: RawLine[] = [];
  let started = false;
  let stopped = false;
  normalizeText(text)
    .split('\f')
    .forEach((page, p) => {
      if (stopped) return;
      if (current.length) blocks.push(current);
      current = [];
      page.split('\n').forEach((raw, i) => {
        if (stopped) return;
        if (!raw.trim() || /^\s*\d{1,3}\s*$/.test(raw)) {
          if (current.length) blocks.push(current);
          current = [];
          return;
        }
        if (/^\s*date\s+day\b/i.test(raw)) {
          started = true;
          return;
        }
        if (TABLE_ROW.test(raw)) started = true;
        else if (started && indentOf(raw) < 10 && !LECT_ONLY.test(raw)) {
          stopped = true; // back to ordinary text
          return;
        }
        if (started) current.push({ raw, page: p + 1, line: i + 1 });
      });
    });
  if (current.length) blocks.push(current);

  const out: LectureEntry[] = [];
  for (const block of blocks) {
    const rowAt = block.findIndex((l) => TABLE_ROW.test(l.raw));
    if (rowAt < 0) continue;
    const m = TABLE_ROW.exec(block[rowAt]!.raw)!;
    let number = m[5] ? Number(m[5]) : null;
    const pieces: string[] = [];
    block.forEach((l, i) => {
      if (i === rowAt) {
        const inlineFrom = l.raw.length - m[6]!.length;
        const t = topicPart(l.raw, inlineFrom);
        if (t) pieces.push(t);
        return;
      }
      const lect = LECT_ONLY.exec(l.raw);
      if (lect) {
        number ??= Number(lect[2]);
        const t = topicPart(l.raw, l.raw.length - lect[3]!.length);
        if (t) pieces.push(t);
        return;
      }
      if (/^\s*module\s+\d/i.test(l.raw)) return;
      const t = topicPart(l.raw);
      if (t) pieces.push(t);
    });
    if (number === null) continue;
    const topic = pieces.join(' ').replace(/\s+/g, ' ').replace(/\s+([,:])/g, '$1').trim();
    if (!topic) continue;
    out.push({ number, month: MONTHS.indexOf(m[3]!.toLowerCase().slice(0, 3)) + 1, day: Number(m[2]), weekday: WD[m[4]!.toLowerCase()] ?? null, topic, provenance: { page: block[rowAt]!.page, line: block[rowAt]!.line } });
  }
  return out.length >= 3 ? out : [];
}

/** The lecture list's weekdays as year evidence ("Tue Sep 1" is a Tuesday only in 2026). */
export function withLectureEvidence(years: YearAnalysis, lectures: LectureEntry[]): YearAnalysis {
  const dated = lectures.filter((l) => l.weekday !== null);
  if (dated.length < 3 || years.termYear === null) return years;
  const candidates = [years.termYear - 1, years.termYear, years.termYear + 1];
  const fits = candidates.map((ay) => dated.filter((l) => weekdayOf(calendarYearOf(l.month, ay, years.season), l.month, l.day) === l.weekday).length);
  const best = fits.indexOf(Math.max(...fits));
  if (fits[best]! < dated.length * 0.7 || fits.filter((f) => f === fits[best]).length > 1) return years;
  const ay = candidates[best]!;
  const eg = dated.find((l) => weekdayOf(calendarYearOf(l.month, ay, years.season), l.month, l.day) === l.weekday)!;
  const evidence: YearEvidence[] = [...years.evidence, { year: ay, kind: 'weekday', note: `The lecture schedule’s weekdays fit ${calendarYearOf(eg.month, ay, years.season)} (${fits[best]} of ${dated.length} lectures, e.g. ${WEEKDAY_NAME[eg.weekday!]}, ${MONTH_NAME[eg.month - 1]} ${eg.day})`, provenance: eg.provenance }];
  return summarizeYears({ ...years, evidence });
}

/** Options, conflict and the year most of the dated evidence points to. */
function summarizeYears(y: YearAnalysis): YearAnalysis {
  const options = [...new Set(y.evidence.map((e) => e.year))].sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (const e of y.evidence) if (e.kind !== 'heading') counts.set(e.year, (counts.get(e.year) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const suggested = ranked.length && (ranked.length === 1 || ranked[0]![1] > ranked[1]![1]) ? ranked[0]![0] : null;
  return { ...y, options, conflict: options.length > 1, suggested: options.length > 1 ? suggested : null };
}
