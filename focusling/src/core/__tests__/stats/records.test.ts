import { addAssignment, addCourse, completeAssignment, reopenAssignment } from '../../planner/plannerService';
import { createPlannerState } from '../../planner/plannerState';
import { recordFinishedSession } from '../../planner/studySessions';
import { buildSessionRecords, recordedMinutesFor, taskCompletions } from '../../stats/sessionRecords';
import { at, counterIds, MON, TZ } from '../planner/helpers';
import { focus } from './helpers';

describe('recorded session minutes', () => {
  it('uses the credited minutes when real time covers them', () => {
    expect(recordedMinutesFor(25, MON, MON + 25 * 60_000)).toBe(25);
  });

  it('caps credited minutes to real elapsed time (a developer "complete now" adds no invented time)', () => {
    expect(recordedMinutesFor(45, MON, MON + 2 * 60_000 + 30_000)).toBe(2);
  });

  it('a session that finished while the app was closed counts its planned length, not the hours until reopening', () => {
    expect(recordedMinutesFor(30, MON, MON + 5 * 3_600_000)).toBe(30);
  });

  it('under a minute or a clock going backwards records nothing', () => {
    expect(recordedMinutesFor(1, MON, MON + 30_000)).toBe(0);
    expect(recordedMinutesFor(20, MON, MON - 60_000)).toBe(0);
  });
});

describe('session records', () => {
  it('ignores the active session and keeps interrupted sessions as ended early, not completed', () => {
    const recs = buildSessionRecords(null, [focus(MON, 0, { status: 'active' }), focus(MON - 3_600_000, 12, { status: 'abandoned' }), focus(MON - 7_200_000, 25)]);
    expect(recs.map((r) => r.status)).toEqual(['completed', 'endedEarly']);
    expect(recs[1]!.recordedMinutes).toBe(12);
  });

  it('records each FocusSession once when it is in both the planner ledger and the game history', () => {
    const ids = counterIds();
    const { state, courseId } = addCourse(createPlannerState(MON, TZ), { name: 'Chemistry', timezone: TZ }, MON, ids);
    const f = focus(MON, 45, { study: { courseId } });
    let planner = recordFinishedSession(state, f, ids);
    planner = recordFinishedSession(planner, f, ids); // a second notification for the same session
    const recs = buildSessionRecords(planner, [f, f]);
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({ id: f.id, source: 'planner', courseId, recordedMinutes: 45 });
  });

  it('keeps a planner record even after the game history has rolled past it', () => {
    const ids = counterIds();
    const old = focus(MON - 10 * 86_400_000, 30);
    const planner = recordFinishedSession(createPlannerState(MON - 20 * 86_400_000, TZ), old, ids);
    expect(buildSessionRecords(planner, []).map((r) => r.id)).toEqual([old.id]);
  });

  it('uses start + recorded minutes as the end, not the late reopen time', () => {
    const f = focus(MON, 30, { elapsed: 600 });
    const [r] = buildSessionRecords(null, [f]);
    expect(r!.endedAt).toBe(MON + 30 * 60_000);
  });

  it('carries the course from the session context and never invents one', () => {
    const recs = buildSessionRecords(null, [focus(MON, 30, { study: { courseId: 'c1', sessionPlanId: 'p1' } }), focus(MON + 3_600_000, 20)]);
    expect(recs[0]).toMatchObject({ courseId: 'c1', fromPlan: true });
    expect(recs[1]!.courseId).toBeUndefined();
  });
});

describe('task completions', () => {
  it('lists completed tasks with their completion time; reopened and deleted tasks drop out', () => {
    const ids = counterIds();
    let { state } = addCourse(createPlannerState(MON, TZ), { name: 'Chemistry', timezone: TZ }, MON, ids);
    const courseId = Object.keys(state.courses)[0]!;
    const a = addAssignment(state, { courseId, title: 'PS 1', type: 'assignment', dueDayKey: '2026-10-20', dueTime: '23:59' }, MON, ids);
    const b = addAssignment(a.state, { courseId, title: 'PS 2', type: 'assignment', dueDayKey: '2026-10-21', dueTime: '23:59' }, MON, ids);
    state = completeAssignment(b.state, a.assignmentId, at(10, 13, 15), ids);
    state = completeAssignment(state, b.assignmentId, at(10, 14, 15), ids);
    expect(taskCompletions(state).map((t) => [t.assignmentId, t.completedAt])).toEqual([
      [a.assignmentId, at(10, 13, 15)],
      [b.assignmentId, at(10, 14, 15)],
    ]);
    state = reopenAssignment(state, a.assignmentId, at(10, 15, 9));
    expect(taskCompletions(state).map((t) => t.assignmentId)).toEqual([b.assignmentId]);
  });
});
