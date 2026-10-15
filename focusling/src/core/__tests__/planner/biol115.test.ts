import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { stripRunningHeaders } from '../../documents/documentText';
import { BIOL115_LAYOUT } from '../../planner/fixtures/courseOutlines';
import { createPlannerState } from '../../planner/plannerState';
import { isSchedulable } from '../../planner/plannerService';
import { chooseDraftYear, commitImport, createImportDraft, draftAttention, draftCounts, resolveDraftConditional, type ImportDraft } from '../../planner/syllabusImport';
import { extractInsights } from '../../planner/syllabusInsights';
import { counterIds } from './helpers';

/**
 * BIOL 115 acceptance, on the text a student actually imported.
 * - BIOL115_LAYOUT (committed): our own wording in the real document's layout.
 * - fixtures/private/biol115-real.txt (git-ignored; copyrighted course material): the real text.
 *   Runs whenever the file is present locally.
 */
const REAL = join(__dirname, '../../planner/fixtures/private/biol115-real.txt');
const sources: [string, string, number][] = [['layout fixture', BIOL115_LAYOUT.text, 8]];
if (existsSync(REAL)) sources.push(['REAL syllabus text', readFileSync(REAL, 'utf8'), 22]);

const NOW = Date.UTC(2026, 7, 25, 13, 0);
const TZ = 'America/Toronto';

