import type { DateKey, Id } from './common';

export type GameId = 'memoryGarden' | 'toyToss';

/** Today's play rewards. Resets on a new calendar day. */
export interface PlayStats {
  date: DateKey | null;
  coinsEarned: number;
  happinessEarned: number;
  completions: Partial<Record<GameId, number>>;
  /** Round IDs already rewarded (bounded), so a round can never pay twice. */
  rewardedRounds: Id[];
  /** Developer Tools: Play unlocked for this date even if mission-gated. */
  debugUnlockedDate: DateKey | null;
}

export interface GameRoundResult {
  coins: number;
  happiness: number;
  /** True when today's play-coin cap is (now) reached. */
  capReached: boolean;
  duplicate: boolean;
  /** True when Play is mission-gated and still locked today: nothing is paid. */
  locked: boolean;
}
