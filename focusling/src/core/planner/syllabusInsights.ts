import type { ClassMeeting, CourseIdentity, CoursePerson, CoverageRelation, GradingBreakdown, GradingComponent, KeyDate, OfficeHoursEntry, PolicyRef, ScheduleWeek, SourceProvenance, SyllabusInsights, TermSeason } from '../models';
import { COURSE_CODE, datesInLine, normalizeText, normalizeTitle, TERM_RE } from './syllabusParser';

/**
 * Course-level understanding of a syllabus (Syllabus Intelligence 2.0):
 * identity, people, office hours, class meetings, grading breakdown, weekly
 * schedule, explicit coverage ("Midterm 1 covers Weeks 1–5"), administrative
 * dates and policy headings. Deterministic and on device. Only what the text
 * states is returned: nothing is guessed to fill a gap, and relationships are
 * kept only when the syllabus spells them out. Every value carries its
 * page/line so the student can check it.
 */

interface Line {
  text: string;
  cells: string[];
  provenance: SourceProvenance;
}

function linesOf(text: string): Line[] {
  const out: Line[] = [];
  normalizeText(text)
    .split('\f')
    .forEach((page, p) =>
      page.split('\n').forEach((raw, i) => {
        const t = raw.trim();
        if (!t) return;
        const cells = t.split(/\s*\|\s*|\t+|\s{3,}/).map((c) => c.trim()).filter(Boolean);
        out.push({ text: t, cells, provenance: { page: p + 1, line: i + 1, ...(cells.length > 1 ? { section: 'table row' } : {}) } });
      }),
    );
  return out;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;

// ── Weekdays and times ──────────────────────────────────────────────

const DAY_WORDS: [RegExp, number][] = [
  [/\bsun(?:day)?s?\b/i, 0],
  [/\bmon(?:day)?s?\b/i, 1],
  [/\btue(?:s(?:day)?)?s?\b/i, 2],
  [/\bwed(?:nesday)?s?\b/i, 3],
  [/\bthu(?:r(?:s(?:day)?)?)?s?\b/i, 4],
  [/\bfri(?:day)?s?\b/i, 5],
  [/\bsat(?:urday)?s?\b/i, 6],
];

/** Weekdays named in text, including compact forms (MWF, TTh, TR). */
export function weekdaysIn(text: string): number[] {
  const days = new Set<number>();
  for (const [re, d] of DAY_WORDS) if (re.test(text)) days.add(d);
  const compact = /\b(M?(?:T|Tu)?W?(?:Th|R)?F?)\b/g;
  for (const m of text.matchAll(compact)) {
    const tok = m[1]!;
    if (tok.length < 2 || !/^[MTWRFhu]+$/.test(tok) || tok === tok.toLowerCase()) continue;
    if (!/^(M|T|Tu|W|Th|R|F)+$/.test(tok)) continue;
    for (const part of tok.match(/Th|Tu|M|T|W|R|F/g) ?? []) days.add({ M: 1, T: 2, Tu: 2, W: 3, Th: 4, R: 4, F: 5 }[part]!);
  }
  return [...days].sort((a, b) => a - b);
}

/** "10:05–11:25 AM", "2:30-3:50 pm", "1–2 PM", "14:00-15:30" → minutes after midnight. */
export function timeRangeIn(text: string): { start: number; end: number } | null {
  const m = /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(?:-|–|to|until)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i.exec(text);
  if (!m) return null;
  const toMin = (h: number, min: number, mer: string | undefined, fallback: string | undefined, isStart: boolean) => {
    const ap = (mer ?? fallback)?.toLowerCase().startsWith('p') ? 'pm' : (mer ?? fallback) ? 'am' : null;
    let hour = h;
    if (ap === 'pm' && hour !== 12) hour += 12;
    if (ap === 'am' && hour === 12) hour = 0;
    if (!ap && !mer && hour < 8 && !isStart) hour += 12; // "1-2" with no meridiem: afternoon class hours
    return hour * 60 + min;
  };
  const sh = Number(m[1]);
  const eh = Number(m[4]);
  if (sh > 23 || eh > 23) return null;
  const hasColonOrMeridiem = m[2] || m[3] || m[5] || m[6];
  if (!hasColonOrMeridiem) return null; // "1-2" alone is too ambiguous (could be weeks or chapters)
  let start = toMin(sh, Number(m[2] ?? 0), m[3], m[6], true);
  const end = toMin(eh, Number(m[5] ?? 0), m[6], undefined, false);
  if (!m[3] && m[6] && start + 12 * 60 <= end) start += 12 * 60; // "2:30-3:50 pm" → both pm
  if (end <= start) return null;
  return { start, end };
}

// ── Identity ────────────────────────────────────────────────────────

const INSTITUTION = /\b(universit[yé]|université|college|cégep|institute of technology|polytechnic(?:que)?|école|school of [a-z]+)\b/i;

function identityOf(lines: Line[]): CourseIdentity {
  const head = lines.slice(0, 25);
  const instLine = head.find((l) => INSTITUTION.test(l.text) && l.text.length <= 90 && !/[.?!]$/.test(l.text) && !EMAIL.test(l.text));
  let institution: string | null = null;
  if (instLine) {
    const part = instLine.text.split(/\s*[|·•,–—]\s*|\s+-\s+/).find((p) => INSTITUTION.test(p)) ?? instLine.text;
    institution = part.replace(TERM_RE, '').replace(/\s+/g, ' ').trim() || null;
  }
  let code: string | null = null;
  let title: string | null = null;
  const labelled = head.find((l) => /^course(?:\s+(?:code|number))?\s*[:\-]/i.test(l.text) && COURSE_CODE.test(l.text));
  const codeLine = labelled ?? head.find((l) => {
    const m = COURSE_CODE.exec(l.text);
    return m && (m.index <= 2 || l === head[0]) && l.text.length < 100;
  });
  const cm = codeLine ? COURSE_CODE.exec(codeLine.text) : null;
  if (cm) {
    code = `${cm[1]} ${cm[2]}`;
    const rest = codeLine!.text
      .slice(cm.index + cm[0].length)
      .replace(TERM_RE, '')
      .replace(/\b(?:section|sec\.?)\s*[A-Z0-9]{1,4}\b/i, '')
      .split(/\s*[|·•]\s*/)[0]!
      .replace(/^[\s:\-–—,]+|[\s:\-–—,]+$/g, '')
      .trim();
    if (rest && /[a-z]/i.test(rest) && !INSTITUTION.test(rest)) title = rest;
  }
  const titled = head.find((l) => /^course\s+title\s*[:\-]/i.test(l.text));
  if (titled) title = titled.text.replace(/^course\s+title\s*[:\-]\s*/i, '').trim() || title;
  const term = head.map((l) => TERM_RE.exec(l.text)).find(Boolean) ?? lines.map((l) => TERM_RE.exec(l.text)).find(Boolean);
  const season = term ? (term[1]!.toLowerCase().replace('autumn', 'fall') as TermSeason) : null;
  const sec = head.map((l) => /\b(?:section|sec\.)\s*[:#]?\s*([A-Z]?\d{1,4}[A-Z]?)\b/i.exec(l.text) ?? /\b(?:LEC|TUT|LAB)\s?(\d{3,4})\b/.exec(l.text)).find(Boolean);
  return {
    institution,
    code,
    subject: cm ? cm[1]! : null,
    number: cm ? cm[2]! : null,
    title,
    term: term && season ? { season, year: Number(term[2]) } : null,
    section: sec ? sec[1]!.toUpperCase() : null,
  };
}

// ── People and office hours ─────────────────────────────────────────

const INSTRUCTOR_LABEL = /^(?:course\s+)?(instructor|professor|prof\.?|lecturer|course coordinator|faculty)s?\b\s*(?:\([^)]*\))?\s*[:\-|]\s*(.+)$/i;
const TA_LABEL = /^(teaching assistants?|tas?|t\.a\.s?|graders?)\b\s*[:\-|]\s*(.+)$/i;

function cleanName(raw: string): string | null {
  const name = raw
    .replace(EMAIL, ' ')
    .replace(/\((?:[^)]*)\)/g, ' ')
    .split(/\s*[,;|]\s*|\s+-\s+|\s+(?:office|email|e-mail|phone|room)\b/i)[0]!
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name || name.length > 60 || !/[a-z]/i.test(name) || /\d{2,}/.test(name) || /\b(tba|tbd|to be announced)\b/i.test(name)) return null;
  return name;
}

