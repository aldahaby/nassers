/**
 * Golden syllabus corpus. Every document here is SYNTHETIC: invented courses,
 * no real institution, instructor or student. Used by unit tests and the
 * developer Syllabus Lab. Pages are separated by form feeds (\f), the way the
 * native extractor returns them.
 */
export interface SyllabusFixture {
  id: string;
  label: string;
  covers: string[];
  timezone: string;
  /** Import moment used for year fallback (fixed so results are deterministic). */
  referenceAt: number;
  text: string;
}

const AUG_2026 = Date.UTC(2026, 7, 20, 15, 0);

export const CLEAN_TEXT: SyllabusFixture = {
  id: 'clean-text',
  label: 'Clean text PDF (Chemistry, Fall 2026)',
  covers: ['clean text PDF', 'exact due time', '12-hour time', 'quizzes', 'exams', 'projects', 'date-only due date', 'multiple assignments same day'],
  timezone: 'America/New_York',
  referenceAt: AUG_2026,
  text: `CHEM 101: Foundations of Chemistry
Fall 2026 · Section 3

Course description
Atoms, bonding, reactions and stoichiometry. Exams will cover lectures and readings.

Grading
Problem sets 25%
Quizzes 15%
Midterm exam 25%
Final project 35%

Schedule of assessments
Problem Set 1 due Friday, September 11 at 11:59 PM
Quiz 1 on September 15
Problem Set 2 due September 25, 11:59 pm
Quiz 2 on October 6
Midterm Exam: October 14, 2026 at 9:00 AM
Problem Set 3 due October 23 by 5 PM
Read Chapter 7 before October 23
Final Project proposal due November 6
Final Project due December 4 at 11:59 PM

No class on November 26 (Thanksgiving break).`,
};

export const SCANNED_OCR: SyllabusFixture = {
  id: 'scanned-ocr',
  label: 'Scanned syllabus (OCR text, Psychology)',
  covers: ['scanned/OCR-style text', 'OCR-damaged date', 'multi-page'],
  timezone: 'America/Chicago',
  referenceAt: AUG_2026,
  text: `PSYC 210  Research Methods
Fall 2026

Assignments
Article summary 1    due Sept 18
Ethics quiz   due 0ct 2
Article summary 2    due Oct l6
\fPage 2
Research proposal draft    due Nov 6, 11:59 PM
Final exam    Dec 10  2:00 PM`,
};

export const TABLE_SCHEDULE: SyllabusFixture = {
  id: 'table-schedule',
  label: 'Table-based weekly schedule (History)',
  covers: ['table-based schedule', 'reading', 'quizzes', 'multiple items in a row'],
  timezone: 'America/Los_Angeles',
  referenceAt: AUG_2026,
  text: `HIST 150 | World History Since 1500 | Fall 2026

Week | Date | Topic | Reading | Due
1 | Aug 31 | Introductions | Read Chapter 1 |
2 | Sep 7 | Labor Day | No class |
3 | Sep 14 | Empires | Read Chapter 2 | Quiz 1
4 | Sep 21 | Trade networks | Read Chapter 3 | Map exercise due
5 | Sep 28 | Revolutions | Read Chapter 4 | Quiz 2`,
};

export const MULTI_LINE: SyllabusFixture = {
  id: 'multi-line',
  label: 'Multi-line items and 24-hour times (Biology lab)',
  covers: ['multi-line assignment', '24-hour time', 'date-only due date'],
  timezone: 'Europe/London',
  referenceAt: AUG_2026,
  text: `BIOL 120 Cell Biology Laboratory
Autumn 2026

Lab Report 1
   Due: 2 October 2026, 17:00
Lab Report 2
   Due: 16 October 2026, 23:59
Poster presentation
   Due: 20 November 2026
Lab practical exam 4 December 2026 09:30`,
};

