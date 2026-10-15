import { CA_OUTLINE, US_OUTLINE } from '../../planner/fixtures/courseOutlines';
import { extractInsights, timeRangeIn, weekdaysIn } from '../../planner/syllabusInsights';
import { parseSyllabus } from '../../planner/syllabusParser';
import { stripRunningHeaders } from '../../documents';

const us = extractInsights(US_OUTLINE.text);
const ca = extractInsights(CA_OUTLINE.text);

describe('course identity', () => {
  it('reads institution, code, title, term and section (US)', () => {
    expect(us.identity).toEqual({ institution: 'Northlake University', code: 'CS 1301', subject: 'CS', number: '1301', title: 'Introduction to Computing', term: { season: 'fall', year: 2026 }, section: 'A02', credits: null });
  });
  it('reads institution, code, title, term and section (Canada)', () => {
    expect(ca.identity).toMatchObject({ institution: 'Lakeshore University', code: 'COMP 202', title: 'Foundations of Programming', term: { season: 'fall', year: 2026 }, section: '001' });
  });
});

describe('people, office hours and class meetings', () => {
  it('finds the instructor and TAs with emails only where written', () => {
    expect(us.people.map((p) => [p.role, p.name, p.email ?? null])).toEqual([
      ['instructor', 'Dr. A. Rivera', 'arivera@example.edu'],
      ['ta', 'J. Okafor', 'jokafor@example.edu'],
      ['ta', 'M. Chen', null],
    ]);
    expect(ca.people[0]).toMatchObject({ role: 'instructor', name: 'Prof. L. Tremblay', email: 'ltremblay@example.edu' });
  });

  it('parses office hours with days, times and place', () => {
    const ins = us.officeHours.find((o) => o.who === 'Instructor')!;
    expect(ins.meetings).toEqual([
      { weekday: 2, startMinute: 14 * 60, endMinute: 15 * 60 + 30 },
      { weekday: 4, startMinute: 14 * 60, endMinute: 15 * 60 + 30 },
    ]);
    expect(ins.where).toBe('Room 214');
    expect(us.officeHours.find((o) => o.who === 'TA')!.meetings).toEqual([{ weekday: 3, startMinute: 13 * 60, endMinute: 14 * 60 }]);
  });

  it('parses class meetings, including compact day codes', () => {
    expect(us.meetings.filter((m) => m.kind === 'lecture').map((m) => [m.weekday, m.startMinute, m.endMinute])).toEqual([
      [1, 610, 660],
      [3, 610, 660],
      [5, 610, 660],
    ]);
    expect(ca.meetings.map((m) => [m.kind, m.weekday, m.startMinute, m.endMinute])).toEqual([
      ['lecture', 2, 14 * 60 + 35, 15 * 60 + 55],
      ['lecture', 4, 14 * 60 + 35, 15 * 60 + 55],
      ['tutorial', 4, null, null],
    ]);
  });

  it('weekday and time helpers', () => {
    expect(weekdaysIn('MWF')).toEqual([1, 3, 5]);
    expect(weekdaysIn('TTh')).toEqual([2, 4]);
    expect(weekdaysIn('TR 9:00')).toEqual([2, 4]);
    expect(weekdaysIn('Pick a time')).toEqual([]);
    expect(timeRangeIn('2:30-3:50 pm')).toEqual({ start: 870, end: 950 });
    expect(timeRangeIn('Weeks 1-5')).toBeNull(); // not a time
  });
});

describe('grading breakdown', () => {
  it('reads components, counts ("8 x 4%") and checks the total', () => {
    expect(us.grading).toMatchObject({ totalPercent: 100, addsUp: true });
    expect(us.grading!.components.map((c) => [c.name, c.weightPercent, c.count ?? null])).toEqual([
      ['Homework', 32, 8],
      ['Quizzes', 10, null],
      ['Midterm Exam', 23, null],
      ['Final Exam', 30, null],
      ['Participation', 5, null],
    ]);
  });

  it('a table that adds up to 95% is shown as not adding up, never "fixed"', () => {
    expect(ca.grading).toMatchObject({ totalPercent: 95, addsUp: false });
    expect(ca.grading!.components.map((c) => c.name)).toEqual(['Assignment 1', 'Assignment 2', 'Midterm (Chapters 1-4)', 'Final examination']);
  });
});

