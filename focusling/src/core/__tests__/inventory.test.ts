import { adoptPet } from '../game/gameEngine';
import {
  equipItem,
  feedPet,
  getEquippedBonuses,
  getShopListings,
  isEquipped,
  playWithToy,
  purchaseItem,
  toyCooldownRemainingMs,
  unequipItem,
  unequipSlot,
} from '../inventory/inventoryService';
import {
  debugClearInventory,
  debugDressUp,
  debugOwnOneOfEach,
  debugResetEquipped,
  debugUnlockAll,
} from '../game/debugTools';
import { createNewSave } from '../save/createNewSave';
import { MINUTE_MS } from '../shared/dates';
import { SHOP_ITEMS, getShopItem } from '@/config/shopCatalog';
import type { GameSave } from '../models';

const T0 = new Date(2026, 0, 5, 9, 0).getTime();
const withCoins = (coins: number): GameSave => ({ ...adoptPet(createNewSave(T0), 'emberling', 'Toast', T0), wallet: { coins } });
const rich = () => withCoins(1000);
const price = (id: string) => getShopItem(id)!.price;

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}
const buy = (save: GameSave, id: string) => unwrap(purchaseItem(save, id, T0)).save;

describe('purchasing', () => {
  it('buys an item, deducts its price exactly once and records the purchase', () => {
    const start = rich();
    const outcome = unwrap(purchaseItem(start, 'acc-sunglasses', T0));
    expect(outcome.save.wallet.coins).toBe(1000 - price('acc-sunglasses'));
    expect(outcome.save.stats).toMatchObject({ itemsPurchased: 1, coinsSpent: price('acc-sunglasses') });
    expect(outcome.save.inventory.items['acc-sunglasses']?.quantity).toBe(1);
    expect(outcome.happinessGained).toBe(5);
    // A repeat attempt is rejected and must not charge again.
    const again = purchaseItem(outcome.save, 'acc-sunglasses', T0);
    expect(again).toEqual({ ok: false, error: 'already-owned' });
    expect(outcome.save.wallet.coins).toBe(1000 - price('acc-sunglasses'));
  });

  it('refuses when coins are short, without changing anything', () => {
    const poor = withCoins(price('decor-beanbag') - 1);
    expect(purchaseItem(poor, 'decor-beanbag', T0)).toEqual({ ok: false, error: 'insufficient-coins' });
    expect(purchaseItem(withCoins(price('decor-beanbag')), 'decor-beanbag', T0).ok).toBe(true);
    expect(purchaseItem(rich(), 'nope', T0)).toEqual({ ok: false, error: 'unknown-item' });
  });

  it('flags only the first-ever purchase', () => {
    const first = unwrap(purchaseItem(rich(), 'food-berry-snack', T0));
    expect(first.firstPurchase).toBe(true);
    expect(unwrap(purchaseItem(first.save, 'food-berry-snack', T0)).firstPurchase).toBe(false);
  });

  it('stacks food, which gives nothing until eaten', () => {
    let save = buy(rich(), 'food-berry-snack');
    const happy = save.pet!.stats.happiness;
    save = buy(save, 'food-berry-snack');
    expect(save.inventory.items['food-berry-snack']?.quantity).toBe(2);
    expect(save.pet!.stats.happiness).toBe(happy);
    expect(save.wallet.coins).toBe(1000 - 2 * price('food-berry-snack'));
  });
});

describe('equipment slots', () => {
  it('equips and unequips, and exposes equipped state in listings', () => {
    let save = buy(rich(), 'acc-cap');
    save = unwrap(equipItem(save, 'acc-cap'));
    expect(isEquipped(save.inventory, 'acc-cap')).toBe(true);
    expect(getShopListings(save.inventory).find((l) => l.id === 'acc-cap')).toMatchObject({ owned: true, equipped: true });
    save = unequipItem(save, 'acc-cap');
    expect(isEquipped(save.inventory, 'acc-cap')).toBe(false);
    expect(save.inventory.items['acc-cap']).toBeDefined();
  });

  it('never wears two items that share a slot (cap, headphones and crowns are all "head")', () => {
    let save = buy(buy(buy(rich(), 'acc-cap'), 'acc-headphones'), 'acc-golden-crown');
    save = unwrap(equipItem(save, 'acc-cap'));
    save = unwrap(equipItem(save, 'acc-headphones'));
    expect(save.inventory.equipped.head).toBe('acc-headphones');
    expect(isEquipped(save.inventory, 'acc-cap')).toBe(false);
    save = unwrap(equipItem(save, 'acc-golden-crown'));
    expect(Object.values(save.inventory.equipped).filter((id) => getShopItem(id!)?.equipSlot === 'head')).toEqual(['acc-golden-crown']);
  });

  it('lets compatible slots be worn together', () => {
    let save = buy(buy(buy(rich(), 'acc-cap'), 'acc-sunglasses'), 'acc-bow-tie');
    for (const id of ['acc-cap', 'acc-sunglasses', 'acc-bow-tie']) save = unwrap(equipItem(save, id));
    expect(save.inventory.equipped).toEqual({ head: 'acc-cap', face: 'acc-sunglasses', neck: 'acc-bow-tie' });
  });

  it('refuses to equip unowned or non-equippable items', () => {
    expect(equipItem(rich(), 'acc-headphones')).toEqual({ ok: false, error: 'not-owned' });
    expect(equipItem(buy(rich(), 'food-cookie'), 'food-cookie')).toEqual({ ok: false, error: 'not-equippable' });
    expect(equipItem(buy(rich(), 'toy-bouncy-ball'), 'toy-bouncy-ball')).toEqual({ ok: false, error: 'not-equippable' });
  });

  it('places room decorations in their own slots, replacing within a slot', () => {
    let save = rich();
    for (const id of ['decor-potted-plant', 'decor-aquarium', 'decor-glow-lamp', 'decor-beanbag', 'decor-cozy-rug', 'decor-star-garland']) {
      save = unwrap(equipItem(buy(save, id), id));
    }
    expect(save.inventory.equipped).toMatchObject({
      floorLeft: 'decor-aquarium',
      floorRight: 'decor-beanbag',
      floorCenter: 'decor-cozy-rug',
      wall: 'decor-star-garland',
    });
    expect(getEquippedBonuses(save.inventory).coinPct).toBeCloseTo(0.1); // capped
    expect(unequipSlot(save, 'floorCenter').inventory.equipped.floorCenter).toBeUndefined();
  });
});

