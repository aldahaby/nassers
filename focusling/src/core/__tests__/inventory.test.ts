import { adoptPet } from '../game/gameEngine';
import {
  equipItem,
  feedPet,
  getEquippedBonuses,
  getShopListings,
  playWithToy,
  purchaseItem,
  unequipSlot,
} from '../inventory/inventoryService';
import { createNewSave } from '../save/createNewSave';
import { MINUTE_MS } from '../shared/dates';
import type { GameSave } from '../models';

const T0 = new Date(2026, 0, 5, 9, 0).getTime();
const rich = (): GameSave => ({ ...adoptPet(createNewSave(T0), 'emberling', 'Toast', T0), wallet: { coins: 500 } });

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

describe('inventory', () => {
  it('buys items, deducts coins and blocks duplicates', () => {
    const save = unwrap(purchaseItem(rich(), 'acc-sunglasses', T0));
    expect(save.wallet.coins).toBe(440);
    expect(save.pet!.stats.happiness).toBe(76);
    expect(purchaseItem(save, 'acc-sunglasses', T0)).toEqual({ ok: false, error: 'already-owned' });
    expect(purchaseItem(createNewSave(T0), 'decor-beanbag', T0)).toEqual({ ok: false, error: 'insufficient-coins' });
    expect(purchaseItem(save, 'nope', T0)).toEqual({ ok: false, error: 'unknown-item' });
  });

  it('stacks and consumes food', () => {
    let save = unwrap(purchaseItem(rich(), 'food-berry-snack', T0));
    save = unwrap(purchaseItem(save, 'food-berry-snack', T0));
    expect(save.inventory.items['food-berry-snack']?.quantity).toBe(2);
    save = unwrap(feedPet(save, 'food-berry-snack', T0));
    save = unwrap(feedPet(save, 'food-berry-snack', T0));
    expect(save.inventory.items['food-berry-snack']).toBeUndefined();
    expect(save.pet!.stats.health).toBe(96);
    expect(feedPet(save, 'food-berry-snack', T0)).toEqual({ ok: false, error: 'not-owned' });
  });

  it('equips one item per slot and exposes capped bonuses', () => {
    let save = unwrap(purchaseItem(rich(), 'decor-glow-lamp', T0));
    save = unwrap(purchaseItem(save, 'decor-beanbag', T0));
    save = unwrap(equipItem(save, 'decor-glow-lamp'));
    save = unwrap(equipItem(save, 'decor-beanbag'));
    expect(save.inventory.equipped.floorRight).toBe('decor-beanbag');
    expect(getEquippedBonuses(save.inventory).coinPct).toBeCloseTo(0.03);
    expect(getShopListings(save.inventory).find((l) => l.id === 'decor-glow-lamp')).toMatchObject({ owned: true, equipped: false });
    save = unwrap(equipItem(save, 'decor-glow-lamp'));
    expect(getShopListings(save.inventory).find((l) => l.id === 'decor-glow-lamp')?.equipped).toBe(true);
    save = unwrap(equipItem(save, 'decor-glow-lamp'));
    expect(unequipSlot(save, 'floorRight').inventory.equipped.floorRight).toBeUndefined();
    expect(equipItem(save, 'acc-headphones')).toEqual({ ok: false, error: 'not-owned' });
    expect(equipItem(save, 'food-berry-snack')).toEqual({ ok: false, error: 'not-equippable' });
  });

  it('enforces toy cooldowns', () => {
    let save = unwrap(purchaseItem(rich(), 'toy-bouncy-ball', T0));
    save = unwrap(playWithToy(save, 'toy-bouncy-ball', T0));
    expect(playWithToy(save, 'toy-bouncy-ball', T0 + 10 * MINUTE_MS)).toEqual({ ok: false, error: 'on-cooldown' });
    expect(playWithToy(save, 'toy-bouncy-ball', T0 + 31 * MINUTE_MS).ok).toBe(true);
  });
});