describe('course structure', () => {
  it('reads the weekly schedule table with dates and readings', () => {
    expect(us.schedule.map((w) => [w.week, w.startDayKey, w.topic, w.readings])).toEqual([
      [1, '2026-08-31', 'Course overview and Python basics', 'Ch. 1'],
      [2, '2026-09-07', 'Variables and expressions', 'Ch. 2'],
      [3, '2026-09-14', 'Conditionals', 'Ch. 3'],
      [4, '2026-09-21', 'Loops', 'Ch. 4'],
    ]);
    expect(us.schedule[0]!.provenance).toMatchObject({ page: 3 });
  });

  it('keeps only explicit coverage relationships', () => {
    expect(us.coverage).toEqual([expect.objectContaining({ itemTitle: 'Midterm Exam', weeks: { from: 1, to: 7 }, provenance: expect.objectContaining({ page: 2 }) })]);
    expect(ca.coverage).toEqual([]); // "Midterm (Chapters 1-4)" is handled on the item itself, not invented here
  });

  it('administrative dates and no-class days are key dates, not assignments', () => {
    expect(us.keyDates.map((k) => [k.kind, k.dayKey])).toEqual([
      ['drop', '2026-09-04'],
      ['noClass', '2026-09-07'],
    ]);
    expect(ca.keyDates.map((k) => [k.kind, k.dayKey])).toEqual([
      ['withdraw', '2026-11-03'],
      ['noClass', '2026-10-12'],
    ]);
  });

  it('records policy headings only (no policy text)', () => {
    expect(us.policies.map((p) => p.title)).toEqual(['Late Work Policy', 'Academic Integrity']);
    expect(ca.policies.map((p) => p.title)).toEqual(['Accommodations']);
  });

  it('missing information stays missing', () => {
    const bare = extractInsights('Quiz 1 due Sept 9');
    expect(bare.identity.institution).toBeNull();
    expect(bare.identity.term).toBeNull();
    expect(bare.grading).toBeNull();
    expect(bare.people).toEqual([]);
  });
});

describe('date reasoning on the US outline', () => {
  const text = stripRunningHeaders(US_OUTLINE.text).text;
  const r = parseSyllabus({ text, timezone: US_OUTLINE.timezone, referenceAt: US_OUTLINE.referenceAt });
  const find = (t: string) => r.candidates.find((c) => c.title.startsWith(t))!;

  it('release date vs due date', () => {
    const hw1 = find('Homework 1');
    expect(hw1.dueDayKey).toBe('2026-09-11');
    expect(hw1.availableDayKey).toBe('2026-08-31');
    expect(hw1.dueTime).toBe('23:59');
  });

  it('weight and stated time zone on the line; the year is traceably inferred from the term', () => {
    const hw1 = find('Homework 1');
    expect(hw1.weightPercent).toBe(4);
    expect(hw1.statedZone).toEqual({ label: 'ET', zone: 'America/New_York' });
    expect(hw1.reasons).not.toContain('timeZoneStated'); // same zone as the course
    expect(hw1.inferences).toEqual([{ field: 'year', note: 'Year 2026 from “Fall 2026”' }]);
    expect(hw1.title).toBe('Homework 1');
  });

  it('a tentative date needs review', () => {
    const q = find('Quiz 1');
    expect(q.reasons).toContain('tentative');
    expect(q.dateConfidence).toBe('needsReview');
  });

  it('an exam period is a window, never a due date', () => {
    const f = find('Final Exam');
    expect(f.dueDayKey).toBeNull();
    expect(f.window).toEqual({ from: '2026-12-08', to: '2026-12-17' });
    expect(f.reasons).toContain('examPeriod');
  });

  it('a stated time zone that differs from the course zone is flagged', () => {
    const p = parseSyllabus({ text: 'Fall 2026\nEssay 1 due October 3 at 11:59 PM PT', timezone: 'America/New_York', referenceAt: US_OUTLINE.referenceAt });
    expect(p.candidates[0]!.reasons).toContain('timeZoneStated');
    expect(p.candidates[0]!.statedZone).toEqual({ label: 'PT', zone: 'America/Los_Angeles' });
  });

  it('schedule readings get readable titles and never claim "coverage"', () => {
    const reading = r.candidates.find((c) => c.title === 'Reading: Ch. 1')!;
    expect(reading.type).toBe('reading');
    expect(reading.coverage).toBeNull();
  });

  it('running headers are not mistaken for items and page numbers vanish', () => {
    expect(r.candidates.some((c) => /page \d/i.test(c.title))).toBe(false);
  });
});

describe('date reasoning on the Canadian outline', () => {
  const r = parseSyllabus({ text: CA_OUTLINE.text, timezone: CA_OUTLINE.timezone, referenceAt: CA_OUTLINE.referenceAt });
  const find = (t: string) => r.candidates.find((c) => c.title.startsWith(t));

  it('conflicting dates are flagged, not chosen', () => {
    const a2 = find('Assignment 2')!;
    expect(a2.dueOptions).toEqual(['2026-10-18', '2026-10-21']);
    expect(a2.reasons).toContain('conflictingDates');
  });

  it('a TBA final stays unresolved (no invented date)', () => {
    const fin = r.candidates.filter((c) => /^final examination/i.test(c.title));
    expect(fin.length).toBeGreaterThan(0);
    expect(fin.every((c) => c.dueDayKey === null && c.reasons.includes('tba'))).toBe(true);
  });

  it('chapters named on the item become its coverage; weights come from the row', () => {
    const mid = find('Midterm')!;
    expect(mid.coverage).toEqual({ weeks: null, chapters: 'Chapters 1-4' });
    expect(mid.weightPercent).toBe(25);
    expect(mid.dueDayKey).toBe('2026-10-22');
  });

  it('recurring tutorials are class meetings (not assignments), and reading week is not an assignment', () => {
    expect(find('Tutorials')).toBeUndefined();
    expect(r.candidates.some((c) => /reading week/i.test(c.title))).toBe(false);
  });
});
