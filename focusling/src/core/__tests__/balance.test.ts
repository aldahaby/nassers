import { ECONOMY } from '@/config/economy';
import { SHOP_ITEMS } from '@/config/shopCatalog';
import { calculateCoinXpReward } from '../economy/economyService';

const noBonus = { streakDays: 0, itemBonus: { xpPct: 0, coinPct: 0 } };
const coinsFor = (minutes: number) => calculateCoinXpReward(minutes, minutes, 'completed', noBonus).coins;

/** Price bands from the milestone brief (see the comment at the top of shopCatalog.ts). */
const BANDS: Record<string, [number, number]> = {
  food: [4, 12],
  toy: [12, 30],
  accessory: [20, 70],
  decoration: [30, 80],
};
const ASPIRATIONAL_MIN = 100;

describe('shop balance', () => {
  it('has 16–20 items across all four categories', () => {
    // The classic shop stays curated; cosmetic collections are counted separately.
    const classic = SHOP_ITEMS.filter((i) => !i.collection);
    expect(classic.length).toBeGreaterThanOrEqual(16);
    expect(classic.length).toBeLessThanOrEqual(20);
    expect(new Set(SHOP_ITEMS.map((i) => i.category))).toEqual(new Set(['food', 'toy', 'accessory', 'decoration']));
  });

  it('keeps every price inside its band (or clearly aspirational)', () => {
    for (const item of SHOP_ITEMS) {
      const [min, max] = BANDS[item.category]!;
      const inBand = item.price >= min && item.price <= max;
      const aspirational = item.category !== 'food' && item.category !== 'toy' && item.price >= ASPIRATIONAL_MIN;
      expect({ id: item.id, ok: inBand || aspirational }).toEqual({ id: item.id, ok: true });
    }
  });

  it('lets a new player buy something after one session, and keeps goals within reach', () => {
    const afterOne = ECONOMY.starterCoins + coinsFor(30);
    const cheapest = Math.min(...SHOP_ITEMS.map((i) => i.price));
    const priciest = Math.max(...SHOP_ITEMS.map((i) => i.price));
    expect(afterOne).toBeGreaterThanOrEqual(cheapest);
    // A basic toy within about two 30-minute sessions.
    const cheapestToy = Math.min(...SHOP_ITEMS.filter((i) => i.category === 'toy').map((i) => i.price));
    expect(ECONOMY.starterCoins + 2 * coinsFor(30)).toBeGreaterThanOrEqual(cheapestToy);
    // At least one aspirational item, and the priciest takes at most ~10 hour-long sessions.
    expect(SHOP_ITEMS.some((i) => i.price >= ASPIRATIONAL_MIN)).toBe(true);
    expect(priciest).toBeLessThanOrEqual(10 * coinsFor(60));
  });

  it('gives every toy a cooldown, every food an effect, and every cosmetic a slot', () => {
    for (const item of SHOP_ITEMS) {
      if (item.category === 'toy') expect(item.playCooldownMinutes).toBeGreaterThan(0);
      if (item.category === 'food') expect(item.consumable && item.healthBonus + item.happinessBonus > 0).toBe(true);
      if (item.category === 'accessory' || item.category === 'decoration') expect(item.equipSlot).toBeDefined();
    }
  });
});

describe('play and missions never out-earn focus', () => {
  // Imported lazily to keep this file's original suite unchanged.
  const { PLAY_ECONOMY, TOY_TOSS, MEMORY_GARDEN } = jest.requireActual('@/config/play');
  const { MISSION_REWARD_LEVELS } = jest.requireActual('@/config/missions');
  const maxRoundCoins = Math.max(MEMORY_GARDEN.coins, ...TOY_TOSS.coinsByCatches);

  it('one 30-minute focus session is worth at least 3 play rounds', () => {
    expect(coinsFor(30)).toBeGreaterThanOrEqual(3 * maxRoundCoins);
  });

  it('a whole day of play earns no more than one 30-minute session', () => {
    expect(PLAY_ECONOMY.dailyCoinCap).toBeLessThanOrEqual(coinsFor(30));
  });

  it('the biggest mission reward stays below an hour of focus', () => {
    const biggest = Math.max(...Object.values(MISSION_REWARD_LEVELS as Record<string, { coins: number }>).map((r) => r.coins));
    expect(biggest).toBeLessThan(coinsFor(60));
  });
});