function peopleOf(lines: Line[]): CoursePerson[] {
  const out: CoursePerson[] = [];
  for (const l of lines) {
    const text = l.cells.length > 1 ? `${l.cells[0]}: ${l.cells.slice(1).join(', ')}` : l.text;
    const ins = INSTRUCTOR_LABEL.exec(text);
    if (ins && !/office hours?/i.test(text)) {
      const name = cleanName(ins[2]!);
      if (name && !out.some((p) => p.role === 'instructor' && p.name === name)) out.push({ role: 'instructor', name, ...(EMAIL.exec(ins[2]!) ? { email: EMAIL.exec(ins[2]!)![0] } : {}), provenance: l.provenance });
      continue;
    }
    const ta = TA_LABEL.exec(text);
    if (ta && !/office hours?/i.test(text)) {
      for (const part of ta[2]!.split(/\s*;\s*|\s*,\s*(?=[A-Z])|\s+and\s+/)) {
        const name = cleanName(part);
        if (name && !out.some((p) => p.role === 'ta' && p.name === name)) out.push({ role: 'ta', name, ...(EMAIL.exec(part) ? { email: EMAIL.exec(part)![0] } : {}), provenance: l.provenance });
      }
    }
  }
  return out;
}

function officeHoursOf(lines: Line[], people: CoursePerson[]): OfficeHoursEntry[] {
  const out: OfficeHoursEntry[] = [];
  lines.forEach((l, idx) => {
    if (!/office hours?/i.test(l.text)) return;
    // The details may be on this line or the next ("Office hours:" / "Tue 2–3 PM, Room 210").
    const own = l.text.replace(/^.*?office hours?\s*[:\-|]?\s*/i, '');
    const text = weekdaysIn(own).length ? own : weekdaysIn(lines[idx + 1]?.text ?? '').length ? lines[idx + 1]!.text : own;
    const days = weekdaysIn(text);
    if (!days.length && !/by appointment|on request/i.test(text)) return;
    const range = timeRangeIn(text);
    const before = l.text.split(/office hours?/i)[0]!.replace(/[:\-|]+$/, '').trim();
    const who = people.find((p) => before && before.toLowerCase().includes(p.name.toLowerCase().split(' ').pop()!.toLowerCase()))?.name ?? (/\bta\b|teaching assistant/i.test(before) ? 'TA' : /instructor|professor|prof\b/i.test(before) ? 'Instructor' : null);
    const where = /\b(?:room|rm\.?|office|building|bldg\.?|hall|zoom|online|teams|library)\b[^,;.()]{0,40}/i.exec(text.replace(/office hours?/i, ''))?.[0]?.trim() ?? null;
    out.push({ who, meetings: days.map((weekday) => ({ weekday, startMinute: range?.start ?? null, endMinute: range?.end ?? null })), where, provenance: l.provenance });
  });
  return out;
}