export const RECURRING_WEEKLY: SyllabusFixture = {
  id: 'recurring-weekly',
  label: 'Recurring weekly reading (Sociology)',
  covers: ['recurring weekly reading'],
  timezone: 'America/New_York',
  referenceAt: AUG_2026,
  text: `SOC 101 Introduction to Sociology
Fall 2026

Reading responses are due every Friday by 5:00 PM.
First class: September 1, 2026
Midterm exam October 15, 2026
Final paper due December 8, 2026`,
};

export const MISSING_YEAR: SyllabusFixture = {
  id: 'missing-year',
  label: 'No year anywhere (Economics)',
  covers: ['missing year'],
  timezone: 'America/New_York',
  referenceAt: AUG_2026,
  text: `ECON 201 Intermediate Microeconomics

Problem set 1 due September 18
Midterm exam October 20
Problem set 2 due November 3`,
};

export const AMBIGUOUS: SyllabusFixture = {
  id: 'ambiguous',
  label: 'Ambiguous timing (Philosophy)',
  covers: ['ambiguous week', 'TBA', 'vague timing', 'ambiguous time'],
  timezone: 'America/Denver',
  referenceAt: AUG_2026,
  text: `PHIL 110 Ethics
Fall 2026

Reflection essay due week of October 19
Paper due near the end of term
Final exam - TBA
Discussion post due September 22 by 5`,
};

export const CONFLICTING: SyllabusFixture = {
  id: 'conflicting',
  label: 'Conflicting deadline (English)',
  covers: ['conflicting deadline', 'duplicate assignment'],
  timezone: 'America/New_York',
  referenceAt: AUG_2026,
  text: `ENGL 205 American Literature
Fall 2026

Calendar
Paper 1 due October 9
Quiz 1 on September 24
Quiz 1 on September 24

Assignment details
Paper 1 due October 12. Submit through the course site.`,
};

export const REVISED: SyllabusFixture = {
  id: 'revised',
  label: 'Revised Chemistry syllabus (dates moved, one item removed, one added)',
  covers: ['revised syllabus'],
  timezone: 'America/New_York',
  referenceAt: Date.UTC(2026, 8, 20, 15, 0),
  text: `CHEM 101: Foundations of Chemistry
Fall 2026 · Section 3 · Revised September 20

Schedule of assessments
Problem Set 1 due Friday, September 11 at 11:59 PM
Quiz 1 on September 15
Problem Set 2 due September 25, 11:59 pm
Quiz 2 on October 8
Midterm Exam: October 16, 2026 at 9:00 AM
Problem Set 3 due October 20 by 5 PM
Read Chapter 7 before October 23
Lab safety module due October 30
Final Project due December 4 at 11:59 PM`,
};

export const MALFORMED_OCR: SyllabusFixture = {
  id: 'malformed-ocr',
  label: 'Badly damaged OCR',
  covers: ['malformed OCR'],
  timezone: 'America/New_York',
  referenceAt: AUG_2026,
  text: `MATH 2l0 Linear A1gebra
F a l l 2O26
~~ Hom ework 3 due 0ct 1O ~~
Ex@m 1 0n Oct  2O
qu1z    l l/O3
### ^^^ ~~~ ¶¶¶`,
};

export const MULTIPLE_COURSES: SyllabusFixture = {
  id: 'multiple-courses',
  label: 'Two courses in one document',
  covers: ['multiple courses'],
  timezone: 'America/New_York',
  referenceAt: AUG_2026,
  text: `Fall 2026 study packet

MATH 140 Calculus I
Homework 1 due September 10
Exam 1 October 1 at 7:00 PM

PHYS 101 Physics for Everyone
Lab report 1 due September 17
Quiz 1 September 24`,
};

export const TERM_CROSSING: SyllabusFixture = {
  id: 'term-crossing',
  label: 'Term crossing the calendar year (Statistics)',
  covers: ['term crossing calendar year'],
  timezone: 'America/New_York',
  referenceAt: AUG_2026,
  text: `STAT 300 Applied Statistics
Fall 2026

Project milestone 2 due December 11
Take-home final exam due January 8 at 12:00 PM
Course reflection due January 12`,
};

