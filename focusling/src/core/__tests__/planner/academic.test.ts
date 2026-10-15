import { buildCatalog, cleanItemTitle, readLines } from '../../planner/academicReading';
import { BIOL115_RECONSTRUCTED, CA_OUTLINE, UK_OUTLINE, US_OUTLINE } from '../../planner/fixtures/courseOutlines';
import { createPlannerState } from '../../planner/plannerState';
import { isSchedulable, resolveConditional, chooseDueCandidate } from '../../planner/plannerService';
import { chooseDraftYear, commitImport, createImportDraft, draftAttention, draftCounts, editDraftItem, resolveDraftConditional, type ImportDraft } from '../../planner/syllabusImport';
import { extractInsights } from '../../planner/syllabusInsights';
import { stripRunningHeaders } from '../../documents/documentText';
import type { PlannerState } from '../../models';
import { counterIds } from './helpers';

/**
 * Syllabus Intelligence rebuild: acceptance tests. BIOL 115 uses a fixture
 * RECONSTRUCTED from the reported facts of a real McGill syllabus; the real
 * file has not been tested (see docs/SYLLABUS_INTELLIGENCE.md).
 */
const f = BIOL115_RECONSTRUCTED;
const fresh = () => createPlannerState(f.referenceAt, f.timezone);
const draftOf = (text = f.text, state: PlannerState = fresh(), tz = f.timezone, now = f.referenceAt) => createImportDraft(state, { text, sourceType: 'pdf', filename: 'biol115.pdf', timezone: tz, now });
const byKey = (d: ImportDraft, k: string) => d.items.find((i) => i.catalogKey === k)!;
const insights = extractInsights(stripRunningHeaders(f.text).text);

describe('BIOL 115: course identity and people', () => {
  it('reads BIOL 115 (not the BIOL 112 prerequisite), the title, McGill and 3 credits', () => {
    expect(insights.identity).toMatchObject({ code: 'BIOL 115', title: 'Essential Biology', credits: 3 });
    expect(insights.identity.institution).toMatch(/McGill University/);
    const d = draftOf();
    expect(d.courses).toHaveLength(1);
    expect(d.courses[0]).toMatchObject({ code: 'BIOL 115', name: 'Essential Biology' });
  });

  it('still reads BIOL 115 when the prerequisite line comes before the title', () => {
    const text = `Prerequisite: BIOL 112 or equivalent\n${f.text}`;
    expect(extractInsights(stripRunningHeaders(text).text).identity.code).toBe('BIOL 115');
    expect(draftOf(text).courses[0]!.code).toBe('BIOL 115');
  });

  it('finds both instructors', () => {
    expect(insights.people.filter((p) => p.role === 'instructor').map((p) => p.name)).toEqual(['Dr. Gemma de Martino', 'Dr. Sarah Woolley']);
  });

  it('finds class days, times and location: Tue/Thu 8:35–9:55 AM, McMed 522', () => {
    const classes = insights.meetings.map((m) => [m.weekday, m.startMinute, m.endMinute, m.location]);
    expect(classes).toEqual([
      [2, 515, 595, 'McMed 522'],
      [4, 515, 595, 'McMed 522'],
    ]);
  });

  it('keeps the late, AI and integrity policies with a short summary', () => {
    expect(insights.policies.map((p) => p.kind).sort()).toEqual(['ai', 'integrity', 'late']);
    expect(insights.policies.every((p) => p.summary && p.summary.length > 10)).toBe(true);
  });

  it('reads the lecture topics', () => {
    expect(insights.lectures?.map((l) => l.topic)).toContain('Cells and organelles');
  });
});

