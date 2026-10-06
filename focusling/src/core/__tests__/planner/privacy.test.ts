import { CLEAN_TEXT, SCANNED_OCR } from '../../planner/fixtures/syllabi';
import { commitImport, createImportDraft } from '../../planner/syllabusImport';
import { createPlannerState } from '../../planner/plannerState';
import { acceptAllProposed, proposePlans, updateAssignment } from '../../planner/plannerService';
import { buildWidgetSnapshot, FIELD_CLASSIFICATION, liveActivityContent, serializePlannerState, WIDGET_SNAPSHOT_KEYS } from '../../planner/privacy';
import { LocalOnlySyncProvider } from '../../planner/syncProvider';
import { FREE_ENTITLEMENT, plannerCapabilitiesFor } from '../../entitlements/entitlementService';
import { createNewSave } from '../../save/createNewSave';
import { fromWallClock } from '../../planner/time';
import { counterIds, TZ } from './helpers';

const NOW = fromWallClock({ year: 2026, month: 10, day: 12, hour: 9, minute: 0 }, TZ);

function imported(text = CLEAN_TEXT.text) {
  const ids = counterIds();
  const s0 = createPlannerState(NOW, TZ);
  const draft = createImportDraft(s0, { text, sourceType: 'pdf', timezone: TZ, now: NOW });
  let s = commitImport(s0, draft, { now: NOW, ids, keepOriginal: false }).state;
  const ps3 = Object.values(s.assignments).find((a) => a.title === 'Problem Set 3');
  if (ps3) s = updateAssignment(s, ps3.id, { estimatedMinutes: 90 }, NOW).state;
  s = acceptAllProposed(proposePlans(s, NOW, ids).state, NOW, ids);
  return { s, draft };
}

describe('planner privacy', () => {
  it('raw syllabus text is absent after commit (discard by default)', () => {
    const { s, draft } = imported();
    const json = serializePlannerState(s);
    expect(json).not.toContain('Atoms, bonding, reactions');
    expect(json).not.toContain(draft.rawText.slice(0, 40));
    // Snippets used during review are not persisted either.
    for (const item of draft.items) if (item.snippet.length > 30) expect(json).not.toContain(item.snippet);
  });

  it('raw OCR text is absent from the serialised planner', () => {
    const { s } = imported(SCANNED_OCR.text);
    expect(serializePlannerState(s)).not.toMatch(/0ct|Oct l6|Page 2/);
  });

  it('token-like fields never serialise', () => {
    const { s } = imported();
    const withSecrets = { ...s, connection: { provider: 'canvas', accessToken: 'secret-a', refreshToken: 'secret-r' }, courses: Object.fromEntries(Object.entries(s.courses).map(([k, c]) => [k, { ...c, oauthToken: 'secret-o' }])) };
    const json = serializePlannerState(withSecrets as typeof s);
    expect(json).not.toMatch(/secret-|accessToken|refreshToken|oauthToken/);
  });

  it('no student ID, friend or promo-verification data in either document', () => {
    const { s } = imported();
    const docs = serializePlannerState(s) + JSON.stringify(createNewSave(NOW));
    expect(docs).not.toMatch(/studentId|idImage|friend|verification|promo/i);
  });

  it('widget snapshot contains only approved fields; private mode drops course and assignment', () => {
    const { s } = imported();
    const snap = buildWidgetSnapshot(s, NOW, { activeSession: null, pet: { speciesId: 'cloudling', stage: 'baby' } });
    expect(Object.keys(snap).sort()).toEqual([...WIDGET_SNAPSHOT_KEYS].sort());
    expect(snap).toMatchObject({ privacyMode: 'private', courseDisplayName: null, assignmentDisplayTitle: null });
    expect(snap.plannedStart).not.toBeNull();
    const detailed = buildWidgetSnapshot({ ...s, preferences: { ...s.preferences, lockScreenDetail: 'detailed' } }, NOW, { activeSession: null, pet: null });
    expect(detailed.courseDisplayName).toBe('CHEM 101');
    expect(detailed.assignmentDisplayTitle).toBeTruthy();
    expect(JSON.stringify(snap)).not.toMatch(/Problem Set|Chemistry|CHEM/);
  });

  it('Live Activity: private mode shows "Study session · N min"; protection badge is truthful', () => {
    const { s } = imported();
    const course = Object.values(s.courses)[0]!;
    const a = Object.values(s.assignments)[0]!;
    const session = { endsAt: NOW + 2_700_000, plannedMinutes: 45, courseId: course.id, assignmentId: a.id, protection: 'failed' as const };
    expect(liveActivityContent(s, session)).toEqual({ title: 'Studyling', subtitle: 'Study session · 45 min', endsAt: session.endsAt, protection: 'off' });
    const detailed = liveActivityContent({ ...s, preferences: { ...s.preferences, lockScreenDetail: 'detailed' } }, { ...session, protection: 'activated' });
    expect(detailed.subtitle).toBe(`CHEM 101 · ${a.title}`);
    expect(detailed.protection).toBe('on');
    expect(liveActivityContent(s, { ...session, protection: 'simulated' }).protection).toBe('simulated');
  });

  it('privacy classification covers raw text, tokens and widget data', () => {
    const fields = FIELD_CLASSIFICATION.map((f) => f.field).join(' ');
    expect(fields).toMatch(/Raw syllabus/);
    expect(FIELD_CLASSIFICATION.find((f) => /OAuth/.test(f.field))!.classes).toEqual(['SECRET_STORAGE']);
    expect(FIELD_CLASSIFICATION.find((f) => /Raw syllabus/.test(f.field))!.classes).toEqual(['NEVER_PERSISTED']);
  });

  it('the only sync provider is local-only and never pushes', async () => {
    const p = new LocalOnlySyncProvider();
    expect(p.remote).toBe(false);
    expect(await p.push()).toEqual({ pushed: false, reason: 'localOnly' });
    expect(await p.pull()).toBeNull();
  });

  it('the effectiveness core is free on every tier', () => {
    const caps = plannerCapabilitiesFor(FREE_ENTITLEMENT);
    expect(caps).toMatchObject({ manualEntry: true, syllabusImport: true, planner: true, localReminders: true, reminderFading: true, startAndLock: true, basicRetrieval: true, basicWidget: true });
  });
});