export const GOLDEN_FIXTURES: readonly SyllabusFixture[] = [CLEAN_TEXT, SCANNED_OCR, TABLE_SCHEDULE, MULTI_LINE, RECURRING_WEEKLY, MISSING_YEAR, AMBIGUOUS, CONFLICTING, REVISED, MALFORMED_OCR, MULTIPLE_COURSES, TERM_CROSSING];

/** Expected parser output for each fixture (title fragment, type, date, time, trust state). */
export interface GoldenItem {
  title: string;
  type: string;
  due: string | null;
  time?: string | null;
  overall: 'likely' | 'needsReview';
}

const L = 'likely' as const;
const N = 'needsReview' as const;

export const GOLDEN_EXPECTED: Record<string, GoldenItem[]> = {
  'clean-text': [
    { title: 'Problem Set 1', type: 'assignment', due: '2026-09-11', time: '23:59', overall: L },
    { title: 'Quiz 1', type: 'quiz', due: '2026-09-15', time: null, overall: L },
    { title: 'Problem Set 2', type: 'assignment', due: '2026-09-25', time: '23:59', overall: L },
    { title: 'Quiz 2', type: 'quiz', due: '2026-10-06', time: null, overall: L },
    { title: 'Midterm Exam', type: 'exam', due: '2026-10-14', time: '09:00', overall: L },
    { title: 'Problem Set 3', type: 'assignment', due: '2026-10-23', time: '17:00', overall: L },
    { title: 'Read Chapter 7', type: 'reading', due: '2026-10-23', time: null, overall: L },
    { title: 'Final Project proposal', type: 'project', due: '2026-11-06', time: null, overall: L },
    { title: 'Final Project', type: 'project', due: '2026-12-04', time: '23:59', overall: L },
  ],
  'scanned-ocr': [
    { title: 'Article summary 1', type: 'assignment', due: '2026-09-18', overall: L },
    { title: 'Ethics quiz', type: 'quiz', due: '2026-10-02', overall: N },
    { title: 'Article summary 2', type: 'assignment', due: '2026-10-16', overall: N },
    { title: 'Research proposal draft', type: 'assignment', due: '2026-11-06', time: '23:59', overall: L },
    { title: 'Final exam', type: 'exam', due: '2026-12-10', time: '14:00', overall: L },
  ],
  'table-schedule': [
    { title: 'Read Chapter 1', type: 'reading', due: '2026-08-31', overall: L },
    { title: 'Read Chapter 2', type: 'reading', due: '2026-09-14', overall: L },
    { title: 'Quiz 1', type: 'quiz', due: '2026-09-14', overall: L },
    { title: 'Read Chapter 3', type: 'reading', due: '2026-09-21', overall: L },
    { title: 'Map exercise', type: 'assignment', due: '2026-09-21', overall: L },
    { title: 'Read Chapter 4', type: 'reading', due: '2026-09-28', overall: L },
    { title: 'Quiz 2', type: 'quiz', due: '2026-09-28', overall: L },
  ],
  'multi-line': [
    { title: 'Lab Report 1', type: 'lab', due: '2026-10-02', time: '17:00', overall: L },
    { title: 'Lab Report 2', type: 'lab', due: '2026-10-16', time: '23:59', overall: L },
    { title: 'Poster presentation', type: 'presentation', due: '2026-11-20', time: null, overall: L },
    { title: 'Lab practical exam', type: 'exam', due: '2026-12-04', time: '09:30', overall: L },
  ],
  'recurring-weekly': [
    { title: 'Reading responses', type: 'reading', due: null, time: '17:00', overall: L },
    { title: 'Midterm exam', type: 'exam', due: '2026-10-15', overall: L },
    { title: 'Final paper', type: 'paper', due: '2026-12-08', overall: L },
  ],
  'missing-year': [
    { title: 'Problem set 1', type: 'assignment', due: '2026-09-18', overall: N },
    { title: 'Midterm exam', type: 'exam', due: '2026-10-20', overall: N },
    { title: 'Problem set 2', type: 'assignment', due: '2026-11-03', overall: N },
  ],
  ambiguous: [
    { title: 'Reflection essay', type: 'paper', due: '2026-10-19', overall: N },
    { title: 'Paper', type: 'paper', due: null, overall: N },
    { title: 'Final exam', type: 'exam', due: null, overall: N },
    { title: 'Discussion post', type: 'assignment', due: '2026-09-22', overall: N },
  ],
  conflicting: [
    { title: 'Paper 1', type: 'paper', due: '2026-10-09', overall: N },
    { title: 'Quiz 1', type: 'quiz', due: '2026-09-24', overall: L },
  ],
  revised: [
    { title: 'Problem Set 1', type: 'assignment', due: '2026-09-11', time: '23:59', overall: L },
    { title: 'Quiz 1', type: 'quiz', due: '2026-09-15', overall: L },
    { title: 'Problem Set 2', type: 'assignment', due: '2026-09-25', time: '23:59', overall: L },
    { title: 'Quiz 2', type: 'quiz', due: '2026-10-08', overall: L },
    { title: 'Midterm Exam', type: 'exam', due: '2026-10-16', time: '09:00', overall: L },
    { title: 'Problem Set 3', type: 'assignment', due: '2026-10-20', time: '17:00', overall: L },
    { title: 'Read Chapter 7', type: 'reading', due: '2026-10-23', overall: L },
    { title: 'Lab safety module', type: 'lab', due: '2026-10-30', overall: L },
    { title: 'Final Project', type: 'project', due: '2026-12-04', time: '23:59', overall: L },
  ],
  'malformed-ocr': [{ title: 'Hom ework 3', type: 'other', due: '2026-10-10', overall: N }],
  'multiple-courses': [
    { title: 'Homework 1', type: 'assignment', due: '2026-09-10', overall: L },
    { title: 'Exam 1', type: 'exam', due: '2026-10-01', time: '19:00', overall: L },
    { title: 'Lab report 1', type: 'lab', due: '2026-09-17', overall: L },
    { title: 'Quiz 1', type: 'quiz', due: '2026-09-24', overall: L },
  ],
  'term-crossing': [
    { title: 'Project milestone 2', type: 'project', due: '2026-12-11', overall: L },
    { title: 'Take-home final exam', type: 'exam', due: '2027-01-08', time: '12:00', overall: L },
    { title: 'Course reflection', type: 'paper', due: '2027-01-12', overall: L },
  ],
};

