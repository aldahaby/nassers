import { CLEAN_TEXT, CONFLICTING, MULTIPLE_COURSES, RECURRING_WEEKLY, REVISED, AMBIGUOUS } from '../../planner/fixtures/syllabi';
import { commitImport, confirmDraftItem, createImportDraft, draftCounts, editDraftItem } from '../../planner/syllabusImport';
import { createPlannerState } from '../../planner/plannerState';
import { acceptAllProposed, proposePlans, updateAssignment } from '../../planner/plannerService';
import { serializePlannerState } from '../../planner/privacy';
import { fromWallClock } from '../../planner/time';
import { counterIds, TZ } from './helpers';

const NOW = fromWallClock({ year: 2026, month: 8, day: 20, hour: 11, minute: 0 }, TZ);

function importClean(keepOriginal = false) {
  const ids = counterIds();
  const s0 = createPlannerState(NOW, TZ);
  const draft = createImportDraft(s0, { text: CLEAN_TEXT.text, sourceType: 'pdf', filename: 'chem101.pdf', timezone: TZ, now: NOW });
  const res = commitImport(s0, draft, { now: NOW, ids, keepOriginal });
  return { ...res, ids, draft };
}

describe('import draft and review', () => {
  it('draft summarises what was found; nothing is persisted until commit', () => {
    const s0 = createPlannerState(NOW, TZ);
    const draft = createImportDraft(s0, { text: AMBIGUOUS.text, sourceType: 'emailText', timezone: TZ, now: NOW });
    expect(draftCounts(draft)).toMatchObject({ found: 4, needsReview: 4, confirmed: 0 });
    expect(s0.assignments).toEqual({});
    expect(draft.rawText).toBe(AMBIGUOUS.text);
  });

  it('editing a field confirms it; picking a date settles a conflict', () => {
    const s0 = createPlannerState(NOW, TZ);
    let draft = createImportDraft(s0, { text: CONFLICTING.text, sourceType: 'pdf', timezone: TZ, now: NOW });
    const paper = draft.items.find((i) => i.title === 'Paper 1')!;
    expect(paper.confidence.due).toBe('needsReview');
    draft = editDraftItem(draft, paper.key, { dueDayKey: '2026-10-12' });
    const after = draft.items.find((i) => i.key === paper.key)!;
    expect(after).toMatchObject({ dueDayKey: '2026-10-12', dueOptions: undefined, confidence: { due: 'confirmed' } });
    draft = confirmDraftItem(draft, draft.items.find((i) => i.title === 'Quiz 1')!.key);
    expect(draftCounts(draft).confirmed).toBeGreaterThanOrEqual(1);
  });

  it('commit creates the course, syllabus and assignments with provenance; likely becomes confirmed', () => {
    const { state, courseIds, createdAssignmentIds, syllabusIds } = importClean();
    expect(Object.values(state.courses)).toHaveLength(1);
    expect(state.courses[courseIds[0]!]).toMatchObject({ name: 'Foundations of Chemistry', code: 'CHEM 101', term: 'Fall 2026', timezone: TZ });
    expect(createdAssignmentIds).toHaveLength(9);
    const midterm = Object.values(state.assignments).find((a) => a.title === 'Midterm Exam')!;
    expect(midterm).toMatchObject({ type: 'exam', dueDateOnly: false, reviewState: 'reviewed', sourceAuthority: 'syllabus', provenance: { page: 1, line: 18 } });
    expect(midterm.fieldConfidence.due).toBe('confirmed');
    expect(midterm.dueAt).toBe(fromWallClock({ year: 2026, month: 10, day: 14, hour: 9, minute: 0 }, TZ));
    const quiz = Object.values(state.assignments).find((a) => a.title === 'Quiz 1')!;
    expect(quiz.dueDateOnly).toBe(true);
    expect(state.syllabi[syllabusIds[0]!]).toMatchObject({ revision: 1, parseStatus: 'reviewed', rawTextRetention: 'discarded', filename: 'chem101.pdf', itemCount: 9 });
  });

  it('raw syllabus text is discarded on commit by default, kept only on explicit opt-in', () => {
    const plain = importClean(false);
    expect(serializePlannerState(plain.state)).not.toContain('Atoms, bonding');
    expect(plain.state.originals).toEqual({});
    const kept = importClean(true);
    expect(Object.values(kept.state.originals)[0]).toContain('Atoms, bonding');
    expect(Object.values(kept.state.syllabi)[0]!.rawTextRetention).toBe('keptLocally');
  });

  it('needs-review items are saved as needing review (no plans can be made for them)', () => {
    const ids = counterIds();
    const s0 = createPlannerState(NOW, TZ);
    const draft = createImportDraft(s0, { text: AMBIGUOUS.text, sourceType: 'pdf', timezone: TZ, now: NOW });
    const { state } = commitImport(s0, draft, { now: NOW, ids, keepOriginal: false });
    expect(Object.values(state.assignments).every((a) => a.reviewState === 'needsReview')).toBe(true);
    const tba = Object.values(state.assignments).find((a) => a.title === 'Final exam')!;
    expect(tba.dueAt).toBeUndefined();
  });

  it('excluded items are not created', () => {
    const ids = counterIds();
    const s0 = createPlannerState(NOW, TZ);
    let draft = createImportDraft(s0, { text: CLEAN_TEXT.text, sourceType: 'pdf', timezone: TZ, now: NOW });
    draft = editDraftItem(draft, draft.items[0]!.key, { include: false });
    expect(commitImport(s0, draft, { now: NOW, ids, keepOriginal: false }).createdAssignmentIds).toHaveLength(8);
  });

  it('weekly recurrences expand within the document date range', () => {
    const ids = counterIds();
    const s0 = createPlannerState(NOW, TZ);
    const draft = createImportDraft(s0, { text: RECURRING_WEEKLY.text, sourceType: 'pdf', timezone: TZ, now: NOW });
    const { state } = commitImport(s0, draft, { now: NOW, ids, keepOriginal: false });
    const weekly = Object.values(state.assignments).filter((a) => a.title.startsWith('Reading responses'));
    expect(weekly.length).toBe(14); // Fridays from 4 Sep to 4 Dec 2026
    expect(new Set(weekly.map((a) => a.sourceFingerprint)).size).toBe(weekly.length);
  });

  it('multiple courses create multiple courses', () => {
    const ids = counterIds();
    const s0 = createPlannerState(NOW, TZ);
    const draft = createImportDraft(s0, { text: MULTIPLE_COURSES.text, sourceType: 'pdf', timezone: TZ, now: NOW });
    const { state } = commitImport(s0, draft, { now: NOW, ids, keepOriginal: false });
    expect(Object.values(state.courses).map((c) => c.code).sort()).toEqual(['MATH 140', 'PHYS 101']);
  });
});