describe('BIOL 115: assessments', () => {
  const d = draftOf();

  it('finds all six assessments with clean titles (no sentence fragments)', () => {
    const titles = d.items.map((i) => i.title);
    expect(titles).toEqual(expect.arrayContaining(['Assignment 1 — Multiple-choice questions and answers', 'Assignment 2 — Fun Fact', 'Assignment 3 — Literature Assignment A', 'Assignment 4 — Literature Assignment B (video)', 'Midterm Exam', 'Final Exam']));
    expect(d.items).toHaveLength(6);
    for (const t of titles) expect(t).not.toMatch(/uploaded|will be|must be|myCourses/i);
  });

  it('keeps the stated weights and never invents the final exam’s', () => {
    expect([1, 2, 3, 4].map((n) => byKey(d, `assignment${n}`).weightPercent)).toEqual([5, 10, 15, 20]);
    expect(byKey(d, 'midterm').weightPercent).toBe(20);
    expect(byKey(d, 'final').weightPercent).toBeNull();
    expect(draftAttention(d).find((a) => a.kind === 'grading')).toMatchObject({ total: 70, missing: ['Final Exam'] });
  });

  it('A1 and A2 are conditional on the student’s assigned lecture: no fake fixed date', () => {
    expect(byKey(d, 'assignment1')).toMatchObject({ dueDayKey: null, conditional: { offsetDays: 5, direction: 'after', anchorKind: 'lecture' } });
    expect(byKey(d, 'assignment2')).toMatchObject({ dueDayKey: null, conditional: { offsetDays: 3, direction: 'before', anchorKind: 'lecture' } });
    const asks = draftAttention(d).filter((a) => a.kind === 'conditional');
    expect(asks.map((a) => (a.kind === 'conditional' ? a.question : ''))).toEqual(['Which lecture were you assigned?', 'Which lecture were you assigned?']);
  });

  it('the midterm is Oct 20, 7 PM (start of 7–9 PM) and covers lectures 1–10; the final is in the exam period with no date', () => {
    expect(byKey(d, 'midterm')).toMatchObject({ dueTime: '19:00', writtenDate: { month: 10, day: 20, explicitYear: null } });
    expect(byKey(d, 'midterm').coverage?.chapters).toMatch(/lectures 1.10/);
    expect(byKey(d, 'final')).toMatchObject({ dueDayKey: null });
    expect(byKey(d, 'final').reasons).toContain('examPeriod');
  });

  it('A4 keeps its requirements and how to submit', () => {
    const a4 = byKey(d, 'assignment4');
    expect(a4.requirements?.join(' ')).toMatch(/video/);
    expect(a4.submission).toMatch(/myCourses/);
  });
});

describe('BIOL 115: conflicting years are explained, never silently defaulted', () => {
  const d = draftOf();

  it('sees 2025 (heading, lecture weekdays) and 2026 (explicit date, exam weekdays) and asks', () => {
    expect(d.years).toMatchObject({ termYear: 2025, options: [2025, 2026], conflict: true, chosen: null });
    expect(d.years.evidence.map((e) => e.kind)).toEqual(expect.arrayContaining(['heading', 'explicitDate', 'weekday']));
    expect(draftAttention(d)[0]).toMatchObject({ kind: 'year', options: [2025, 2026] });
  });

  it('nothing that depends on the year has a date until the student answers', () => {
    for (const k of ['assignment4', 'midterm']) expect(byKey(d, k)).toMatchObject({ dueDayKey: null });
    expect(byKey(d, 'assignment4').reasons).toContain('yearConflict');
    // Written with 2026 while the heading says 2025: both readings offered.
    expect(byKey(d, 'assignment3').dueOptions).toEqual(['2025-11-24', '2026-11-24']);
  });

  it('choosing 2026 places the dates; the weekdays then agree', () => {
    const y = chooseDraftYear(d, 2026);
    expect(byKey(y, 'assignment3')).toMatchObject({ dueDayKey: '2026-11-24', dueTime: '23:59' });
    expect(byKey(y, 'assignment4')).toMatchObject({ dueDayKey: '2026-10-29', dueTime: '23:59' });
    expect(byKey(y, 'midterm')).toMatchObject({ dueDayKey: '2026-10-20', dueTime: '19:00' });
    expect(draftAttention(y).some((a) => a.kind === 'mismatch' || a.kind === 'year')).toBe(false);
  });

  it('choosing 2025 places the dates but flags the weekday mismatches and the 2026 date', () => {
    const y = chooseDraftYear(d, 2025);
    expect(byKey(y, 'midterm').dueDayKey).toBe('2025-10-20');
    expect(byKey(y, 'midterm').notes).toEqual(['The syllabus says Tuesday, but October 20, 2025 is a Monday.']);
    expect(byKey(y, 'assignment4').notes?.[0]).toMatch(/Thursday, but October 29, 2025 is a Wednesday/);
    expect(byKey(y, 'assignment3').dueOptions).toEqual(['2025-11-24', '2026-11-24']);
  });

  it('a year answer never overwrites a date the student set', () => {
    const edited = editDraftItem(d, byKey(d, 'midterm').key, { dueDayKey: '2026-10-21' });
    expect(byKey(chooseDraftYear(edited, 2025), 'midterm').dueDayKey).toBe('2026-10-21');
  });

  it('ignores years that are not in the evidence', () => {
    expect(chooseDraftYear(d, 2031)).toBe(d);
  });
});