/** Compare parser output with the golden list (Syllabus Lab + tests). Returns human-readable differences. */
export function compareWithGolden(fixtureId: string, items: { title: string; type: string; dueDayKey: string | null; dueTime: string | null; overall: string }[]): string[] {
  const expected = GOLDEN_EXPECTED[fixtureId];
  if (!expected) return ['No golden output for this fixture.'];
  const diffs: string[] = [];
  if (items.length !== expected.length) diffs.push(`Expected ${expected.length} items, got ${items.length}.`);
  expected.forEach((e, i) => {
    const got = items[i];
    if (!got) return diffs.push(`Missing: ${e.title}`);
    if (got.title !== e.title) diffs.push(`#${i + 1} title: expected "${e.title}", got "${got.title}"`);
    if (got.type !== e.type) diffs.push(`#${i + 1} type: expected ${e.type}, got ${got.type}`);
    if (got.dueDayKey !== e.due) diffs.push(`#${i + 1} date: expected ${e.due}, got ${got.dueDayKey}`);
    if (e.time !== undefined && got.dueTime !== e.time) diffs.push(`#${i + 1} time: expected ${e.time}, got ${got.dueTime}`);
    if (got.overall !== e.overall) diffs.push(`#${i + 1} trust: expected ${e.overall}, got ${got.overall}`);
  });
  return diffs;
}