function meetingsOf(lines: Line[]): ClassMeeting[] {
  const out: ClassMeeting[] = [];
  for (const l of lines) {
    if (/office hours?|exam|midterm|quiz|due|deadline/i.test(l.text)) continue;
    const kw = /\b(lectures?|class(?:es)?|meets?|meeting times?|labs?|tutorials?|seminars?|discussion sections?)\b/i.exec(l.text);
    if (!kw) continue;
    const days = weekdaysIn(l.text);
    const range = timeRangeIn(l.text);
    const word = kw[1]!.toLowerCase();
    // Lectures need a time to be useful; a recurring lab/tutorial day alone is still worth knowing.
    if (!days.length || (!range && !/^(lab|tutorial|seminar|discussion)/.test(word))) continue;
    const kind: ClassMeeting['kind'] = word.startsWith('lab') ? 'lab' : word.startsWith('tutorial') || word.startsWith('discussion') ? 'tutorial' : word.startsWith('seminar') ? 'seminar' : word.startsWith('lecture') ? 'lecture' : 'class';
    for (const weekday of days) if (!out.some((m) => m.kind === kind && m.weekday === weekday && m.startMinute === (range?.start ?? null))) out.push({ kind, weekday, startMinute: range?.start ?? null, endMinute: range?.end ?? null, provenance: l.provenance });
  }
  return out;
}

