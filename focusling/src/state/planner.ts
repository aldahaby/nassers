import { useMemo } from 'react';
import { appClock, services } from '@/services';
import { nextPlan, studyDataFrom, type PlannerState, type StudyData } from '@/core';
import { createPlannerStore } from './createPlannerStore';
import { useGameStore } from './gameStore';

/** The app's planner store (separate document from the game save). */
export const usePlannerStore = createPlannerStore({
  repository: services.plannerRepository,
  notifications: services.notifications,
  documents: services.documents,
  widgets: services.widgets,
  game: useGameStore,
  now: appClock.now,
});

export function usePlanner(): PlannerState | null {
  return usePlannerStore((s) => s.planner);
}

export function useNextPlan(now: number) {
  const planner = usePlanner();
  return useMemo(() => (planner ? nextPlan(planner, now) : null), [planner, now]);
}

/** Stats & Journey records (planner ledger + recent game history), recomputed only when either changes. */
export function useStudyData(): StudyData {
  const planner = usePlanner();
  const save = useGameStore((s) => s.save);
  const history = save?.focus.history;
  const stats = save?.stats;
  const xp = save?.pet?.lifetimeXp;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only the parts Stats reads
  return useMemo(() => studyDataFrom(planner, save), [planner, history, stats, xp]);
}
