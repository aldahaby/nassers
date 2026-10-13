import type { GrowthStage } from '@/core/models';

/**
 * Journey milestones (docs/STATS_AND_JOURNEY.md). Every milestone comes from a
 * real record and is stored once. There are deliberately no streak, daily-login
 * or long-session milestones: Journey celebrates showing up and finishing work,
 * never studying longer or punishing missed days.
 */
export const JOURNEY_CONFIG = {
  /** Completed focus sessions. */
  sessionThresholds: [5, 10, 25, 50, 100, 250] as const,
  /** Hours of recorded focus time (completed and ended-early sessions). */
  focusHourThresholds: [1, 5, 10, 25, 50, 100] as const,
  /** Completed planner tasks (assignments). */
  taskThresholds: [5, 10, 25, 50] as const,
  /** Pet growth stages that count as milestones (baby is where every pet starts). */
  petStages: ['young', 'adult', 'evolved'] as readonly GrowthStage[],
} as const;
