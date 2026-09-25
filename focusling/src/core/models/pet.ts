import type { Id, Timestamp } from './common';

export type PetSpeciesId = 'cloudling' | 'sproutling' | 'emberling';

export type GrowthStage = 'baby' | 'young' | 'adult' | 'evolved';

/** Care stats, each clamped to 0–100. */
export interface PetStats {
  health: number;
  happiness: number;
}

/**
 * The persisted pet. Level and growth stage are NOT stored: they are derived
 * from `lifetimeXp` (see ProgressionState) so they can never drift out of sync
 * with the progression config.
 */
export interface Pet {
  id: Id;
  name: string;
  speciesId: PetSpeciesId;
  adoptedAt: Timestamp;
  stats: PetStats;
  lifetimeXp: number;
  /** When passive stat decay was last applied. */
  statsUpdatedAt: Timestamp;
  lastPettedAt: Timestamp | null;
}

/** Derived view of a pet's progression. Never persisted. */
export interface ProgressionState {
  lifetimeXp: number;
  level: number;
  /** XP earned since reaching the current level. */
  xpIntoLevel: number;
  /** XP needed to go from the current level to the next one (null at max level). */
  xpForNextLevel: number | null;
  stage: GrowthStage;
  /** Lifetime XP at which the next growth stage begins (null when fully evolved). */
  nextStageAtXp: number | null;
  /** 0–1 progress through the current stage. */
  stageProgress: number;
}

export type PetMood = 'joyful' | 'content' | 'sleepy' | 'lonely';
