import { JOURNEY_CONFIG } from '@/config/journey';
import { addAssignment, addCourse, completeAssignment, reopenAssignment } from '../../planner/plannerService';
import { createPlannerState, migratePlanner } from '../../planner/plannerState';
import { recordFinishedSession } from '../../planner/studySessions';
import { createJourneyState, evaluateJourney, journeyCandidates, journeyTimeline, type JourneyInputs } from '../../stats/journey';
import { studyDataFrom, withJourneyUpdated } from '../../stats/studyData';
import { createNewSave } from '../../save/createNewSave';
import type { FocusSessionRecord, GameSave, PlannerState } from '../../models';
import { counterIds, DAY, HOUR, MON, TZ } from '../planner/helpers';
import { focus, record } from './helpers';

const inputs = (records: FocusSessionRecord[], extra: Partial<JourneyInputs> = {}): JourneyInputs => ({
  records,
  tasks: [],
  planner: null,
  lifetime: { sessionsCompleted: records.filter((r) => r.status === 'completed').length, totalFocusMinutes: records.reduce((s, r) => s + r.recordedMinutes, 0) },
  creditedMinutes: records.reduce((s, r) => s + r.recordedMinutes, 0),
  petXp: null,
  ...extra,
});

const sessions = (count: number, minutes = 25) => Array.from({ length: count }, (_, i) => record(MON + i * HOUR, minutes));

describe('Journey milestones', () => {
  it('the first completed session is dated by that session', () => {
    const recs = [record(MON, 10, { status: 'endedEarly' }), record(MON + HOUR, 25)];
    const j = evaluateJourney(createJourneyState(MON), inputs(recs), MON + 2 * HOUR);
    expect(j.milestones.firstSession).toMatchObject({ achievedAt: MON + HOUR + 25 * 60_000, recordedAt: MON + 2 * HOUR });
  });

  it('an ended-early session is not counted as a completed session', () => {
    const j = evaluateJourney(createJourneyState(MON), inputs([record(MON, 20, { status: 'endedEarly' })]), MON + HOUR);
    expect(j.milestones.firstSession).toBeUndefined();
  });

  it('session-count milestones are dated by the session that reached them', () => {
    const recs = sessions(10);
    const j = evaluateJourney(createJourneyState(MON), inputs(recs), MON + DAY);
    expect(j.milestones['sessions:5']!.achievedAt).toBe(recs[4]!.endedAt);
    expect(j.milestones['sessions:10']!.achievedAt).toBe(recs[9]!.endedAt);
    expect(j.milestones['sessions:25']).toBeUndefined();
  });

  it('is never awarded twice: re-evaluating returns the same state, and the date never moves', () => {
    const s1 = evaluateJourney(createJourneyState(MON), inputs(sessions(5)), MON + DAY);
    expect(evaluateJourney(s1, inputs(sessions(5)), MON + 2 * DAY)).toBe(s1);
    const s2 = evaluateJourney(s1, inputs(sessions(6)), MON + 3 * DAY);
    expect(s2.milestones['sessions:5']).toEqual(s1.milestones['sessions:5']);
  });

  it('never fabricates a date: sessions from before detailed records show as "before Journey began"', () => {
    const recs = sessions(3);
    const j = evaluateJourney(createJourneyState(MON), inputs(recs, { lifetime: { sessionsCompleted: 8, totalFocusMinutes: 200 } }), MON + DAY);
    expect(j.milestones.firstSession!.achievedAt).toBeNull();
    expect(j.milestones['sessions:5']!.achievedAt).toBeNull(); // the 5th of 8 is older than the 3 kept records
    const more = evaluateJourney(j, inputs([...recs, ...sessions(2).map((r, i) => ({ ...r, id: `x${i}`, startedAt: MON + DAY + i * HOUR, endedAt: MON + DAY + i * HOUR + 25 * 60_000 }))], { lifetime: { sessionsCompleted: 10, totalFocusMinutes: 250 } }), MON + 2 * DAY);
    expect(more.milestones['sessions:10']!.achievedAt).toBe(MON + DAY + HOUR + 25 * 60_000);
  });

  it('focus-hour milestones use recorded time and are reached by the session that crossed the line', () => {
    const recs = [record(MON, 40), record(MON + HOUR, 30)];
    const j = evaluateJourney(createJourneyState(MON), inputs(recs), MON + DAY);
    expect(j.milestones['focusHours:1']!.achievedAt).toBe(recs[1]!.endedAt);
  });

  it('there are no streak, daily-login or long-session milestones', () => {
    const kinds = new Set(journeyCandidates(inputs(sessions(30, 180)), null, MON).map((c) => c.kind));
    for (const k of kinds) expect(k).not.toMatch(/streak|daily|login|longest/i);
    expect(Object.keys(JOURNEY_CONFIG)).not.toContain('streakThresholds');
  });

  it('task milestones come from completed tasks and survive a task being reopened', () => {
    const ids = counterIds();
    const { state, courseId } = addCourse(createPlannerState(MON, TZ), { name: 'Chemistry', timezone: TZ }, MON, ids);
    const a = addAssignment(state, { courseId, title: 'PS 1', type: 'assignment', dueDayKey: '2026-10-20', dueTime: '23:59' }, MON, ids);
    let planner = completeAssignment(a.state, a.assignmentId, MON + HOUR, ids);
    planner = withJourneyUpdated(planner, null, MON + HOUR);
    expect(planner.journey.milestones.firstTask).toMatchObject({ achievedAt: MON + HOUR, courseId });
    expect(planner.journey.milestones.firstCourse).toMatchObject({ achievedAt: MON, courseId });
    planner = withJourneyUpdated(reopenAssignment(planner, a.assignmentId, MON + 2 * HOUR), null, MON + 2 * HOUR);
    expect(planner.journey.milestones.firstTask!.achievedAt).toBe(MON + HOUR);
  });

  it('first session per course and first planned session come from course-linked records', () => {
    const ids = counterIds();
    const { state, courseId } = addCourse(createPlannerState(MON, TZ), { name: 'History', timezone: TZ }, MON, ids);
    const f = focus(MON + HOUR, 30, { study: { courseId, sessionPlanId: 'plan_1', independentStart: true } });
    const planner = withJourneyUpdated(recordFinishedSession(state, f, ids), null, MON + 2 * HOUR);
    expect(planner.journey.milestones[`courseFirstSession:${courseId}`]!.achievedAt).toBe(MON + HOUR + 30 * 60_000);
    expect(planner.journey.milestones.firstPlannedSession).toBeDefined();
    expect(planner.journey.milestones.firstIndependentStart).toBeDefined();
  });

  it('pet growth is dated by the session that reached the stage', () => {
    const recs = [record(MON, 25, { stageReached: 'young' })];
    const j = evaluateJourney(createJourneyState(MON), inputs(recs, { petXp: 400 }), MON + DAY);
    expect(j.milestones['petStage:young']!.achievedAt).toBe(recs[0]!.endedAt);
    expect(j.milestones['petStage:adult']).toBeUndefined();
  });

  it('pet growth seen happening (e.g. from a mission) is dated when seen; a stage already reached before Journey is undated', () => {
    const before = evaluateJourney(createJourneyState(MON), inputs([], { petXp: 350 }), MON);
    expect(before.milestones['petStage:young']!.achievedAt).toBeNull();
    const grown = evaluateJourney(before, inputs([], { petXp: 1600 }), MON + DAY);
    expect(grown.milestones['petStage:adult']!.achievedAt).toBe(MON + DAY);
  });

  it('the timeline is newest first with undated milestones last', () => {
    const j = evaluateJourney(createJourneyState(MON), inputs(sessions(5), { lifetime: { sessionsCompleted: 5, totalFocusMinutes: 125 }, petXp: 400 }), MON + DAY);
    const t = journeyTimeline(j);
    expect(t[0]!.id).toBe('sessions:5');
    expect(t[t.length - 1]!.achievedAt).toBeNull();
  });
});