describe.each(sources)('BIOL 115 (%s)', (_name, text, lectureCount) => {
  const ins = extractInsights(stripRunningHeaders(text).text);
  const draft = createImportDraft(createPlannerState(NOW, TZ), { text, sourceType: 'emailText', timezone: TZ, now: NOW });
  const by = (d: ImportDraft, k: string) => d.items.find((i) => i.catalogKey === k)!;

  it('course: Essential Biology, BIOL 115 (not the BIOL 112 restriction), McGill University, 3 credits, Fall 2025 heading', () => {
    expect(ins.identity).toMatchObject({ code: 'BIOL 115', title: 'Essential Biology', credits: 3, institution: 'McGill University', term: { season: 'fall', year: 2025 } });
    expect(draft.courses).toHaveLength(1);
    expect(draft.courses[0]).toMatchObject({ code: 'BIOL 115', name: 'Essential Biology' });
  });

  it('people: both instructors and the three TAs', () => {
    expect(ins.people.filter((p) => p.role === 'instructor').map((p) => p.name)).toEqual(['Dr. Gemma de Martino', 'Dr. Sarah Woolley']);
    expect(ins.people.filter((p) => p.role === 'ta').map((p) => p.name)).toEqual(['Aleksei Sychterz', 'Sabrina Percy', 'Ev Berger-Wolf']);
    expect(ins.people.every((p) => p.email)).toBe(true);
  });

  it('class: Tue/Thu 8:35–9:55 AM in McMed 522', () => {
    expect(ins.meetings.map((m) => [m.weekday, m.startMinute, m.endMinute, m.location])).toEqual([
      [2, 515, 595, 'McMed 522'],
      [4, 515, 595, 'McMed 522'],
    ]);
  });

  it('lecture schedule: numbered lectures with their wrapped topics; breaks and review sessions are not lectures', () => {
    const l = ins.lectures!;
    expect(l).toHaveLength(lectureCount);
    expect(l[0]).toMatchObject({ number: 1, month: 9, day: 3, weekday: 4, topic: 'Scientific Method (Woolley)' });
    expect(l.find((x) => x.number === 4)?.topic).toBe('Fundamentals of Evolution: Drift and adaptation');
    expect(l.find((x) => x.number === 8)?.topic).toBe('Brain Evolution: Evolution of Language');
    expect(l.find((x) => x.number === 11)?.topic).toBe('The Chemistry of Life: Water and Macromolecules');
    expect(l.some((x) => /break|review/i.test(x.topic))).toBe(false);
  });

  it('years: Fall 2025 heading vs 2026 deadline and lecture weekdays — asked, with 2026 suggested; approval and citation dates ignored', () => {
    expect(draft.years).toMatchObject({ termYear: 2025, options: [2025, 2026], conflict: true, suggested: 2026, chosen: null });
    expect(draft.years.evidence.some((e) => /lecture schedule/.test(e.note))).toBe(true);
    expect(draftAttention(draft)[0]).toMatchObject({ kind: 'year', options: [2025, 2026] });
  });

  it('assessments: six items with clean titles and stated weights; no weight invented for the exams', () => {
    expect(draft.items.map((i) => i.catalogKey).sort()).toEqual(['assignment1', 'assignment2', 'assignment3', 'assignment4', 'final', 'midterm']);
    expect(draft.items).toHaveLength(6);
    expect(by(draft, 'assignment1').title).toBe('Assignment 1 — Multiple choice questions and answers');
    expect(by(draft, 'assignment2').title).toBe('Assignment 2 — Fun Fact');
    expect(by(draft, 'assignment3').title).toBe('Assignment 3 — Literature assignment A');
    expect(by(draft, 'assignment4').title).toBe('Assignment 4 — Literature assignment B: News Article Video');
    expect(['assignment1', 'assignment2', 'assignment3', 'assignment4', 'midterm', 'final'].map((k) => by(draft, k).weightPercent)).toEqual([5, 10, 15, 20, null, null]);
    expect(draft.insights.grading).toMatchObject({ totalPercent: 50, addsUp: false });
    expect(draftAttention(draft).find((a) => a.kind === 'grading')).toMatchObject({ total: 50, missing: ['Midterm Exam', 'Final Exam'] });
  });

  it('A1 and A2: rules tied to the assigned lecture, with where to find it — never a fake date', () => {
    expect(by(draft, 'assignment1')).toMatchObject({ dueDayKey: null, conditional: { offsetDays: 5, direction: 'after', anchorKind: 'lecture', time: '23:59' } });
    expect(by(draft, 'assignment2')).toMatchObject({ dueDayKey: null, conditional: { offsetDays: 3, direction: 'before', anchorKind: 'lecture', time: '23:59' } });
    expect(by(draft, 'assignment1').conditional?.anchorHint).toMatch(/Groups -> Multiple Choice/);
    expect(by(draft, 'assignment2').conditional?.anchorHint).toMatch(/FUN FACT groups/);
  });

  it('exams: midterm Oct 20 at 7 PM (start of 7–9 PM); final during the exam period with no date', () => {
    expect(by(draft, 'midterm')).toMatchObject({ dueTime: '19:00', writtenDate: { month: 10, day: 20, explicitYear: null } });
    expect(by(draft, 'final')).toMatchObject({ dueDayKey: null });
    expect(by(draft, 'final').reasons).toContain('examPeriod');
    expect(by(draft, 'final').coverage?.chapters).toBe('material only presented after the midterm');
  });

  it('deadlines come from "Deadline:" lines, not "published since" or citation dates', () => {
    expect(by(draft, 'assignment3').writtenDate).toMatchObject({ month: 11, day: 24 });
    expect(by(draft, 'assignment4').writtenDate).toMatchObject({ month: 10, day: 29, explicitYear: 2026 });
    for (const i of draft.items) for (const o of i.dueOptions ?? []) expect(o).not.toMatch(/-01-01$|-09-14$|-11-26$/);
  });

  it('choosing 2026 places every fixed date; nothing else is left to pick', () => {
    const d = chooseDraftYear(draft, 2026);
    expect(by(d, 'assignment3')).toMatchObject({ dueDayKey: '2026-11-24', dueTime: '23:59' });
    expect(by(d, 'assignment4')).toMatchObject({ dueDayKey: '2026-10-29', dueTime: '23:59' });
    expect(by(d, 'midterm')).toMatchObject({ dueDayKey: '2026-10-20', dueTime: '19:00' });
    expect(draftAttention(d).filter((a) => a.kind === 'year' || a.kind === 'choose' || a.kind === 'mismatch')).toEqual([]);
  });

  it('"which lecture?": lecture 4 (Tue Sep 15) puts A1 on Sep 20 and A2 on Sep 12', () => {
    let d = chooseDraftYear(draft, 2026);
    d = resolveDraftConditional(d, by(d, 'assignment1').key, { lecture: 4 });
    d = resolveDraftConditional(d, by(d, 'assignment2').key, { lecture: 4 });
    expect(by(d, 'assignment1')).toMatchObject({ dueDayKey: '2026-09-20', dueTime: '23:59' });
    expect(by(d, 'assignment2')).toMatchObject({ dueDayKey: '2026-09-12', dueTime: '23:59' });
  });

  it('per-item details: submission, late rules, requirements as whole sentences', () => {
    expect(by(draft, 'assignment1').submission).toMatch(/myCourses/);
    expect(by(draft, 'assignment2').late).toMatch(/10% per day/);
    expect(by(draft, 'assignment1').late).toMatch(/bank of extension dates is applicable/);
    for (const i of draft.items) for (const r of i.requirements ?? []) expect(r).toMatch(/[.!?)"]$|^[A-Z][A-Za-z ]{2,25}:/);
  });

  it('policies: late (with what it applies to) and generative AI', () => {
    const late = ins.policies.find((p) => p.kind === 'late');
    expect(late?.summary).toMatch(/Fun Fact/);
    expect(late?.summary).toMatch(/bank/);
    expect(ins.policies.some((p) => p.kind === 'ai')).toBe(true);
  });

  it('commit: the count matches, and only confirmed dates are schedulable', () => {
    const d = chooseDraftYear(draft, 2026);
    const res = commitImport(createPlannerState(NOW, TZ), d, { now: NOW, ids: counterIds(), keepOriginal: false });
    expect(res.createdAssignmentIds).toHaveLength(draftCounts(d).included);
    const saved = Object.values(res.state.assignments);
    expect(saved.find((a) => a.title.startsWith('Assignment 1'))).toMatchObject({ unresolved: 'conditional', dueAt: undefined });
    expect(saved.find((a) => a.title === 'Final Exam')).toMatchObject({ unresolved: 'examPeriod', dueAt: undefined });
    // Dated once the year is chosen; A1/A2 wait for "which lecture?", the final for its date.
    expect(saved.filter(isSchedulable).map((a) => a.title).sort()).toEqual(['Assignment 3 — Literature assignment A', 'Assignment 4 — Literature assignment B: News Article Video', 'Midterm Exam']);
    expect(JSON.stringify(res.state)).not.toMatch(/Grading Scheme|Instructor-generated/);
  });
});
