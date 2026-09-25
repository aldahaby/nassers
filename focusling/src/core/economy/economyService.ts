import { ECONOMY } from '@/config/economy';
import type { FocusOutcome, PassiveBonus } from '../models';

/** Everything besides duration that affects rewards. */
export interface RewardContext {
  /** Current day streak (use the displayed/effective streak). */
  streakDays: number;
  /** Summed passive bonuses from equipped items (already capped). */
  itemBonus: Required<PassiveBonus>;
}

export interface CoinXpReward {
  coins: number;
  completionBonusCoins: number;
  xp: number;
  /** Coin multiplier that was applied (streak × items). */
  bonusMultiplier: number;
}

export function streakCoinMultiplier(streakDays: number): number {
  const bonus = Math.min(ECONOMY.streakCoinBonus.max, Math.max(0, streakDays) * ECONOMY.streakCoinBonus.perDay);
  return 1 + bonus;
}

function longSessionMultiplier(minutes: number): number {
  let multiplier = 1;
  for (const tier of ECONOMY.longSessionXpTiers) {
    if (minutes >= tier.minMinutes) multiplier = tier.multiplier;
  }
  return multiplier;
}

export function completionBonusCoins(plannedMinutes: number): number {
  return ECONOMY.completionBonus.base + Math.floor(plannedMinutes / ECONOMY.completionBonus.minutesPerExtraCoin);
}

/**
 * Coins and XP for a finished (or abandoned) session.
 *
 * - Base coins: 1 per `minutesPerCoin` focused minutes.
 * - Completed: + completion bonus coins, XP × completion multiplier × long-session tier.
 * - Abandoned: base coins/XP × `abandon.rewardFraction`, no bonuses. Nothing under
 *   `minMinutesForAnyReward`.
 * - Coins then get the streak + item multiplier; XP gets the item multiplier.
 */
export function calculateCoinXpReward(
  focusedMinutes: number,
  plannedMinutes: number,
  outcome: FocusOutcome,
  context: RewardContext,
): CoinXpReward {
  const minutes = Math.max(0, Math.floor(focusedMinutes));
  const coinMultiplier = streakCoinMultiplier(context.streakDays) + context.itemBonus.coinPct;
  const xpItemMultiplier = 1 + context.itemBonus.xpPct;

  if (outcome === 'abandoned') {
    if (minutes < ECONOMY.abandon.minMinutesForAnyReward) {
      return { coins: 0, completionBonusCoins: 0, xp: 0, bonusMultiplier: 1 };
    }
    const fraction = ECONOMY.abandon.rewardFraction;
    const baseCoins = (minutes / ECONOMY.minutesPerCoin) * fraction;
    const baseXp = minutes * ECONOMY.xpPerMinute * fraction;
    return {
      coins: Math.floor(baseCoins * coinMultiplier),
      completionBonusCoins: 0,
      xp: Math.round(baseXp * xpItemMultiplier),
      bonusMultiplier: coinMultiplier,
    };
  }

  const baseCoins = Math.floor(minutes / ECONOMY.minutesPerCoin);
  const bonusCoins = completionBonusCoins(plannedMinutes);
  const xp =
    minutes * ECONOMY.xpPerMinute * ECONOMY.completionXpMultiplier * longSessionMultiplier(minutes) * xpItemMultiplier;

  return {
    coins: Math.round((baseCoins + bonusCoins) * coinMultiplier),
    completionBonusCoins: bonusCoins,
    xp: Math.round(xp),
    bonusMultiplier: coinMultiplier,
  };
}

/** Sum and cap passive bonuses from a list of equipped items. */
export function combinePassiveBonuses(bonuses: readonly (PassiveBonus | undefined)[]): Required<PassiveBonus> {
  let xpPct = 0;
  let coinPct = 0;
  for (const bonus of bonuses) {
    xpPct += bonus?.xpPct ?? 0;
    coinPct += bonus?.coinPct ?? 0;
  }
  return {
    xpPct: Math.min(ECONOMY.itemBonusCaps.xpPct, xpPct),
    coinPct: Math.min(ECONOMY.itemBonusCaps.coinPct, coinPct),
  };
}
