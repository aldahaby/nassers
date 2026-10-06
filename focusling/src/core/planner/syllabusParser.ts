import { DEFAULT_NUMERIC_DATE_ORDER, DUE_WORDS, NON_WORK_WORDS, PARSER_VERSION, TBA_WORDS, TYPE_KEYWORDS, VAGUE_TIMING_WORDS, type ParserVersion } from '@/config/planner';
import { sha256Hex } from '../shared/sha256';
import type { AssignmentType, ConfidenceLevel, ReviewReason, SourceProvenance, Timestamp } from '../models';
import { toWallClock } from './time';

/**
 * Deterministic, on-device syllabus parser (no network, no AI). Pipeline:
 * normalise → find candidate lines/cells → parse dates/times → infer years →
 * dedupe → attach confidence and provenance. Output is a set of candidates
 * that a student must review; nothing here schedules anything.
 *
 * The parser never logs text. Snippets exist only in the returned object,
 * which the app keeps in memory during review.
 */

export interface ParseInput {
  /** Extracted text. Pages are separated by form feeds (\f). */
  text: string;
  timezone: string;
  /** When the import happens; only used as a last-resort year anchor. */
  referenceAt: Timestamp;
  parserVersion?: ParserVersion;
}

export interface CourseGuess {
  name: string | null;
  code: string | null;
  term: string | null;
}

export interface Candidate {
  key: string;
  courseIndex: number;
  title: string;
  normalizedTitle: string;
  type: AssignmentType;
  typeConfidence: ConfidenceLevel;
  dueDayKey: string | null;
  /** "HH:MM" 24-hour, or null for a date-only due date. */
  dueTime: string | null;
  dateConfidence: ConfidenceLevel;
  timeConfidence: ConfidenceLevel | null;
  /** Conflicting dates found for the same item (student picks one). */
  dueOptions?: string[];
  recurrence?: { weekday: number; time: string | null };
  reasons: ReviewReason[];
  provenance: SourceProvenance[];
  /** In-memory review context only; never persisted. */
  snippet: string;
  overall: ConfidenceLevel;
}

export interface ParseResult {
  parserVersion: string;
  contentHash: string;
  courses: CourseGuess[];
  candidates: Candidate[];
  pageCount: number;
  lineCount: number;
  /** First and last dates found in the document (bounds weekly recurrences). */
  dateRange: { first: string; last: string } | null;
  yearAnchor: 'term' | 'explicit' | 'none';
}

// ── Normalisation ───────────────────────────────────────────────────

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[   ]/g, ' ')
    .replace(/[•●▪‣⁃]/g, '-')
    .split('\n')
    .map((l) => l.replace(/[ ]+$/g, ''))
    .join('\n');
}

