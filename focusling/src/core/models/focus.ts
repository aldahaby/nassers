import type { GrowthStage } from './pet';
import type { Id, Timestamp } from './common';

/**
 * Something the user wants to stay away from during a session.
 * `platformToken` is where a real Screen Time integration keeps its handle:
 * an opaque FamilyControls token on iOS, a package name on Android.
 */
export interface BlockTarget {
  id: Id;
  displayName: string;
  platformToken?: string;
}

export type FocusSessionStatus = 'active' | 'completed' | 'abandoned';

export type FocusOutcome = 'completed' | 'abandoned';

export interface SessionReward {
  outcome: FocusOutcome;
  focusedMinutes: number;
  coins: number;
  /** Portion of `coins` that came from finishing the whole session. */
  completionBonusCoins: number;
  xp: number;
  happinessDelta: number;
  healthDelta: number;
  /** Combined multiplier from streak and item bonuses that was applied. */
  bonusMultiplier: number;
  /** Set when this reward pushed the pet to a new level. */
  leveledUpTo: number | null;
  /** Set when this reward pushed the pet into a new growth stage. */
  stageReached: GrowthStage | null;
}

export interface FocusSession {
  id: Id;
  plannedDurationMinutes: number;
  startedAt: Timestamp;
  endedAt: Timestamp | null;
  status: FocusSessionStatus;
  blockedTargets: BlockTarget[];
  reward: SessionReward | null;
}

/** Rewards a session would pay if completed, shown before and during a session. */
export interface RewardEstimate {
  coins: number;
  completionBonusCoins: number;
  xp: number;
  happinessDelta: number;
  healthDelta: number;
  bonusMultiplier: number;
}