describe('food and toys', () => {
  it('consumes one food per feeding and applies its configured effects', () => {
    let save = buy(buy(rich(), 'food-fruit-bowl'), 'food-fruit-bowl');
    save = { ...save, pet: { ...save.pet!, stats: { health: 60, happiness: 60 } } };
    const fed = unwrap(feedPet(save, 'food-fruit-bowl', T0));
    expect(fed.save.inventory.items['food-fruit-bowl']?.quantity).toBe(1);
    expect(fed.healthGained).toBe(getShopItem('food-fruit-bowl')!.healthBonus);
    expect(fed.happinessGained).toBe(getShopItem('food-fruit-bowl')!.happinessBonus);
    const last = unwrap(feedPet(fed.save, 'food-fruit-bowl', T0));
    expect(last.save.inventory.items['food-fruit-bowl']).toBeUndefined();
    expect(feedPet(last.save, 'food-fruit-bowl', T0)).toEqual({ ok: false, error: 'not-owned' });
    expect(feedPet(buy(rich(), 'toy-bouncy-ball'), 'toy-bouncy-ball', T0)).toEqual({ ok: false, error: 'wrong-category' });
  });

  it('lets toys be played with any time but only rewards once per cooldown', () => {
    let save = buy(rich(), 'toy-bouncy-ball');
    save = { ...save, pet: { ...save.pet!, stats: { health: 80, happiness: 50 } } };
    const first = unwrap(playWithToy(save, 'toy-bouncy-ball', T0));
    expect(first).toMatchObject({ rewarded: true, happinessGained: 4 });

    const soon = unwrap(playWithToy(first.save, 'toy-bouncy-ball', T0 + 10 * MINUTE_MS));
    expect(soon).toMatchObject({ rewarded: false, happinessGained: 0 });
    expect(soon.save.pet!.stats.happiness).toBe(first.save.pet!.stats.happiness);
    // Playing during the cooldown does not extend it.
    expect(toyCooldownRemainingMs(soon.save, 'toy-bouncy-ball', T0 + 10 * MINUTE_MS)).toBe(20 * MINUTE_MS);

    const later = unwrap(playWithToy(soon.save, 'toy-bouncy-ball', T0 + 31 * MINUTE_MS));
    expect(later.rewarded).toBe(true);
    expect(playWithToy(rich(), 'toy-plush-bear', T0)).toEqual({ ok: false, error: 'not-owned' });
  });
});

describe('inventory debug tools', () => {
  it('unlocks, resets and clears without spending coins', () => {
    const start = rich();
    const all = debugUnlockAll(start, T0);
    expect(all.wallet.coins).toBe(1000);
    expect(Object.keys(all.inventory.items)).toHaveLength(SHOP_ITEMS.length);
    expect(all.inventory.items['food-cookie']?.quantity).toBe(5);
    expect(all.stats.itemsPurchased).toBe(0);

    const one = debugOwnOneOfEach(all, T0);
    expect(Object.values(one.inventory.items).every((i) => i.quantity === 1)).toBe(true);

    const dressed = debugDressUp(start, T0);
    // Regression: dressing up must never spend coins or count as a (first) purchase.
    expect(dressed.wallet.coins).toBe(1000);
    expect(dressed.stats).toMatchObject({ itemsPurchased: 0, coinsSpent: 0 });
    expect(Object.keys(dressed.inventory.equipped).sort()).toEqual(['face', 'floorCenter', 'floorLeft', 'floorRight', 'head', 'neck', 'wall']);
    const bare = debugResetEquipped(dressed);
    expect(bare.inventory.equipped).toEqual({});
    expect(Object.keys(bare.inventory.items)).toHaveLength(SHOP_ITEMS.length);

    expect(debugClearInventory(dressed).inventory).toEqual({ items: {}, equipped: {} });
  });
});
