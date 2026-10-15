import { CA_OUTLINE, US_OUTLINE } from '../../planner/fixtures/courseOutlines';
import { createPlannerState, migratePlanner } from '../../planner/plannerState';
import { commitImport, confirmDraftItem, createImportDraft, editDraftItem, linkDraftItem, setDraftDetails, titleSimilarity, trustStatusOf, unlinkDraftItem, assignmentTrustStatus, type ImportDraft } from '../../planner/syllabusImport';
import { courseSpaceKeyOf } from '../../planner/courseIdentity';
import { LocalSyllabusAnalysisProvider, UnavailableRemoteSyllabusAnalysisProvider } from '@/services/syllabusAnalysis/SyllabusAnalysisProvider';
import type { PlannerState } from '../../models';
import { counterIds } from './helpers';

const NOW = US_OUTLINE.referenceAt;
const draftOf = (state: PlannerState, text = US_OUTLINE.text, tz = US_OUTLINE.timezone) => createImportDraft(state, { text, sourceType: 'pdf', filename: 'cs1301.pdf', timezone: tz, now: NOW });
const item = (d: ImportDraft, t: string) => d.items.find((i) => i.title.startsWith(t))!;

describe('draft understanding', () => {
  const d = draftOf(createPlannerState(NOW, US_OUTLINE.timezone));

  it('the draft carries course insights and ignores running headers', () => {
    expect(d.insights.identity.code).toBe('CS 1301');
    expect(d.courses[0]).toMatchObject({ code: 'CS 1301', name: 'Introduction to Computing', term: 'Fall 2026' });
    expect(d.ignoredHeaderLines).toBeGreaterThan(0);
    expect(d.details).toEqual({ save: true, saveContacts: false });
  });

  it('links an exam to the schedule topics it explicitly covers', () => {
    expect(item(d, 'Midterm Exam').coverage).toEqual({ weeks: { from: 1, to: 7 }, chapters: null, topics: ['Course overview and Python basics', 'Variables and expressions', 'Conditionals', 'Loops'] });
    expect(item(d, 'Homework 2').coverage).toBeNull(); // nothing stated → nothing invented
  });

  it('trust statuses say what Studyling knows and doesn’t', () => {
    expect(trustStatusOf(item(d, 'Homework 1'))).toBe('inferred'); // year from "Fall 2026"
    expect(trustStatusOf(item(d, 'Quiz 1'))).toBe('needsReview'); // tentative
    expect(trustStatusOf(item(d, 'Final Exam'))).toBe('notSpecified'); // exam period only
    const confirmed = confirmDraftItem(d, item(d, 'Homework 2').key);
    expect(trustStatusOf(item(confirmed, 'Homework 2'))).toBe('confirmedByYou');
    const ca = draftOf(createPlannerState(NOW, CA_OUTLINE.timezone), CA_OUTLINE.text, CA_OUTLINE.timezone);
    expect(trustStatusOf(item(ca, 'Assignment 2'))).toBe('conflicting');
  });
});

describe('commit', () => {
  const ids = counterIds();
  const d = draftOf(createPlannerState(NOW, US_OUTLINE.timezone));
  const res = commitImport(createPlannerState(NOW, US_OUTLINE.timezone), d, { now: NOW, ids, keepOriginal: false });
  const course = res.state.courses[res.courseIds[0]!]!;
  const a = (t: string) => Object.values(res.state.assignments).find((x) => x.title.startsWith(t))!;

  it('saves course details, but not email addresses unless the student asks', () => {
    expect(course.details?.identity.institution).toBe('Northlake University');
    expect(course.details?.grading?.totalPercent).toBe(100);
    expect(course.details?.people.map((p) => p.name)).toEqual(['Dr. A. Rivera', 'J. Okafor', 'M. Chen']);
    expect(JSON.stringify(course.details)).not.toMatch(/@example\.edu/);
    expect(course.meetingSchedule).toEqual([
      { weekday: 1, startMinute: 610, endMinute: 660 },
      { weekday: 3, startMinute: 610, endMinute: 660 },
      { weekday: 5, startMinute: 610, endMinute: 660 },
    ]);
    const withContacts = commitImport(createPlannerState(NOW, US_OUTLINE.timezone), setDraftDetails(d, { saveContacts: true }), { now: NOW, ids: counterIds(), keepOriginal: false });
    expect(JSON.stringify(Object.values(withContacts.state.courses)[0]!.details)).toMatch(/arivera@example\.edu/);
    const none = commitImport(createPlannerState(NOW, US_OUTLINE.timezone), setDraftDetails(d, { save: false }), { now: NOW, ids: counterIds(), keepOriginal: false });
    expect(Object.values(none.state.courses)[0]!.details).toBeUndefined();
  });

  it('assignments keep weight, release date, coverage and how the year was inferred', () => {
    expect(a('Homework 1')).toMatchObject({ weight: 4, inferenceNotes: ['Year 2026 from “Fall 2026”'] });
    expect(a('Homework 1').availableAt).toBeDefined();
    expect(a('Midterm Exam').coverage?.weeks).toEqual({ from: 1, to: 7 });
    expect(assignmentTrustStatus(a('Homework 2'))).toBe('inferred');
  });

  it('an exam period or TBA final is an unresolved requirement with no invented date', () => {
    const fin = a('Final Exam');
    expect(fin.dueAt).toBeUndefined();
    expect(fin.unresolved).toBe('examPeriod');
    expect(fin.window).toBeDefined();
    expect(fin.reviewState).toBe('needsReview');
    expect(assignmentTrustStatus(fin)).toBe('notSpecified');
  });

  it('administrative dates are course key dates, never tasks', () => {
    expect(Object.values(res.state.assignments).some((x) => /drop/i.test(x.title))).toBe(false);
    expect(course.details?.keyDates.map((k) => k.kind)).toContain('drop');
  });

  it('nothing reaches the event log as text', () => {
    expect(JSON.stringify(res.state.events)).not.toMatch(/Rivera|Homework|Northlake/);
  });
});