// ── Grading ─────────────────────────────────────────────────────────

const GRADING_HEADING = /^(?:\d+\.?\s*)?(grading|grades?|evaluation|assessments?|assessment breakdown|grade breakdown|grade distribution|marking scheme|course evaluation|method of evaluation|course grade)\b[^%]{0,40}$/i;
const HEADING_LIKE = (t: string) => t.length < 60 && !/%/.test(t) && !/[.,;]$/.test(t) && /^[A-Z0-9]/.test(t) && t.split(' ').length <= 8;

function gradingOf(lines: Line[]): GradingBreakdown | null {
  const components: GradingComponent[] = [];
  let inSection = false;
  let sinceHeading = 0;
  for (const l of lines) {
    if (GRADING_HEADING.test(l.text)) {
      inSection = true;
      sinceHeading = 0;
      continue;
    }
    if (inSection) {
      sinceHeading++;
      if (HEADING_LIKE(l.text) && !/^total\b/i.test(l.text) && sinceHeading > 1 && !/\d/.test(l.text)) inSection = false;
    }
    const percents = [...l.text.matchAll(/(\d{1,3}(?:\.\d+)?)\s?%/g)].map((m) => Number(m[1]));
    if (!percents.length) continue;
    const pctCell = l.cells.length > 1 && l.cells.some((c) => /^\d{1,3}(?:\.\d+)?\s?%$/.test(c));
    if (!inSection && !pctCell) continue;
    if (/^total\b/i.test(l.text) || /\b(late|penalty|deduct|bonus|extra credit|curve|to pass|minimum|at least)\b/i.test(l.text)) continue;
    const times = /(\d{1,2})\s*[x×]\s*(\d{1,3}(?:\.\d+)?)\s?%/i.exec(l.text);
    const weight = times && percents.length === 1 ? Number(times[1]) * Number(times[2]) : percents[percents.length - 1]!;
    if (weight <= 0 || weight > 100) continue;
    const name = (l.cells.length > 1 ? l.cells.find((c) => /[a-z]{3,}/i.test(c) && !/%/.test(c)) ?? l.cells[0]! : l.text)
      .replace(/\(?\s*\d{1,2}\s*[x×]\s*\d{1,3}(?:\.\d+)?\s?%\s*(?:each)?\s*\)?/gi, ' ')
      .replace(/\(?\b\d{1,3}(?:\.\d+)?\s?%\)?/g, ' ')
      .replace(/[.\s:|–—-]{2,}/g, ' ')
      .replace(/^[\s\-•*:]+|[\s\-•*:.]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!name || name.length > 70 || !/[a-z]/i.test(name)) continue;
    if (components.some((c) => normalizeTitle(c.name) === normalizeTitle(name))) continue;
    components.push({ name, weightPercent: weight, ...(times ? { count: Number(times[1]) } : {}), provenance: l.provenance });
  }
  if (!components.length) return null;
  const totalPercent = Math.round(components.reduce((s, c) => s + c.weightPercent, 0) * 100) / 100;
  return { components, totalPercent, addsUp: Math.abs(totalPercent - 100) < 0.5 };
}

