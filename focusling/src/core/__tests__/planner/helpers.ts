import { createPlannerState, type IdGen } from '../../planner/plannerState';
import { addCourse, addAssignment, type AssignmentInput } from '../../planner/plannerService';
import { fromWallClock } from '../../planner/time';
import type { PlannerState } from '../../models';

export const TZ = 'America/New_York';
/** Monday 12 October 2026, 09:00 New York. */
export const MON = fromWallClock({ year: 2026, month: 10, day: 12, hour: 9, minute: 0 }, TZ);
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export function counterIds(): IdGen {
  let n = 0;
  return (prefix) => `${prefix}_${++n}`;
}

export const at = (month: number, day: number, hour: number, minute = 0, tz = TZ) => fromWallClock({ year: 2026, month, day, hour, minute }, tz);

export function withCourse(now = MON, ids = counterIds()) {
  const s0 = createPlannerState(now, TZ);
  const { state, courseId } = addCourse(s0, { name: 'Chemistry', code: 'CHEM 101', timezone: TZ }, now, ids);
  return { state, courseId, ids };
}

export function withAssignment(input: Partial<AssignmentInput> & { dueDayKey: string }, now = MON) {
  const { state, courseId, ids } = withCourse(now);
  const r = addAssignment(state, { courseId, title: 'Problem Set 4', type: 'assignment', estimatedMinutes: 120, dueTime: '23:59', ...input }, now, ids);
  return { state: r.state as PlannerState, courseId, assignmentId: r.assignmentId, ids };
}