describe('revised syllabus', () => {
  const ids = counterIds();
  const v1 = commitImport(createPlannerState(NOW, US_OUTLINE.timezone), draftOf(createPlannerState(NOW, US_OUTLINE.timezone)), { now: NOW, ids, keepOriginal: false }).state;
  const revisedText = US_OUTLINE.text
    .replace('Homework 2 due Sept 25 at 11:59 PM ET', 'Homework Two due Sept 28 at 11:59 PM ET')
    .replace('Quizzes 10%', 'Quizzes 15%')
    .replace('Participation 5%', '')
    .replace('Week 4 | Sep 21 | Loops | Ch. 4', 'Week 4 | Sep 21 | Loops and lists | Ch. 4');

  it('re-importing the same syllabus is a no-op (idempotent)', () => {
    const again = draftOf(v1);
    expect(again.duplicateOfSyllabusId).not.toBeNull();
    const r = commitImport(v1, again, { now: NOW + 1000, ids, keepOriginal: false });
    expect(r.state).toBe(v1);
  });

  it('shows changed course details before applying them', () => {
    const d = draftOf(v1, revisedText);
    expect(d.detailsDiff).toEqual(
      expect.arrayContaining([
        { area: 'grading', label: 'Quizzes', from: '10%', to: '15%' },
        { area: 'grading', label: 'Participation', from: '5%', to: null },
        { area: 'schedule', label: 'Week 4', from: 'Loops', to: 'Loops and lists' },
      ]),
    );
  });

  it('a renamed item is offered as a possible match; linking updates it instead of duplicating', () => {
    const d = draftOf(v1, revisedText);
    const renamed = item(d, 'Homework Two');
    expect(renamed.possibleMatch?.title).toBe('Homework 2');
    const linked = linkDraftItem(v1, d, renamed.key);
    const li = item(linked, 'Homework Two');
    expect(li.change).toBe('changed');
    expect(linked.items.some((i) => i.change === 'removed' && i.title === 'Homework 2')).toBe(false);
    const before = Object.keys(v1.assignments).length;
    const after = commitImport(v1, linked, { now: NOW + 1000, ids, keepOriginal: false }).state;
    expect(Object.keys(after.assignments).length).toBe(before);
    const hw = Object.values(after.assignments).find((x) => x.id === li.existingAssignmentId)!;
    expect(hw.title).toBe('Homework Two');
  });

  it('saying "different items" keeps both, and the old one is flagged, not deleted', () => {
    const d = unlinkDraftItem(draftOf(v1, revisedText), item(draftOf(v1, revisedText), 'Homework Two').key);
    const after = commitImport(v1, d, { now: NOW + 1000, ids, keepOriginal: false }).state;
    const old = Object.values(after.assignments).find((x) => x.title === 'Homework 2')!;
    expect(old.deletedAt).toBeUndefined();
    expect(old.missingFromSource).toBe(true);
  });

  it('a student’s own edits survive a revision (shown as a conflict, not overwritten)', () => {
    const d1 = draftOf(createPlannerState(NOW, US_OUTLINE.timezone));
    const base = commitImport(createPlannerState(NOW, US_OUTLINE.timezone), d1, { now: NOW, ids: counterIds(), keepOriginal: false }).state;
    const hw1 = Object.values(base.assignments).find((x) => x.title === 'Homework 1')!;
    const edited: PlannerState = { ...base, assignments: { ...base.assignments, [hw1.id]: { ...hw1, title: 'HW1 (my notes)', userOverrides: { title: true }, sourceAuthority: 'syllabus' } } };
    const rev = draftOf(edited, US_OUTLINE.text.replace('Homework 1 released Aug 31, due Sept 11', 'Homework 1 released Aug 31, due Sept 12'));
    const after = commitImport(edited, rev, { now: NOW + 1000, ids: counterIds(), keepOriginal: false }).state;
    expect(after.assignments[hw1.id]!.title).toBe('HW1 (my notes)');
  });

  it('title similarity is word overlap', () => {
    expect(titleSimilarity('Homework 2', 'Homework Two')).toBeCloseTo(1 / 3);
    expect(titleSimilarity('Problem Set 3', 'Problem Set 3 (revised)')).toBeGreaterThanOrEqual(0.5);
  });
});