describe('duplicate and revised imports', () => {
  it('importing the same syllabus again changes nothing and creates no duplicates', () => {
    const first = importClean();
    const again = createImportDraft(first.state, { text: CLEAN_TEXT.text, sourceType: 'pdf', timezone: TZ, now: NOW + 1000 });
    expect(again.duplicateOfSyllabusId).toBe(first.syllabusIds[0]);
    const res = commitImport(first.state, again, { now: NOW + 1000, ids: first.ids, keepOriginal: false });
    expect(res.state).toBe(first.state);
  });

  it('a revised syllabus updates changed items, flags removed ones, adds new ones, never duplicates', () => {
    const first = importClean();
    const later = NOW + 30 * 86_400_000;
    const draft = createImportDraft(first.state, { text: REVISED.text, sourceType: 'pdf', timezone: TZ, now: later });
    expect(draft.revisionOfSyllabusId).toBe(first.syllabusIds[0]);
    const byTitle = (t: string) => draft.items.find((i) => i.title === t)!;
    expect(byTitle('Quiz 2').change).toBe('changed');
    expect(byTitle('Quiz 2').diffs![0]!.field).toBe('due');
    expect(byTitle('Quiz 1').change).toBe('unchanged');
    expect(byTitle('Lab safety module').change).toBe('new');
    expect(byTitle('Final Project proposal').change).toBe('removed');
    const res = commitImport(first.state, draft, { now: later, ids: first.ids, keepOriginal: false });
    const live = Object.values(res.state.assignments).filter((a) => !a.deletedAt);
    expect(live).toHaveLength(10); // 9 originals (one flagged missing) + 1 new
    expect(live.filter((a) => a.title === 'Quiz 2')).toHaveLength(1);
    expect(live.find((a) => a.title === 'Final Project proposal')!.missingFromSource).toBe(true);
    expect(Object.values(res.state.syllabi).map((s) => s.revision).sort()).toEqual([1, 2]);
    expect(res.state.events.some((e) => e.type === 'sourceUpdated')).toBe(true);
  });

  it('a revised date never overwrites a student edit: it becomes a visible conflict', () => {
    const first = importClean();
    const quiz2 = Object.values(first.state.assignments).find((a) => a.title === 'Quiz 2')!;
    const edited = updateAssignment(first.state, quiz2.id, { dueDayKey: '2026-10-07', dueTime: '10:00' }, NOW + 1).state;
    const draft = createImportDraft(edited, { text: REVISED.text, sourceType: 'pdf', timezone: TZ, now: NOW + 2 });
    const res = commitImport(edited, draft, { now: NOW + 2, ids: first.ids, keepOriginal: false });
    const after = res.state.assignments[quiz2.id]!;
    expect(after.dueAt).toBe(fromWallClock({ year: 2026, month: 10, day: 7, hour: 10, minute: 0 }, TZ));
    expect(after.reviewState).toBe('sourceConflict');
    expect(after.conflicts?.due).toBeDefined();
  });

  it('a deadline moved earlier cancels plans that now fall after it', () => {
    const first = importClean();
    const ps3 = Object.values(first.state.assignments).find((a) => a.title === 'Problem Set 3')!;
    const start = fromWallClock({ year: 2026, month: 10, day: 12, hour: 9, minute: 0 }, TZ);
    let s = updateAssignment(first.state, ps3.id, { estimatedMinutes: 180 }, start).state;
    s = proposePlans(s, start, first.ids, [ps3.id]).state;
    s = acceptAllProposed(s, start, first.ids);
    const accepted = Object.values(s.plans).filter((p) => p.assignmentId === ps3.id && p.status === 'accepted');
    expect(accepted.length).toBeGreaterThan(1);
    const draft = createImportDraft(s, { text: REVISED.text, sourceType: 'pdf', timezone: TZ, now: start });
    const res = commitImport(s, draft, { now: start, ids: first.ids, keepOriginal: false });
    expect(res.cancelledPlanIds.length).toBeGreaterThan(0);
    const newDue = res.state.assignments[ps3.id]!.dueAt!;
    expect(newDue).toBe(fromWallClock({ year: 2026, month: 10, day: 20, hour: 17, minute: 0 }, TZ));
    for (const id of res.cancelledPlanIds) expect(res.state.plans[id]!.plannedStartAt + res.state.plans[id]!.plannedMinutes * 60_000).toBeGreaterThan(newDue - 3_600_000);
    const stillAccepted = Object.values(res.state.plans).filter((p) => p.assignmentId === ps3.id && p.status === 'accepted');
    for (const p of stillAccepted) expect(p.plannedStartAt + p.plannedMinutes * 60_000).toBeLessThanOrEqual(newDue - 3_600_000);
  });
});