describe('Journey from real app data', () => {
  it('reads the game save and planner together without counting a session twice', () => {
    const ids = counterIds();
    const f = focus(MON, 30);
    const planner = recordFinishedSession(createPlannerState(MON - DAY, TZ), f, ids);
    const save: GameSave = { ...createNewSave(MON - DAY), focus: { active: null, history: [f] }, stats: { ...createNewSave(MON - DAY).stats, sessionsCompleted: 1, totalFocusMinutes: 30 } } as GameSave;
    const data = studyDataFrom(planner, save);
    expect(data.records).toHaveLength(1);
    expect(data.journeyInputs.creditedMinutes).toBe(30);
    const j = withJourneyUpdated(planner, save, MON + HOUR).journey;
    expect(j.milestones.firstSession!.achievedAt).toBe(MON + 30 * 60_000);
  });
});

describe('planner schema migration (v1 → v2)', () => {
  it('adds an empty Journey and keeps every existing record', () => {
    const ids = counterIds();
    const v2 = recordFinishedSession(createPlannerState(MON, TZ), focus(MON, 25), ids);
    const { journey: _drop, ...rest } = v2;
    const v1 = { ...rest, plannerSchemaVersion: 1 };
    const migrated: PlannerState = migratePlanner(JSON.parse(JSON.stringify(v1)), MON + DAY, TZ);
    expect(migrated.plannerSchemaVersion).toBe(2);
    expect(migrated.journey).toEqual({ startedAt: MON + DAY, milestones: {}, petXpSeen: null });
    expect(migrated.studySessions).toEqual(v2.studySessions);
    expect(migrated.events).toEqual(v2.events);
  });

  it('keeps stored milestones on load', () => {
    const s = evaluateJourney(createJourneyState(MON), inputs(sessions(1)), MON + HOUR);
    const doc = { ...createPlannerState(MON, TZ), journey: s };
    expect(migratePlanner(JSON.parse(JSON.stringify(doc)), MON + DAY, TZ).journey).toEqual(s);
  });

  it('refuses a document from a newer app instead of dropping data', () => {
    expect(() => migratePlanner({ ...createPlannerState(MON, TZ), plannerSchemaVersion: 99 }, MON, TZ)).toThrow('planner-from-newer-app');
  });
});