describe('student control in review', () => {
  it('editing a due date confirms it; excluded items are not imported', () => {
    let d = draftOf(createPlannerState(NOW, US_OUTLINE.timezone));
    d = editDraftItem(d, item(d, 'Final Exam').key, { dueDayKey: '2026-12-12', dueTime: '09:00' });
    d = editDraftItem(d, item(d, 'Quiz 1').key, { include: false });
    const r = commitImport(createPlannerState(NOW, US_OUTLINE.timezone), d, { now: NOW, ids: counterIds(), keepOriginal: false });
    const fin = Object.values(r.state.assignments).find((x) => x.title.startsWith('Final Exam'))!;
    expect(fin.dueAt).toBeDefined();
    expect(fin.unresolved).toBeUndefined();
    expect(Object.values(r.state.assignments).some((x) => x.title.startsWith('Quiz 1'))).toBe(false);
  });
});

describe('Course Spaces identity (data only)', () => {
  it('needs institution, term and code; the institution is always part of the key', () => {
    const lake = { institution: 'Lakeshore University', code: 'COMP 202', subject: 'COMP', number: '202', title: null, term: { season: 'fall' as const, year: 2026 }, section: '001' };
    expect(courseSpaceKeyOf(lake)).toEqual({ institutionKey: 'lakeshore-university', termKey: 'fall-2026', codeKey: 'comp-202', sectionKey: '001', key: 'lakeshore-university/fall-2026/comp-202' });
    expect(courseSpaceKeyOf({ ...lake, institution: 'Northlake University' })!.key).not.toBe(courseSpaceKeyOf(lake)!.key);
    expect(courseSpaceKeyOf({ ...lake, institution: null })).toBeNull();
    expect(courseSpaceKeyOf({ ...lake, term: null })).toBeNull();
    expect(courseSpaceKeyOf({ ...lake, institution: 'Université de Saint-Laurent' })!.institutionKey).toBe('universite-de-saint-laurent');
  });
});

describe('analysis providers', () => {
  it('local analysis runs on the device; the remote one is unavailable and needs consent first', async () => {
    const local = new LocalSyllabusAnalysisProvider();
    const r = await local.analyze(US_OUTLINE.text, { timezone: US_OUTLINE.timezone, referenceAt: NOW });
    expect(local.sendsDocument).toBe(false);
    expect(r.ok && r.insights.identity.code).toBe('CS 1301');
    const remote = new UnavailableRemoteSyllabusAnalysisProvider();
    expect(await remote.analyze('x', { timezone: 'UTC', referenceAt: NOW })).toEqual({ ok: false, error: 'consentRequired' });
    expect(await remote.analyze('x', { timezone: 'UTC', referenceAt: NOW }, { consented: true })).toEqual({ ok: false, error: 'unavailable' });
  });
});

describe('planner schema 3', () => {
  it('a v2 document loads unchanged; new fields are optional', () => {
    const v2 = { ...createPlannerState(NOW, 'UTC'), plannerSchemaVersion: 2 };
    const m = migratePlanner(JSON.parse(JSON.stringify(v2)), NOW, 'UTC');
    expect(m.plannerSchemaVersion).toBe(3);
    expect(m.courses).toEqual({});
    expect(m.journey).toEqual(v2.journey);
  });
});