describe('BIOL 115: conditional deadlines', () => {
  it('“which lecture?” works out A1 (+5 days) and A2 (−3 days) once the year is known', () => {
    let d = chooseDraftYear(draftOf(), 2025);
    d = resolveDraftConditional(d, byKey(d, 'assignment1').key, { lecture: 3 }); // Tue Sep 9, 2025
    d = resolveDraftConditional(d, byKey(d, 'assignment2').key, { lecture: 3 });
    expect(byKey(d, 'assignment1')).toMatchObject({ dueDayKey: '2025-09-14', dueTime: '23:59', confidence: { due: 'confirmed' } });
    expect(byKey(d, 'assignment2')).toMatchObject({ dueDayKey: '2025-09-06' });
    expect(byKey(d, 'assignment1').conditional?.anchorLabel).toBe('Lecture 3: Membranes and transport');
    // Changing the year moves the lecture, and so the deadline.
    expect(byKey(chooseDraftYear(d, 2026), 'assignment1').dueDayKey).toBe('2026-09-14');
  });

  it('a lecture answer before the year is known leaves the date empty', () => {
    const d = draftOf();
    const r = resolveDraftConditional(d, byKey(d, 'assignment1').key, { lecture: 3 });
    expect(byKey(r, 'assignment1').dueDayKey).toBeNull();
  });

  it('can be answered with a date instead of a lecture', () => {
    const d = draftOf();
    const r = resolveDraftConditional(d, byKey(d, 'assignment2').key, { dayKey: '2026-10-01' });
    expect(byKey(r, 'assignment2').dueDayKey).toBe('2026-09-28');
  });
});

