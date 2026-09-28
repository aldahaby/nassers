import type { Timestamp } from './common';
import type { FocusSession } from './focus';
import type { CosmeticsState, UserInventory } from './inventory';
import type { Pet } from './pet';
import type { UserProfile } from './profile';
import type { ProtectionSettings } from './protection';
import type { AppMode, FamilySettings } from './family';
import type { MissionState } from './missions';
import type { PlayStats } from './play';
import type { DailyStats, LifetimeStats, StreakState } from './stats';

export const CURRENT_SCHEMA_VERSION = 5;

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
  /** Focus protection preferences. The chosen apps are opaque native tokens, not stored here. */
  protection: ProtectionSettings;
  /** Self-use or local Family Mode. Existing saves migrate to "self". */
  mode: AppMode;
  /** Present only in Family Mode. */
  family: FamilySettings | null;
  missions: MissionState;
  play: PlayStats;
  /** Wardrobe extras: "new" badges and saved looks. Ownership lives in `inventory`. */
  cosmetics: CosmeticsState;
}
