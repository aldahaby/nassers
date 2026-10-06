import { compareWithGolden, GOLDEN_FIXTURES, AMBIGUOUS, CLEAN_TEXT, CONFLICTING, MALFORMED_OCR, MISSING_YEAR, MULTI_LINE, MULTIPLE_COURSES, RECURRING_WEEKLY, SCANNED_OCR, TABLE_SCHEDULE, TERM_CROSSING } from '../../planner/fixtures/syllabi';
import { contentHashOf, describeReason, parseSyllabus, repairOcrDates } from '../../planner/syllabusParser';
import { PARSER_VERSION } from '@/config/planner';

const parse = (f: (typeof GOLDEN_FIXTURES)[number], version?: 'syllabus-parser-1.0' | 'syllabus-parser-0.9') => parseSyllabus({ text: f.text, timezone: f.timezone, referenceAt: f.referenceAt, parserVersion: version });
const find = (r: ReturnType<typeof parseSyllabus>, title: string) => r.candidates.find((c) => c.title === title)!;

describe('golden syllabus corpus', () => {
  it.each(GOLDEN_FIXTURES.map((f) => [f.id, f] as const))('%s matches its golden output', (_id, f) => {
    const r = parse(f);
    expect(compareWithGolden(f.id, r.candidates)).toEqual([]);
  });

  it('all fixtures are synthetic (no emails, phone numbers or real-looking names)', () => {
    for (const f of GOLDEN_FIXTURES) {
      expect(f.text).not.toMatch(/@[a-z]+\.(edu|com)|\(\d{3}\)\s?\d{3}-\d{4}|Professor [A-Z]/);
    }
  });
});