// ── Schedule, coverage, key dates, policies ─────────────────────────

interface YearHint {
  season: TermSeason | null;
  year: number | null;
}

function dayKeyOf(d: { month: number; day: number; year: number | null }, hint: YearHint): string | null {
  let year = d.year;
  if (year === null) {
    if (hint.year === null) return null; // no term year: leave undated rather than guess
    year = hint.season === 'fall' && d.month <= 2 ? hint.year + 1 : hint.season === 'winter' && d.month === 12 ? hint.year - 1 : hint.year;
  }
  return `${year}-${pad2(d.month)}-${pad2(d.day)}`;
}

const READING = /\b(read(?:ing)?s?|ch(?:apters?|\.)\s*\d|pp\.|pages?\s+\d|textbook)\b/i;

function scheduleOf(lines: Line[], hint: YearHint): ScheduleWeek[] {
  const out: ScheduleWeek[] = [];
  for (const l of lines) {
    let week: number | null = null;
    let rest: string[] = [];
    const head = /^(?:week|wk\.?)\s*(\d{1,2})\b\s*[:.\-–|)]?\s*(.*)$/i.exec(l.cells[0] ?? l.text);
    if (head) {
      week = Number(head[1]);
      rest = l.cells.length > 1 ? [head[2]!, ...l.cells.slice(1)].filter(Boolean) : [head[2]!];
    }
    if (week === null || week < 1 || week > 20 || out.some((w) => w.week === week)) continue;
    const dateCell = rest.find((c) => datesInLine(c).length && c.replace(/[^a-z]/gi, '').length <= 12);
    const firstDate = dateCell ? datesInLine(dateCell)[0] : undefined;
    const others = rest.filter((c) => c !== dateCell);
    const readingCell = others.find((c) => READING.test(c) && others.length > 1) ?? null;
    let topic = others.filter((c) => c !== readingCell).join(' · ');
    let readings = readingCell;
    if (!readings) {
      const split = /^(.*?)[\s;,.–-]+(?:readings?|read)\s*[:\-]\s*(.+)$/i.exec(topic);
      if (split) {
        topic = split[1]!;
        readings = split[2]!;
      }
    }
    topic = topic.replace(/\s+/g, ' ').replace(/^[\s:–-]+|[\s:–-]+$/g, '').trim();
    if (!topic || topic.length > 120) continue;
    out.push({ week, startDayKey: firstDate ? dayKeyOf(firstDate, hint) : null, topic, readings: readings?.trim() || null, provenance: l.provenance });
  }
  return out.sort((a, b) => a.week - b.week);
}

const ASSESSMENT_WORD = /\b(midterm|exam|examination|quiz|test|final)\b/i;

