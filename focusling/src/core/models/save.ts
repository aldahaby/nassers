import type { Timestamp } from './common';
import type { FocusSession } from './focus';
import type { UserInventory } from './inventory';
import type { Pet } from './pet';
import type { UserProfile } from './profile';
import type { DailyStats, LifetimeStats, StreakState } from './stats';

export const CURRENT_SCHEMA_VERSION = 2;

export interface Wallet {
  coins: number;
}

export interface FocusState {
  active: FocusSession | null;
  /** Most recent finished sessions, newest first (bounded). */
  history: FocusSession[];
}

/**
 * The complete persisted game state: one document per user.
 * Keeping it as a single versioned document makes local persistence trivial
 * and gives a future cloud sync one unit to upload, diff and merge.
 */
export interface GameSave {
  schemaVersion: number;
  savedAt: Timestamp;
  profile: UserProfile;
  pet: Pet | null;
  wallet: Wallet;
  inventory: UserInventory;
  focus: FocusState;
  stats: LifetimeStats;
  streak: StreakState;
  /** Keyed by DateKey, pruned to a rolling window. */
  daily: Record<string, DailyStats>;
}