describe('BIOL 115: commit, planner and re-import', () => {
  const ids = counterIds();
  const now = f.referenceAt;
  const draft = draftOf();
  const counts = draftCounts(draft);
  const res = commitImport(fresh(), draft, { now, ids, keepOriginal: false });
  const saved = Object.values(res.state.assignments);
  const get = (t: RegExp) => saved.find((a) => t.test(a.title))!;

  it('the button count equals what is saved', () => {
    expect(counts.included).toBe(6);
    expect(res.createdAssignmentIds).toHaveLength(counts.included);
  });

  it('unresolved dates stay unscheduled and are never planned', () => {
    expect(get(/^Assignment 1/)).toMatchObject({ unresolved: 'conditional', dueAt: undefined });
    expect(get(/^Midterm/)).toMatchObject({ unresolved: 'yearConflict', dueAt: undefined });
    expect(get(/^Midterm/).dueCandidates?.map((c) => c.dayKey)).toEqual(['2025-10-20', '2026-10-20']);
    expect(get(/^Final/)).toMatchObject({ unresolved: 'examPeriod', dueAt: undefined });
    expect(saved.filter(isSchedulable)).toHaveLength(0);
  });

  it('saves requirements, submission, the conditional rule, lectures and the year evidence', () => {
    expect(get(/^Assignment 4/).requirements?.length).toBeGreaterThan(0);
    expect(get(/^Assignment 4/).submission).toMatch(/myCourses/);
    expect(get(/^Assignment 2/).conditional).toMatchObject({ offsetDays: 3, direction: 'before' });
    const course = Object.values(res.state.courses)[0]!;
    expect(course.details?.lectures?.length).toBe(5);
    expect(course.details?.years?.conflict).toBe(true);
    expect(course.meetingSchedule).toEqual([
      { weekday: 2, startMinute: 515, endMinute: 595 },
      { weekday: 4, startMinute: 515, endMinute: 595 },
    ]);
  });

  it('answering later on the saved assignment sets the date as the student’s own edit', () => {
    const a1 = get(/^Assignment 1/);
    const r = resolveConditional(res.state, a1.id, '2026-09-08', 'Lecture 3', now);
    expect(r.state.assignments[a1.id]).toMatchObject({ unresolved: undefined, userOverrides: { due: true }, fieldConfidence: { due: 'confirmed' } });
    expect(isSchedulable(r.state.assignments[a1.id]!)).toBe(true);
    const mid = get(/^Midterm/);
    const m = chooseDueCandidate(r.state, mid.id, '2026-10-20', now);
    expect(m.state.assignments[mid.id]).toMatchObject({ unresolved: undefined, dueCandidates: undefined, userOverrides: { due: true } });

    // Re-importing the same syllabus is a no-op; a newer parser revision never resets these answers.
    expect(draftOf(f.text, m.state).duplicateOfSyllabusId).not.toBeNull();
    const again = commitImport(m.state, { ...draftOf(f.text, m.state), duplicateOfSyllabusId: null, contentHash: 'revised' }, { now, ids, keepOriginal: false });
    expect(again.createdAssignmentIds).toHaveLength(0);
    expect(again.state.assignments[a1.id]!.dueAt).toBe(m.state.assignments[a1.id]!.dueAt);
    expect(again.state.assignments[mid.id]!.dueAt).toBe(m.state.assignments[mid.id]!.dueAt);
  });
});

