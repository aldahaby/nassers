/**
 * Every coin/XP number in the game lives here. Tune freely: all formulas in
 * `core/economy` read from this object and nothing else.
 *
 * Reference points at default values (no streak, no items):
 *   15 min → 3 + 3  = 6 coins,  38 XP
 *   30 min → 6 + 4  = 10 coins, 75 XP
 *   60 min → 12 + 6 = 18 coins, 180 XP
 */
export const ECONOMY = {
  /** Base rate: 1 coin per this many minutes of focus. */
  minutesPerCoin: 5,

  /** Extra coins for finishing the entire session: base + 1 per 15 minutes planned. */
  completionBonus: {
    base: 2,
    minutesPerExtraCoin: 15,
  },

  /** XP earned per focused minute before multipliers. */
  xpPerMinute: 2,

  /** Applied to XP when the full session is completed. */
  completionXpMultiplier: 1.25,

  /** Longer sessions pay a little more per minute. Highest matching tier wins. */
  longSessionXpTiers: [
    { minMinutes: 45, multiplier: 1.1 },
    { minMinutes: 60, multiplier: 1.2 },
    { minMinutes: 90, multiplier: 1.3 },
  ],

  /**
   * Breaking a session is not punished; it just pays less.
   * You keep this fraction of the per-minute coins/XP for the time you did focus,
   * and never get the completion bonus.
   */
  abandon: {
    rewardFraction: 0.5,
    /** Below this many focused minutes an abandoned session pays nothing. */
    minMinutesForAnyReward: 5,
  },

  /** Day-streak bonus on coins: +2% per streak day, capped. */
  streakCoinBonus: {
    perDay: 0.02,
    max: 0.2,
  },

  /** Caps on the total passive bonus from equipped items. */
  itemBonusCaps: {
    xpPct: 0.1,
    coinPct: 0.1,
  },

  /** Coins a brand-new player starts with: enough for a first snack on day one. */
  starterCoins: 20,

  /**
   * Multiplies every shop price (rounded). The fastest way to rebalance the whole
   * shop at once; per-item prices live in `shopCatalog.ts`.
   */
  priceMultiplier: 1,
} as const;
