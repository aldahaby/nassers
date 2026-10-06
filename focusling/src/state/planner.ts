import { useMemo } from 'react';
import { appClock, services } from '@/services';
import { nextPlan, type PlannerState } from '@/core';
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
