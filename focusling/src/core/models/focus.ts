import type { GrowthStage } from './pet';
import type { ProtectionMode } from './protection';
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
  /** Protection this session was started with (native state is still authoritative). */
  protectionMode: ProtectionMode;
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

/** A one-off moment worth its own celebration screen. At most one per session. */
export type Celebration =
  | { kind: 'levelUp'; level: number }
  | { kind: 'growth'; from: GrowthStage; to: GrowthStage; level: number }
  | { kind: 'evolution'; from: GrowthStage; to: GrowthStage; level: number };

/**
 * Everything the completion screen needs, captured when a session ends:
 * the reward plus before/after values so the UI can animate the change.
 */
export interface SessionSummary {
  sessionId: string;
  outcome: FocusOutcome;
  plannedMinutes: number;
  reward: SessionReward;
  coinsBefore: number;
  coinsAfter: number;
  xpBefore: number;
  xpAfter: number;
  dayStreakBefore: number;
  dayStreakAfter: number;
  sessionStreakAfter: number;
  celebration: Celebration | null;
  /** True when the timer ran out while the app was closed or in the background. */
  completedWhileAway: boolean;
}

/** Live view of the running session, derived from timestamps on every tick. */
export interface ActiveSessionProgress {
  remainingMs: number;
  elapsedMinutes: number;
  /** 0–1. */
  progress: number;
  endsAt: Timestamp;
  /** What completing this session will pay. */
  projected: RewardEstimate;
}

/** What ending the session right now would still pay. */
export interface AbandonPreview {
  focusedMinutes: number;
  coins: number;
  xp: number;
}
