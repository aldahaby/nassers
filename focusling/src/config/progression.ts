import type { GrowthStage } from '@/core/models';

/**
 * Level curve: going from level L to L+1 costs `baseXp + stepXp * (L - 1)`.
 *   L2 at 50 XP, L3 at 125, L5 at 350, L10 at 1,350.
 * At roughly 2.5 XP per focused minute that is ~9 hours of focus to level 10.
 */
export const LEVEL_CURVE = {
  baseXp: 50,
  stepXp: 25,
  maxLevel: 99,
} as const;

export interface GrowthStageDefinition {
  stage: GrowthStage;
  label: string;
  /** Lifetime XP required to enter this stage. */
  minXp: number;
  /** Visual scale of the pet at this stage. */
  scale: number;
}

/**
 * Growth is driven by lifetime XP, not calendar age, so a pet only grows when its
 * owner actually focuses. Must be sorted ascending by `minXp`, starting at 0.
 *   Young ≈ 2 h of focus, Adult ≈ 10 h, Evolved ≈ 33 h.
 */
export const GROWTH_STAGES: readonly GrowthStageDefinition[] = [
  { stage: 'baby', label: 'Baby', minXp: 0, scale: 0.78 },
  { stage: 'young', label: 'Young', minXp: 300, scale: 0.9 },
  { stage: 'adult', label: 'Adult', minXp: 1500, scale: 1.0 },
  { stage: 'evolved', label: 'Evolved', minXp: 5000, scale: 1.08 },
];
