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
    expect(SHOP_ITEMS.length).toBeGreaterThanOrEqual(16);
    expect(SHOP_ITEMS.length).toBeLessThanOrEqual(20);
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