describe('parser behaviour', () => {
  it('clean syllabus: course, term, exact times (12-hour), date-only items', () => {
    const r = parse(CLEAN_TEXT);
    expect(r.courses[0]).toEqual({ code: 'CHEM 101', name: 'Foundations of Chemistry', term: 'Fall 2026' });
    expect(find(r, 'Problem Set 1')).toMatchObject({ dueDayKey: '2026-09-11', dueTime: '23:59', timeConfidence: 'likely' });
    expect(find(r, 'Quiz 1')).toMatchObject({ dueTime: null, timeConfidence: null, overall: 'likely' });
    // Grading lines ("Quizzes 15%") and holidays are not assignments.
    expect(r.candidates.some((c) => /%|Thanksgiving/.test(c.title))).toBe(false);
  });

  it('parses 24-hour times and day-first month names', () => {
    const r = parse(MULTI_LINE);
    expect(find(r, 'Lab Report 1')).toMatchObject({ dueDayKey: '2026-10-02', dueTime: '17:00' });
    expect(find(r, 'Lab practical exam')).toMatchObject({ dueTime: '09:30' });
  });

  it('merges multi-line items (title line + "Due:" line)', () => {
    const r = parse(MULTI_LINE);
    expect(r.candidates.map((c) => c.title)).toEqual(['Lab Report 1', 'Lab Report 2', 'Poster presentation', 'Lab practical exam']);
  });

  it('multiple assignments on the same day stay separate', () => {
    const r = parse(CLEAN_TEXT);
    expect(r.candidates.filter((c) => c.dueDayKey === '2026-10-23').map((c) => c.title)).toEqual(['Problem Set 3', 'Read Chapter 7']);
  });

  it('extracts exams, quizzes, projects and readings with types', () => {
    const r = parse(CLEAN_TEXT);
    expect(find(r, 'Midterm Exam').type).toBe('exam');
    expect(find(r, 'Quiz 2').type).toBe('quiz');
    expect(find(r, 'Final Project').type).toBe('project');
    expect(find(r, 'Read Chapter 7').type).toBe('reading');
  });

  it('table rows: every work cell gets the row date; topics and holidays are skipped', () => {
    const r = parse(TABLE_SCHEDULE);
    expect(r.candidates.filter((c) => c.dueDayKey === '2026-09-14').map((c) => c.title).sort()).toEqual(['Quiz 1', 'Read Chapter 2']);
    expect(r.candidates.some((c) => /Labor|Empires/.test(c.title))).toBe(false);
    expect(r.candidates[0]!.provenance[0]).toMatchObject({ page: 1, section: 'table row' });
  });

  it('weekly recurring reading becomes one recurring candidate with a known range', () => {
    const r = parse(RECURRING_WEEKLY);
    expect(find(r, 'Reading responses').recurrence).toEqual({ weekday: 5, time: '17:00' });
    expect(r.dateRange).toEqual({ first: '2026-09-01', last: '2026-12-08' });
  });

  it('OCR-damaged dates are repaired but flagged for review', () => {
    expect(repairOcrDates('due 0ct l6')).toEqual({ line: 'due Oct 16', repaired: true });
    const r = parse(SCANNED_OCR);
    expect(find(r, 'Ethics quiz')).toMatchObject({ dueDayKey: '2026-10-02', overall: 'needsReview' });
    expect(find(r, 'Ethics quiz').reasons).toContain('ocrDamage');
    expect(find(r, 'Final exam').provenance[0]!.page).toBe(2);
  });

  it('missing year: dates are guessed and every one needs review', () => {
    const r = parse(MISSING_YEAR);
    expect(r.yearAnchor).toBe('none');
    expect(r.candidates.every((c) => c.overall === 'needsReview' && c.reasons.includes('missingYear'))).toBe(true);
  });

  it('term crossing the calendar year: January follows a Fall term into the next year', () => {
    const r = parse(TERM_CROSSING);
    expect(find(r, 'Take-home final exam').dueDayKey).toBe('2027-01-08');
    expect(find(r, 'Project milestone 2').dueDayKey).toBe('2026-12-11');
  });

  it('ambiguous timing never becomes a confident date', () => {
    const r = parse(AMBIGUOUS);
    expect(find(r, 'Reflection essay').reasons).toContain('ambiguousWeek');
    expect(find(r, 'Final exam')).toMatchObject({ dueDayKey: null, overall: 'needsReview' });
    expect(find(r, 'Final exam').reasons).toContain('tba');
    expect(find(r, 'Paper').reasons).toContain('vagueTiming');
    expect(find(r, 'Discussion post').reasons).toContain('timeAmbiguous');
    expect(r.candidates.every((c) => c.overall === 'needsReview')).toBe(true);
  });

  it('conflicting dates for one item: one candidate with both options, needs review', () => {
    const r = parse(CONFLICTING);
    const paper = find(r, 'Paper 1');
    expect(paper.dueOptions).toEqual(['2026-10-09', '2026-10-12']);
    expect(paper.reasons).toContain('conflictingDates');
    expect(paper.provenance).toHaveLength(2);
  });

  it('duplicate listing of the same item on the same date is merged, keeping both locations', () => {
    const r = parse(CONFLICTING);
    const quiz = find(r, 'Quiz 1');
    expect(r.candidates.filter((c) => c.title === 'Quiz 1')).toHaveLength(1);
    expect(quiz.provenance.map((p) => p.line)).toEqual([6, 7]);
  });

  it('multiple courses in one document are split by course heading', () => {
    const r = parse(MULTIPLE_COURSES);
    expect(r.courses.map((c) => c.code)).toEqual(['MATH 140', 'PHYS 101']);
    expect(find(r, 'Homework 1').courseIndex).toBe(0);
    expect(find(r, 'Lab report 1').courseIndex).toBe(1);
  });

  it('malformed OCR never invents confident items', () => {
    const r = parse(MALFORMED_OCR);
    expect(r.candidates.every((c) => c.overall === 'needsReview')).toBe(true);
  });

  it('content hash ignores whitespace/line-ending differences but not content', () => {
    expect(contentHashOf('A  b\r\nc')).toBe(contentHashOf('A b\nc'));
    expect(contentHashOf('Quiz 1 Oct 2')).not.toBe(contentHashOf('Quiz 1 Oct 3'));
    expect(parse(CLEAN_TEXT).contentHash).toHaveLength(64);
  });

  it('parser version is recorded, and the older version behaves differently on tables', () => {
    expect(parse(CLEAN_TEXT).parserVersion).toBe(PARSER_VERSION);
    const old = parse(TABLE_SCHEDULE, 'syllabus-parser-0.9');
    expect(old.parserVersion).toBe('syllabus-parser-0.9');
    expect(old.candidates.length).toBeLessThan(parse(TABLE_SCHEDULE).candidates.length);
  });

  it('every review reason has plain words (no percentages)', () => {
    for (const reason of ['ambiguousWeek', 'missingYear', 'tba', 'vagueTiming', 'conflictingDates', 'ocrDamage', 'noDate', 'typeUnknown', 'timeAmbiguous', 'numericDateOrder', 'recurringRange'] as const) {
      expect(describeReason(reason)).toMatch(/^[A-Z].+\.$/);
      expect(describeReason(reason)).not.toMatch(/%/);
    }
  });
});