function coverageOf(lines: Line[]): CoverageRelation[] {
  const out: CoverageRelation[] = [];
  for (const l of lines) {
    const m = /^(.{3,60}?)\s*(?:\(|[:\-–]\s*)?\s*(?:will\s+)?(?:covers?|covering|includes?|is on|tests?|assesses)\s+(?:all\s+)?(?:material\s+(?:from|in)\s+)?(?:lectures?\s+)?(.+)$/i.exec(l.text);
    if (!m || !ASSESSMENT_WORD.test(m[1]!)) continue;
    const weeks = /\bweeks?\s+(\d{1,2})\s*(?:-|–|to|through|and)\s*(\d{1,2})\b/i.exec(m[2]!);
    const chapters = /\b(ch(?:apters?|\.)\s*\d{1,2}(?:\s*(?:-|–|to|through|,|and)\s*\d{1,2})*)/i.exec(m[2]!);
    if (!weeks && !chapters) continue;
    const title = m[1]!.replace(/[(:–\-\s]+$/, '').replace(/^[\s\-•*]+/, '').trim();
    out.push({ itemKey: normalizeTitle(title), itemTitle: title, weeks: weeks ? { from: Number(weeks[1]), to: Number(weeks[2]) } : null, chapters: chapters ? chapters[1]!.replace(/\s+/g, ' ') : null, provenance: l.provenance });
  }
  return out;
}

function keyDatesOf(lines: Line[], hint: YearHint): KeyDate[] {
  const out: KeyDate[] = [];
  for (const l of lines) {
    const kind: KeyDate['kind'] | null = /\b(last day to (?:add\/)?drop|drop deadline|add\/drop)\b/i.test(l.text)
      ? 'drop'
      : /\b(withdraw(?:al)?(?: deadline)?|last day to withdraw)\b/i.test(l.text)
        ? 'withdraw'
        : /\b(no class(?:es)?|reading week|study break|fall break|spring break|holiday|thanksgiving)\b/i.test(l.text)
          ? 'noClass'
          : null;
    if (!kind) continue;
    const d = datesInLine(l.text)[0];
    const label = l.text
      .replace(/\b(?:mon|tue|tues|wed|thu|thurs|fri|sat|sun)[a-z]*\.?,?/gi, ' ')
      .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:\s*[-–]\s*\d{1,2})?(?:,?\s*\d{4})?/gi, ' ')
      .replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g, ' ')
      .replace(/[|:]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[\s\-–]+|[\s\-–,.]+$/g, '')
      .trim();
    if (!label || label.length > 80) continue;
    out.push({ label, dayKey: d ? dayKeyOf(d, hint) : null, kind, provenance: l.provenance });
  }
  return out;
}

const POLICY = /\b(polic(?:y|ies)|academic integrity|academic honesty|plagiarism|late (?:work|submissions?|assignments?|penalt(?:y|ies))|attendance|accommodations?|accessibility|missed (?:exams?|work|assessments?|quizzes)|regrades?|re-grades?|collaboration|generative ai|use of ai|ai tools|absences?)\b/i;

function policiesOf(lines: Line[]): PolicyRef[] {
  const out: PolicyRef[] = [];
  for (const l of lines) {
    const t = l.text.replace(/^(?:\d+(?:\.\d+)*\.?|[a-z]\))\s*/i, '').replace(/[:\s]+$/, '');
    if (t.length > 60 || t.length < 4 || /\d{1,3}\s?%/.test(t) || datesInLine(t).length || /[.?!,;]$/.test(t)) continue;
    if (!POLICY.test(t) || t.split(' ').length > 8) continue;
    if (!/^[A-Z]/.test(t)) continue;
    if (!out.some((p) => normalizeTitle(p.title) === normalizeTitle(t))) out.push({ title: t, provenance: l.provenance });
  }
  return out;
}

export function extractInsights(text: string): SyllabusInsights {
  const lines = linesOf(text);
  const identity = identityOf(lines);
  const hint: YearHint = { season: identity.term?.season ?? null, year: identity.term?.year ?? null };
  const people = peopleOf(lines);
  return {
    identity,
    people,
    officeHours: officeHoursOf(lines, people),
    meetings: meetingsOf(lines),
    grading: gradingOf(lines),
    schedule: scheduleOf(lines, hint),
    coverage: coverageOf(lines),
    keyDates: keyDatesOf(lines, hint),
    policies: policiesOf(lines),
  };
}

/** Insights with every field empty (manual courses, failed extraction). */
export function emptyInsights(): SyllabusInsights {
  return { identity: { institution: null, code: null, subject: null, number: null, title: null, term: null, section: null }, people: [], officeHours: [], meetings: [], grading: null, schedule: [], coverage: [], keyDates: [], policies: [] };
}
