import type { FocusSessionRecord, GameSave, PlannerState, TaskCompletionRecord, Timestamp } from '../models';
import { evaluateJourney, type JourneyInputs } from './journey';
import { buildSessionRecords, creditedMinutesOf, taskCompletions } from './sessionRecords';

export interface StudyData {
  records: FocusSessionRecord[];
  tasks: TaskCompletionRecord[];
  journeyInputs: JourneyInputs;
}

/** The records Stats and Journey read, from the planner document and the game save. */
export function studyDataFrom(planner: PlannerState | null, save: GameSave | null): StudyData {
  const history = save?.focus.history ?? [];
  const records = buildSessionRecords(planner, history);
  const tasks = taskCompletions(planner);
  return {
    records,
    tasks,
    journeyInputs: {
      records,
      tasks,
      planner,
      lifetime: save ? { sessionsCompleted: save.stats.sessionsCompleted, totalFocusMinutes: save.stats.totalFocusMinutes } : null,
      creditedMinutes: creditedMinutesOf(planner, history, records.map((r) => r.id)),
      petXp: save?.pet?.lifetimeXp ?? null,
    },
  };
}

/** The planner with any newly reached Journey milestones stored (same object when none). */
export function withJourneyUpdated(planner: PlannerState, save: GameSave | null, now: Timestamp): PlannerState {
  const journey = evaluateJourney(planner.journey, studyDataFrom(planner, save).journeyInputs, now);
  return journey === planner.journey ? planner : { ...planner, journey };
}