/** Hash of the normalised text with whitespace collapsed (re-extraction with different spacing hashes the same). */
export function contentHashOf(text: string): string {
  return sha256Hex(
    normalizeText(text)
      .replace(/\f/g, '\n')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Dates and times ─────────────────────────────────────────────────

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_RE = '(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';

interface DateMatch {
  start: number;
  end: number;
  month: number;
  day: number;
  year: number | null;
  range: boolean;
  weekOf: boolean;
  numeric: boolean;
}

/** Repairs common OCR confusions inside date-looking tokens. Returns the repaired line and whether anything changed. */
export function repairOcrDates(line: string): { line: string; repaired: boolean } {
  let repaired = false;
  let out = line.replace(/\b0ct(ober)?\b/gi, (m) => {
    repaired = true;
    return 'O' + m.slice(1);
  });
  // Digit-like tokens next to a month name or slash: O→0, l/I/|→1.
  out = out.replace(new RegExp(`(${MONTH_RE}\\.?\\s+)([0-9OolI|]{1,2})(?![a-z])`, 'gi'), (_m, pre: string, _mon: string, num: string) => {
    const fixed = num.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1');
    if (fixed !== num) repaired = true;
    return pre + fixed;
  });
  out = out.replace(/\b([0-9OolI]{1,2})\/([0-9OolI]{1,2})\b/g, (m, a: string, b: string) => {
    if (!/[0-9]/.test(a + b)) return m;
    const fa = a.replace(/[Oo]/g, '0').replace(/[lI]/g, '1');
    const fb = b.replace(/[Oo]/g, '0').replace(/[lI]/g, '1');
    if (fa + fb !== a + b) repaired = true;
    return `${fa}/${fb}`;
  });
  return { line: out, repaired };
}

function findDates(line: string, numericOrder: 'MDY' | 'DMY'): DateMatch[] {
  const found: DateMatch[] = [];
  const taken = (s: number, e: number) => found.some((f) => s < f.end && e > f.start);
  const lower = line.toLowerCase();
  const weekOfBefore = (idx: number) => /week\s+of\s*$/i.test(line.slice(Math.max(0, idx - 10), idx));

  for (const m of lower.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) {
    found.push({ start: m.index!, end: m.index! + m[0].length, year: Number(m[1]), month: Number(m[2]), day: Number(m[3]), range: false, weekOf: weekOfBefore(m.index!), numeric: true });
  }
  const monthFirst = new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*-\\s*(?:${MONTH_RE}\\.?\\s+)?(\\d{1,2})(?:st|nd|rd|th)?)?(?:,?\\s+(\\d{4}))?\\b`, 'g');
  for (const m of lower.matchAll(monthFirst)) {
    const s = m.index!;
    const e = s + m[0].length;
    if (taken(s, e)) continue;
    found.push({ start: s, end: e, month: MONTHS[m[1]!.slice(0, 3)]!, day: Number(m[2]), year: m[5] ? Number(m[5]) : null, range: Boolean(m[4]), weekOf: weekOfBefore(s), numeric: false });
  }
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\.?(?:,?\\s+(\\d{4}))?\\b`, 'g');
  for (const m of lower.matchAll(dayFirst)) {
    const s = m.index!;
    const e = s + m[0].length;
    if (taken(s, e)) continue;
    found.push({ start: s, end: e, month: MONTHS[m[2]!.slice(0, 3)]!, day: Number(m[1]), year: m[3] ? Number(m[3]) : null, range: false, weekOf: weekOfBefore(s), numeric: false });
  }
  for (const m of lower.matchAll(/(?<![\d:])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d:])/g)) {
    const s = m.index!;
    const e = s + m[0].length;
    if (taken(s, e)) continue;
    let a = Number(m[1]);
    let b = Number(m[2]);
    if (numericOrder === 'DMY' || a > 12) [a, b] = [b, a];
    if (a < 1 || a > 12 || b < 1 || b > 31) continue;
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
    found.push({ start: s, end: e, month: a, day: b, year: y, range: false, weekOf: weekOfBefore(s), numeric: true });
  }
  return found.filter((f) => f.month >= 1 && f.month <= 12 && f.day >= 1 && f.day <= 31).sort((x, y) => x.start - y.start);
}

interface TimeMatch {
  start: number;
  end: number;
  time: string | null;
  ambiguous: boolean;
}

function findTime(line: string, dates: DateMatch[]): TimeMatch | null {
  const lower = line.toLowerCase();
  const inDate = (i: number) => dates.some((d) => i >= d.start && i < d.end);
  const pad = (n: number) => String(n).padStart(2, '0');
  const twelve = /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/g;
  for (const m of lower.matchAll(twelve)) {
    if (inDate(m.index!)) continue;
    let h = Number(m[1]);
    const min = Number(m[2] ?? 0);
    if (h < 1 || h > 12 || min > 59) continue;
    const pm = m[3]!.startsWith('p');
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    return { start: m.index!, end: m.index! + m[0].length, time: `${pad(h)}:${pad(min)}`, ambiguous: false };
  }
  for (const m of lower.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)) {
    if (inDate(m.index!)) continue;
    const h = Number(m[1]);
    // "by 5:00" without am/pm and an hour that could be either: ask.
    const ambiguous = h >= 1 && h <= 11 && !/\d{2}:/.test(m[0]);
    return { start: m.index!, end: m.index! + m[0].length, time: `${pad(h)}:${m[2]}`, ambiguous };
  }
  const noon = lower.search(/\bnoon\b/);
  if (noon >= 0) return { start: noon, end: noon + 4, time: '12:00', ambiguous: false };
  const midnight = lower.search(/\bmidnight\b/);
  if (midnight >= 0) return { start: midnight, end: midnight + 8, time: '23:59', ambiguous: false };
  const bare = /\b(?:by|at)\s+(\d{1,2})(?![\d/:])\b/.exec(lower);
  if (bare) return { start: bare.index, end: bare.index + bare[0].length, time: null, ambiguous: true };
  return null;
}