describe('other syllabi (US, Canadian, UK)', () => {
  const titles = (text: string, tz: string, now: number) => createImportDraft(createPlannerState(now, tz), { text, sourceType: 'pdf', timezone: tz, now }).items.map((i) => i.title);

  it('US: grading rows are not items; the final project is not the final exam', () => {
    const d = createImportDraft(createPlannerState(US_OUTLINE.referenceAt, US_OUTLINE.timezone), { text: US_OUTLINE.text, sourceType: 'pdf', timezone: US_OUTLINE.timezone, now: US_OUTLINE.referenceAt });
    expect(d.items.map((i) => i.title)).not.toContain('Homework');
    expect(d.items.find((i) => i.title === 'Midterm Exam')).toMatchObject({ dueDayKey: '2026-10-21', weightPercent: 23 });
    expect(d.items.find((i) => i.title === 'Final Exam')).toMatchObject({ dueDayKey: null, window: { from: '2026-12-08', to: '2026-12-17' } });
    expect(d.items.find((i) => i.title === 'Final project')).toMatchObject({ dueDayKey: '2026-12-04' });
    expect(d.years.conflict).toBe(false);
  });

  it('Canada: table rows read as named items; the conflicting deadline stays a choice', () => {
    const t = titles(CA_OUTLINE.text, CA_OUTLINE.timezone, CA_OUTLINE.referenceAt);
    expect(t).toEqual(['Assignment 1', 'Assignment 2', 'Midterm Exam', 'Final Exam']);
    const d = createImportDraft(createPlannerState(CA_OUTLINE.referenceAt, CA_OUTLINE.timezone), { text: CA_OUTLINE.text, sourceType: 'pdf', timezone: CA_OUTLINE.timezone, now: CA_OUTLINE.referenceAt });
    expect(d.items[1]!.dueOptions).toEqual(['2026-10-18', '2026-10-21']);
  });

  it('UK: day-month dates, coursework names and an unscheduled examination period', () => {
    const d = createImportDraft(createPlannerState(UK_OUTLINE.referenceAt, UK_OUTLINE.timezone), { text: UK_OUTLINE.text, sourceType: 'pdf', timezone: UK_OUTLINE.timezone, now: UK_OUTLINE.referenceAt });
    expect(d.items.map((i) => [i.title, i.type, i.dueDayKey, i.weightPercent])).toEqual([
      ['Coursework 1 — Problem set', 'assignment', '2026-10-23', 20],
      ['Coursework 2 — Essay', 'assignment', '2026-11-27', 30],
      ['Exam', 'exam', null, 50],
    ]);
  });

  it('international: a semester heading and German-style dates still need no guessing', () => {
    const text = `Universität Beispiel\nINF 1001 Programmierung\nWinter 2027\nAssignment 1: 12.02.2027\nFinal exam: during the examination period`;
    const d = createImportDraft(createPlannerState(Date.UTC(2027, 0, 5), 'Europe/Berlin'), { text, sourceType: 'pdf', timezone: 'Europe/Berlin', now: Date.UTC(2027, 0, 5) });
    expect(d.items.find((i) => /Final/.test(i.title))).toMatchObject({ dueDayKey: null });
    expect(d.years.conflict).toBe(false);
  });
});

describe('malformed and partial documents', () => {
  const draft = (text: string) => createImportDraft(createPlannerState(f.referenceAt, f.timezone), { text, sourceType: 'emailText', timezone: f.timezone, now: f.referenceAt });

  it('a page with no dates creates nothing with a fake date', () => {
    const d = draft('BIOL 115 Essential Biology\nWelcome to the course!\nAssignment 1: Fun Fact (10%)\nMore information to follow.');
    expect(d.items.every((i) => i.dueDayKey === null)).toBe(true);
    expect(draftAttention(d).some((a) => a.kind === 'noDate')).toBe(true);
  });

  it('garbled text and empty input do not crash', () => {
    expect(draft('%%%% ||| 12/ /2 ### Assignment : : (%)').items).toBeDefined();
    expect(draft('').items).toEqual([]);
  });

  it('a conditional deadline with no lecture list can be answered with a date', () => {
    const d = draft('PSYC 100 Fall 2026\nPresentation 1 (10%)\nThe handout is due two days before your scheduled presentation.');
    const p = d.items.find((i) => i.conditional);
    expect(p?.conditional).toMatchObject({ offsetDays: 2, direction: 'before', anchorKind: 'presentation' });
    expect(draftAttention(d).find((a) => a.kind === 'conditional')).toMatchObject({ question: 'When is your presentation?' });
  });

  it('cleans sentence titles without inventing names', () => {
    expect(cleanItemTitle('The midterm will be written', 'exam')).toBe('Midterm Exam');
    expect(cleanItemTitle('Your summary must be uploaded to myCourses Assignment 3 tab', 'assignment')).toBe('Assignment 3');
    expect(cleanItemTitle('Lab Report 2', 'lab')).toBe('Lab Report 2');
  });

  it('the catalog never treats the heading of another item as part of this one', () => {
    const cat = buildCatalog(readLines('Midterm exam (20%)\nCoursework 1 deadline: 23/10/2026\nThe midterm covers weeks 1-6.'));
    expect(cat.find((e) => e.key === 'midterm')?.dates).toEqual([]);
  });
});
