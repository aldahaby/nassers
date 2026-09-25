import { calculateCoinXpReward, combinePassiveBonuses, streakCoinMultiplier } from '../economy/economyService';

const noBonus = { streakDays: 0, itemBonus: { xpPct: 0, coinPct: 0 } };

describe('economy', () => {
  it('pays base + completion bonus for completed sessions', () => {
    expect(calculateCoinXpReward(15, 15, 'completed', noBonus)).toMatchObject({ coins: 6, completionBonusCoins: 3, xp: 38 });
    expect(calculateCoinXpReward(30, 30, 'completed', noBonus)).toMatchObject({ coins: 10, xp: 75 });
    expect(calculateCoinXpReward(60, 60, 'completed', noBonus)).toMatchObject({ coins: 18, xp: 180 });
  });

  it('pays less, never negative, for abandoned sessions', () => {
    expect(calculateCoinXpReward(4, 60, 'abandoned', noBonus)).toMatchObject({ coins: 0, xp: 0 });
    const partial = calculateCoinXpReward(30, 60, 'abandoned', noBonus);
    expect(partial).toMatchObject({ coins: 3, completionBonusCoins: 0, xp: 30 });
    expect(partial.coins).toBeLessThan(calculateCoinXpReward(30, 30, 'completed', noBonus).coins);
  });

  it('applies and caps streak bonuses', () => {
    expect(streakCoinMultiplier(0)).toBe(1);
    expect(streakCoinMultiplier(5)).toBeCloseTo(1.1);
    expect(streakCoinMultiplier(100)).toBeCloseTo(1.2);
  });

  it('caps passive item bonuses', () => {
    expect(combinePassiveBonuses([{ xpPct: 0.08 }, { xpPct: 0.08 }, { coinPct: 0.02 }, undefined])).toEqual({
      xpPct: 0.1,
      coinPct: 0.02,
    });
  });
});