// ── Classification ──────────────────────────────────────────────────

function classify(text: string): AssignmentType | null {
  const lower = ` ${text.toLowerCase()} `;
  for (const { type, words } of TYPE_KEYWORDS) {
    for (const w of words) {
      const re = new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      if (re.test(lower)) return type;
    }
  }
  return null;
}

const containsAny = (text: string, words: readonly string[]) => {
  const lower = text.toLowerCase();
  return words.some((w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(lower));
};

const GRADING_LINE = /\b\d{1,3}\s?%/;

function cleanTitle(text: string, dates: DateMatch[], time: TimeMatch | null): string {
  if (dates.length) {
    // "Paper 1 due October 12. Submit through…": the title is what comes before the date.
    const pre = stripNoise(text.slice(0, dates[0]!.start));
    if ((pre.match(/[a-z]/gi) ?? []).length >= 3) return pre;
    const after = text.slice(Math.max(dates[dates.length - 1]!.end, time && time.start > dates[0]!.start ? time.end : 0));
    const post = stripNoise(after.split(/\.\s/)[0] ?? '');
    if (post) return post;
  }
  return stripNoise(cutRanges(text, dates, time));
}

function cutRanges(text: string, dates: DateMatch[], time: TimeMatch | null): string {
  let t = text;
  const cuts = [...dates.map((d) => [d.start, d.end] as const), ...(time ? [[time.start, time.end] as const] : [])].sort((a, b) => b[0] - a[0]);
  for (const [s, e] of cuts) t = t.slice(0, s) + ' ' + t.slice(e);
  return t;
}

function stripNoise(text: string): string {
  const vague = new RegExp(`\\b(${VAGUE_TIMING_WORDS.join('|')})\\b`, 'gi');
  return text
    .replace(/[~^#@¶]+/g, ' ')
    .replace(vague, ' ')
    .replace(new RegExp(`\\b${WEEKDAY_RE}\\.?,?(?=\\s|$)`, 'gi'), ' ')
    .replace(/\bweek\s+of\b/gi, ' ')
    .replace(/\bweek\s+\d+\b/gi, ' ')
    .replace(/\b(due|due date|deadline|submit(?:ted)?|turn in|hand in|by|on|at|before)\b:?/gi, ' ')
    .replace(/\b(tba|tbd|to be announced|to be determined)\b/gi, ' ')
    .replace(/[|•*]+/g, ' ')
    .replace(/^\s*[-–:,.;)(\d. ]{0,4}\s*/, '')
    .replace(/\s+[-–:,;(]+\s*$/g, '')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[,;:\-–.]+$/, '')
    .replace(/\s+(are|is|will be)$/i, '')
    .trim();
}

// ── Document structure ──────────────────────────────────────────────

interface Line {
  text: string;
  page: number;
  line: number;
  cells: string[];
}

const COURSE_CODE = /\b([A-Z]{2,5})[ -]?(\d{3,4}[A-Z]?)\b/;
const TERM_RE = /\b(fall|autumn|spring|summer|winter)\s*(?:term|semester|quarter|session)?\s*(\d{4})\b/i;

function splitLines(text: string, splitCells: boolean): Line[] {
  const pages = normalizeText(text).split('\f');
  const lines: Line[] = [];
  pages.forEach((page, p) => {
    page.split('\n').forEach((raw, i) => {
      const t = raw.trim();
      if (!t) return;
      const cells = splitCells ? t.split(/\s*\|\s*|\t+|\s{3,}/).map((c) => c.trim()).filter(Boolean) : [t];
      lines.push({ text: t, page: p + 1, line: i + 1, cells });
    });
  });
  return lines;
}

function guessCourses(lines: Line[]): { courses: CourseGuess[]; courseOfLine: number[] } {
  const courses: CourseGuess[] = [];
  const courseOfLine: number[] = [];
  let current = -1;
  const term = lines.map((l) => TERM_RE.exec(l.text)).find(Boolean);
  const termText = term ? `${term[1]![0]!.toUpperCase()}${term[1]!.slice(1).toLowerCase()} ${term[2]}` : null;
  lines.forEach((l, idx) => {
    const code = COURSE_CODE.exec(l.text);
    // A heading: the code starts the line (or the first lines of the document) and isn't a sentence.
    const heading = code && (code.index <= 2 || idx < 3) && l.text.length < 90 && !/[.?!]$/.test(l.text) && !findDates(l.text, 'MDY').length;
    if (heading) {
      const codeText = `${code![1]} ${code![2]}`;
      if (!courses.some((c) => c.code === codeText)) {
        const rest = l.text
          .slice(code!.index + code![0].length)
          .replace(TERM_RE, '')
          .replace(/^[\s:|\-–,]+/, '')
          .replace(/[\s:|\-–,]+$/, '')
          .trim();
        courses.push({ code: codeText, name: rest || null, term: termText });
      }
      current = courses.findIndex((c) => c.code === codeText);
    }
    courseOfLine.push(Math.max(0, current));
  });
  if (!courses.length) {
    const title = lines.slice(0, 5).find((l) => /[a-z]/i.test(l.text) && !findDates(l.text, 'MDY').length && !GRADING_LINE.test(l.text));
    courses.push({ code: null, name: title ? title.text.replace(TERM_RE, '').replace(/[\s:|\-–,]+$/, '').trim() || null : null, term: termText });
  }
  return { courses, courseOfLine };
}

// ── Year inference ──────────────────────────────────────────────────

interface YearContext {
  anchor: 'term' | 'explicit' | 'none';
  termSeason: string | null;
  termYear: number | null;
  explicitYear: number | null;
  referenceYear: number;
}

function yearContext(lines: Line[], allDates: DateMatch[], referenceYear: number): YearContext {
  const term = lines.map((l) => TERM_RE.exec(l.text)).find(Boolean);
  const years = allDates.map((d) => d.year).filter((y): y is number => y !== null);
  const counts = new Map<number, number>();
  years.forEach((y) => counts.set(y, (counts.get(y) ?? 0) + 1));
  const explicitYear = years.length ? [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0] : null;
  return {
    anchor: term ? 'term' : explicitYear ? 'explicit' : 'none',
    termSeason: term ? term[1]!.toLowerCase().replace('autumn', 'fall') : null,
    termYear: term ? Number(term[2]) : null,
    explicitYear,
    referenceYear,
  };
}

/** Year for a month in this document, plus whether it needed a guess. */
function inferYear(month: number, ctx: YearContext, prevMonth: number | null, prevYear: number | null): { year: number; reason: ReviewReason | null } {
  if (ctx.termYear !== null) {
    const y = ctx.termYear;
    switch (ctx.termSeason) {
      case 'fall':
        return month <= 2 ? { year: y + 1, reason: null } : month >= 7 ? { year: y, reason: null } : { year: y, reason: 'missingYear' };
      case 'winter':
        return month === 12 ? { year: y - 1, reason: null } : { year: y, reason: month <= 4 ? null : 'missingYear' };
      default:
        return { year: y, reason: null };
    }
  }
  const base = prevYear ?? ctx.explicitYear ?? ctx.referenceYear;
  // Dates run forward through a term: a big jump backwards means a new calendar year.
  const year = prevMonth !== null && month < prevMonth - 5 ? base + 1 : base;
  return { year, reason: ctx.anchor === 'none' ? 'missingYear' : null };
}

// ── Main ────────────────────────────────────────────────────────────

interface Raw {
  courseIndex: number;
  text: string;
  title: string;
  type: AssignmentType | null;
  date: DateMatch | null;
  time: TimeMatch | null;
  reasons: Set<ReviewReason>;
  recurrence?: { weekday: number; time: string | null };
  provenance: SourceProvenance;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const RANK: Record<ConfidenceLevel, number> = { confirmed: 0, likely: 1, needsReview: 2 };
export const worst = (...levels: (ConfidenceLevel | null | undefined)[]): ConfidenceLevel =>
  levels.filter((l): l is ConfidenceLevel => Boolean(l)).reduce<ConfidenceLevel>((a, b) => (RANK[b] > RANK[a] ? b : a), 'confirmed');

const DATE_REASONS: readonly ReviewReason[] = ['ambiguousWeek', 'missingYear', 'tba', 'vagueTiming', 'conflictingDates', 'ocrDamage', 'noDate', 'recurringRange', 'numericDateOrder'];

export function parseSyllabus(input: ParseInput): ParseResult {
  const version = input.parserVersion ?? PARSER_VERSION;
  const modern = version === PARSER_VERSION;
  const lines = splitLines(input.text, modern);
  const { courses, courseOfLine } = guessCourses(lines);
  const repairedLines = lines.map((l) => repairOcrDates(l.text));

  // Numeric order: a "13/10"-style date anywhere means day-first for the whole document.
  const numericOrder: 'MDY' | 'DMY' = repairedLines.some((r) => /(?<![\d:])(1[3-9]|2\d|3[01])\/(0?[1-9]|1[0-2])(?![\d:])/.test(r.line)) ? 'DMY' : DEFAULT_NUMERIC_DATE_ORDER;
  const allDates = repairedLines.flatMap((r) => findDates(r.line, numericOrder));
  const ctx = yearContext(lines, allDates, toWallClock(input.referenceAt, input.timezone).year);

  const raws: Raw[] = [];
  // A work item whose date is on the following line ("Lab report 2" / "Due: Oct 3, 5 PM").
  let carry: Raw | null = null;

  lines.forEach((line, idx) => {
    const { line: fixed, repaired } = repairedLines[idx]!;
    const carried: Raw | null = carry;
    carry = null;
    if (containsAny(fixed, NON_WORK_WORDS)) return;
    const segments = modern && line.cells.length > 1 ? cellSegments(line.cells, numericOrder) : [{ text: fixed, sharedDate: null as string | null }];

    for (const seg of segments) {
      const segText = seg.text;
      const dates = findDates(segText, numericOrder);
      const sharedDates = seg.sharedDate ? findDates(seg.sharedDate, numericOrder) : [];
      const date = dates[0] ?? sharedDates[0] ?? null;
      const time = findTime(segText, dates) ?? (seg.sharedDate ? findTime(seg.sharedDate, sharedDates) : null);
      const type = classify(segText);
      const hasDue = containsAny(segText, DUE_WORDS);
      const tba = containsAny(segText, TBA_WORDS);
      const vague = containsAny(segText, VAGUE_TIMING_WORDS);
      const weekN = /\bweek\s+\d+\b/i.test(segText) && !date;
      const recurrenceMatch = modern ? new RegExp(`\\b(?:every|each)\\s+(${WEEKDAY_NAMES.join('|')})s?\\b|\\b(${WEEKDAY_NAMES.join('|')})s\\b`, 'i').exec(segText) : null;
      const reasons = new Set<ReviewReason>();
      if (repaired && date) reasons.add('ocrDamage');
      if (/[^\x20-\x7E]{2,}|[~^]{1,}|\b[a-z]*\d+[a-z]+\d*[a-z]*\b/i.test(segText) && repaired) reasons.add('ocrDamage');

      const provenance: SourceProvenance = { page: line.page, line: line.line, ...(modern && line.cells.length > 1 ? { section: 'table row' } : {}) };

      // Keyword line with no date followed by a "Due: …" line: merge (multi-line item).
      const ownTitle = cleanTitle(segText, dates, time);
      if (carried && !type && date && segments.length === 1 && (!ownTitle || /^\s*(due|deadline)\b/i.test(segText))) {
        carried.date = date;
        carried.time = time;
        if (repaired) carried.reasons.add('ocrDamage');
        if (date.weekOf || date.range) carried.reasons.add('ambiguousWeek');
        if (time?.ambiguous) carried.reasons.add('timeAmbiguous');
        carried.reasons.delete('noDate');
        carried.text += ` ${segText}`;
        raws.push(carried);
        continue;
      }

      if (!type && !hasDue) continue;
      if (!date && GRADING_LINE.test(segText) && !tba && !vague) continue;

      if (recurrenceMatch && !date) {
        const name = (recurrenceMatch[1] ?? recurrenceMatch[2])!.toLowerCase();
        raws.push({
          courseIndex: courseOfLine[idx] ?? 0,
          text: segText,
          title: recurringTitle(segText.replace(recurrenceMatch[0], ' ')),
          type,
          date: null,
          time,
          reasons: new Set(['recurringRange']),
          recurrence: { weekday: WEEKDAY_NAMES.indexOf(name), time: time?.time ?? null },
          provenance,
        });
        continue;
      }

      if (!date) {
        if (tba) reasons.add('tba');
        else if (vague) reasons.add('vagueTiming');
        else if (weekN) reasons.add('ambiguousWeek');
        else {
          // Keyword without any date: maybe the date is on the next line.
          if (type && segments.length === 1) {
            carry = { courseIndex: courseOfLine[idx] ?? 0, text: segText, title: cleanTitle(segText, [], null), type, date: null, time: null, reasons: new Set(['noDate']), provenance };
          }
          continue;
        }
      }
      if (date?.weekOf || date?.range) reasons.add('ambiguousWeek');
      if (time?.ambiguous) reasons.add('timeAmbiguous');
      raws.push({ courseIndex: courseOfLine[idx] ?? 0, text: segText, title: cleanTitle(segText, dates, findTime(segText, dates)), type, date, time, reasons, provenance });
    }
  });

  // Resolve years in document order.
  let prevMonth: number | null = null;
  let prevYear: number | null = null;
  const dated = raws.map((r) => {
    if (!r.date) return { r, dayKey: null as string | null };
    let year = r.date.year;
    if (year === null) {
      const inferred = inferYear(r.date.month, ctx, prevMonth, prevYear);
      year = inferred.year;
      if (inferred.reason) r.reasons.add(inferred.reason);
    }
    prevMonth = r.date.month;
    prevYear = year;
    return { r, dayKey: `${year}-${pad2(r.date.month)}-${pad2(r.date.day)}` };
  });

  // Range for weekly recurrences: every dated item plus any fully dated line ("First class: September 1, 2026").
  const explicitKeys = allDates.filter((d) => d.year !== null).map((d) => `${d.year}-${pad2(d.month)}-${pad2(d.day)}`);
  const dayKeys = [...dated.map((d) => d.dayKey).filter((k): k is string => Boolean(k)), ...explicitKeys].sort();
  const dateRange = dayKeys.length ? { first: dayKeys[0]!, last: dayKeys[dayKeys.length - 1]! } : null;

  // Build candidates, then dedupe/flag conflicts by normalised title per course.
  const built: Candidate[] = dated.map(({ r, dayKey }, i) => {
    const title = r.title || defaultTitle(r.type);
    const typeConfidence: ConfidenceLevel = r.type ? 'likely' : 'needsReview';
    if (!r.type) r.reasons.add('typeUnknown');
    return {
      key: `c${i}`,
      courseIndex: r.courseIndex,
      title,
      normalizedTitle: normalizeTitle(title),
      type: r.type ?? 'other',
      typeConfidence,
      dueDayKey: dayKey,
      dueTime: r.time?.time ?? r.recurrence?.time ?? null,
      dateConfidence: 'likely',
      timeConfidence: r.time ? (r.time.ambiguous ? 'needsReview' : 'likely') : null,
      recurrence: r.recurrence,
      reasons: [...r.reasons],
      provenance: [r.provenance],
      snippet: r.text.slice(0, 160),
      overall: 'likely',
    };
  });

  const merged = dedupe(built);
  for (const c of merged) {
    if (c.recurrence && dateRange && dayKeys.length >= 2) c.reasons = c.reasons.filter((x) => x !== 'recurringRange');
    c.dateConfidence = c.reasons.some((x) => DATE_REASONS.includes(x)) ? 'needsReview' : 'likely';
    if (c.recurrence && !c.reasons.includes('recurringRange')) c.dateConfidence = 'likely';
    c.overall = worst(c.dateConfidence, c.typeConfidence, c.timeConfidence);
  }

  return {
    parserVersion: version,
    contentHash: contentHashOf(input.text),
    courses,
    candidates: merged,
    pageCount: normalizeText(input.text).split('\f').length,
    lineCount: lines.length,
    dateRange,
    yearAnchor: ctx.anchor,
  };
}

function recurringTitle(text: string): string {
  return stripNoise(cutRanges(text, [], findTime(text, [])).split(/\.\s/)[0] ?? '');
}

/** Table rows: a date cell shared by every work item in the row. */
function cellSegments(cells: string[], order: 'MDY' | 'DMY'): { text: string; sharedDate: string | null }[] {
  const dateCell = cells.find((c) => findDates(repairOcrDates(c).line, order).length > 0) ?? null;
  const items = cells.filter((c) => c !== dateCell && (classify(c) || containsAny(c, DUE_WORDS)));
  if (!items.length) return [{ text: cells.map((c) => repairOcrDates(c).line).join(' '), sharedDate: null }];
  return items.map((c) => {
    const fixed = repairOcrDates(c).line;
    // An item cell with its own date keeps it; otherwise it borrows the row's date.
    return findDates(fixed, order).length ? { text: fixed, sharedDate: null } : { text: fixed, sharedDate: dateCell ? repairOcrDates(dateCell).line : null };
  });
}

function defaultTitle(type: AssignmentType | null): string {
  return type ? type[0]!.toUpperCase() + type.slice(1) : 'Untitled item';
}

function dedupe(items: Candidate[]): Candidate[] {
  const groups = new Map<string, Candidate[]>();
  for (const c of items) {
    const k = `${c.courseIndex}|${c.normalizedTitle}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const out: Candidate[] = [];
  for (const group of groups.values()) {
    const days = [...new Set(group.map((g) => g.dueDayKey).filter(Boolean))] as string[];
    if (group.length === 1 || days.length <= 1) {
      // Same item listed twice (or the same date): one candidate, every location kept.
      const first = { ...group[0]! };
      first.provenance = group.flatMap((g) => g.provenance);
      first.dueDayKey = first.dueDayKey ?? days[0] ?? null;
      first.dueTime = group.map((g) => g.dueTime).find(Boolean) ?? null;
      first.timeConfidence = group.map((g) => g.timeConfidence).find(Boolean) ?? null;
      first.reasons = [...new Set(group.flatMap((g) => g.reasons))];
      if (first.dueDayKey) first.reasons = first.reasons.filter((r) => r !== 'noDate');
      out.push(first);
    } else if (days.length === 2 && group.length <= 3) {
      // Two different dates for the same item: ask the student which one is right.
      const first = { ...group[0]! };
      first.provenance = group.flatMap((g) => g.provenance);
      first.dueOptions = days;
      first.reasons = [...new Set([...group.flatMap((g) => g.reasons), 'conflictingDates' as ReviewReason])];
      out.push(first);
    } else {
      // A repeating generic title ("Quiz" every week): separate items, told apart by date.
      out.push(...group);
    }
  }
  return out.sort((a, b) => (a.provenance[0]!.page ?? 0) - (b.provenance[0]!.page ?? 0) || a.provenance[0]!.line - b.provenance[0]!.line);
}

/** Plain-language explanation of a review reason (review screen). */
export function describeReason(reason: ReviewReason): string {
  switch (reason) {
    case 'ambiguousWeek':
      return 'The syllabus gives a week, not a day.';
    case 'missingYear':
      return 'No year was given, so it was guessed.';
    case 'tba':
      return 'The date hasn’t been announced yet.';
    case 'vagueTiming':
      return 'The timing is described loosely.';
    case 'conflictingDates':
      return 'Two different dates appear for this item.';
    case 'ocrDamage':
      return 'The scan was hard to read here.';
    case 'noDate':
      return 'No date was found.';
    case 'typeUnknown':
      return 'Not sure what kind of work this is.';
    case 'timeAmbiguous':
      return 'The time could be morning or evening.';
    case 'numericDateOrder':
      return 'The day and month could be swapped.';
    case 'recurringRange':
      return 'It repeats weekly, but the term dates weren’t clear.';
  }
}
