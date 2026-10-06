import { migratePlanner, serializePlannerState, type PlannerState } from '@/core';

/**
 * The planner document lives beside (not inside) the pet/game save, under its
 * own `plannerSchemaVersion`. Semester-scale records never bloat the game save,
 * and neither document's migrations depend on the other.
 */
export interface PlannerRepository {
  load(now: number, timezone: string): Promise<PlannerState | null>;
  save(state: PlannerState): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryPlannerRepository implements PlannerRepository {
  raw: string | null = null;
  async load(now: number, timezone: string) {
    return this.raw === null ? null : migratePlanner(JSON.parse(this.raw), now, timezone);
  }
  async save(state: PlannerState) {
    this.raw = serializePlannerState(state);
  }
  async clear() {
    this.raw = null;
  }
}
