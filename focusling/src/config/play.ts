import type { GameId } from '@/core/models';

/**
 * Calm play economy. Focus stays the main way to progress:
 * - a daily cap on coins from play (games stay playable after it);
 * - a daily cap on happiness from play;
 * - small, finish-based rewards (never speed-based).
 * `balance.test.ts` guards that play can't out-earn focusing.
 */
export const PLAY_ECONOMY = {
  dailyCoinCap: 10,
  dailyHappinessCap: 4,
  /** Rewarded round IDs remembered (for duplicate protection). */
  rememberedRounds: 50,
} as const;

export const GAME_REWARDS: Record<GameId, { happiness: number }> = {
  memoryGarden: { happiness: 1 },
  toyToss: { happiness: 1 },
};

/** Memory Garden pays the same for every finished round. */
export const MEMORY_GARDEN = {
  pairs: 4,
  coins: 2,
  /** Item art used on the cards. */
  cardItems: ['toy-bouncy-ball', 'food-cookie', 'decor-potted-plant', 'toy-squeaky-star'] as const,
  /** How long a mismatched pair stays face up (ms). */
  mismatchRevealMs: 900,
} as const;

/** Toy Toss: 5 tosses, a slow constant-speed marker, small reward differences. */
export const TOY_TOSS = {
  tosses: 5,
  /** Seconds for the marker to cross the lane once. Never changes during a round. */
  markerCrossSeconds: 2.6,
  /** Distance from the pet's centre (0–1 lane units) for each catch quality. */
  perfectWithin: 0.08,
  goodWithin: 0.2,
  /** Coins by number of catches (index = catches, 0–5). */
  coinsByCatches: [1, 1, 2, 2, 3, 3] as const,
} as const;
