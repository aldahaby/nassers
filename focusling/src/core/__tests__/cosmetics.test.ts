import { COSMETICS, FOCUS_CLUB_ITEMS } from '@/config/cosmetics';
import { CATALOG, SHOP_ITEMS, getShopItem } from '@/config/shopCatalog';
import {
  applyLook,
  getWardrobe,
  grantUnlocks,
  markItemsSeen,
  nextUnlock,
  saveLook,
  unlockProgress,
  WEARABLE_SLOTS,
} from '../cosmetics/cosmeticsService';
import { adoptPet, endSession, startSession } from '../game/gameEngine';
import { equipItem, purchaseItem } from '../inventory/inventoryService';
import { migrateSave } from '../save/migrations';
import { createNewSave } from '../save/createNewSave';
import { MINUTE_MS } from '../shared/dates';
import type { GameSave } from '../models';

const T0 = new Date(2026, 8, 28, 10, 0).getTime();

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

function fresh(): GameSave {
  return adoptPet(createNewSave(T0), 'cloudling', 'Nimbus', T0);
}

function session(save: GameSave, minutes: number, at: number, outcome: 'completed' | 'abandoned' = 'completed') {
  const started = unwrap(startSession(save, minutes, [], at));
  return unwrap(endSession(started, outcome, at + minutes * MINUTE_MS));
}

describe('cosmetic catalog rules', () => {
  it('cosmetics are stat-neutral', () => {
    for (const item of CATALOG) expect(item.passiveBonus).toBeUndefined();
  });

  it('every collection item has a slot, art key, credit and a valid way to obtain it', () => {
    for (const item of FOCUS_CLUB_ITEMS) {
      expect(WEARABLE_SLOTS).toContain(item.equipSlot);
      expect(item.art?.key).toBeTruthy();
      expect(item.credit).toMatchObject({ rights: 'original' });
      if (item.source === 'earned') expect(item.unlock).toBeDefined();
      if (item.source === 'shop') expect(item.price).toBeGreaterThan(0);
    }
    expect(new Set(CATALOG.map((i) => i.id)).size).toBe(CATALOG.length);
  });

  it('covers every new slot and at least one colourway family', () => {
    const slots = new Set(FOCUS_CLUB_ITEMS.map((i) => i.equipSlot));
    expect([...slots].sort()).toEqual(['aura', 'charm', 'face', 'head', 'neck']);
    const keys = FOCUS_CLUB_ITEMS.map((i) => i.art!.key);
    expect(keys.filter((k) => k === 'gummy-visor').length).toBeGreaterThanOrEqual(3);
  });

  it('earned and starter items are not sold in the shop', () => {
    expect(SHOP_ITEMS.every((i) => (i.source ?? 'shop') === 'shop')).toBe(true);
    const save = { ...fresh(), wallet: { coins: 9999 } };
    expect(purchaseItem(save, 'fc-cap-plum', T0)).toEqual({ ok: false, error: 'not-for-sale' });
    expect(purchaseItem(save, 'fc-visor-persimmon', T0).ok).toBe(true);
  });
});

describe('unlocks', () => {
  it('a new save starts with the starter charm, marked new', () => {
    const save = fresh();
    expect(save.inventory.items['fc-charm-star']?.quantity).toBe(1);
    expect(save.cosmetics.newItemIds).toEqual(['fc-charm-star']);
  });

  it('the first finished session unlocks the Gummy Visor exactly once', () => {
    const first = session(fresh(), 15, T0);
    expect(first.summary.unlockedItems).toEqual(['fc-visor-frost']);
    expect(first.save.inventory.items['fc-visor-frost']).toMatchObject({ quantity: 1, acquiredAt: T0 + 15 * MINUTE_MS });
    expect(first.save.cosmetics.newItemIds).toContain('fc-visor-frost');

    const second = session(first.save, 15, T0 + 60 * MINUTE_MS);
    expect(second.summary.unlockedItems).toEqual([]);
    // Granting again (e.g. on the next launch) does nothing.
    expect(grantUnlocks(second.save, T0).unlocked).toEqual([]);
  });

  it('abandoned sessions do not count toward session milestones', () => {
    const ended = session(fresh(), 15, T0, 'abandoned');
    expect(ended.summary.unlockedItems).toEqual([]);
  });

  it('minutes, missions, streak and stage milestones use real stats', () => {
    const save = fresh();
    expect(unlockProgress(save, { kind: 'focusMinutes', minutes: 120 })).toEqual({ current: 0, target: 120, done: false });
    const busy: GameSave = {
      ...save,
      stats: { ...save.stats, totalFocusMinutes: 130, missionsCompleted: 5 },
      streak: { ...save.streak, bestDays: 3 },
      pet: { ...save.pet!, lifetimeXp: 300 },
    };
    const { unlocked } = grantUnlocks(busy, T0);
    expect(unlocked).toEqual(expect.arrayContaining(['fc-cap-plum', 'fc-harness', 'fc-aura-sleepy', 'fc-aura-sparkle']));
    expect(unlocked).not.toContain('fc-cap-frost');
  });

  it('shows the closest locked item honestly', () => {
    const next = nextUnlock(fresh());
    expect(next?.item.id).toBe('fc-visor-frost');
    expect(next?.progress).toEqual({ current: 0, target: 1, done: false });
  });

  it('marking items seen clears only those badges', () => {
    const save = session(fresh(), 15, T0).save;
    const seen = markItemsSeen(save, ['fc-visor-frost']);
    expect(seen.cosmetics.newItemIds).toEqual(['fc-charm-star']);
  });
});

describe('wardrobe and looks', () => {
  it('lists every wearable with a state and progress', () => {
    const save = unwrap(equipItem(fresh(), 'fc-charm-star'));
    const wardrobe = getWardrobe(save);
    const byId = Object.fromEntries(wardrobe.map((e) => [e.item.id, e]));
    expect(byId['fc-charm-star']?.state).toBe('equipped');
    expect(byId['fc-visor-frost']).toMatchObject({ state: 'earnable', progress: { current: 0, target: 1 } });
    expect(byId['fc-visor-wasabi']?.state).toBe('buyable');
    expect(byId['acc-cap']?.state).toBe('buyable');
    expect(byId['decor-cozy-rug']).toBeUndefined();
  });

  it('saves and re-applies a look, touching only wearable slots', () => {
    let save = session(fresh(), 15, T0).save;
    save = unwrap(equipItem(save, 'fc-charm-star'));
    save = unwrap(equipItem(save, 'fc-visor-frost'));
    save = { ...save, inventory: { ...save.inventory, equipped: { ...save.inventory.equipped, wall: 'decor-star-garland' } } };
    save = saveLook(save, 0, T0);
    expect(save.cosmetics.looks[0]?.equipped).toEqual({ charm: 'fc-charm-star', face: 'fc-visor-frost' });

    const changed = { ...save, inventory: { ...save.inventory, equipped: { wall: 'decor-star-garland', head: 'acc-cap' } } };
    const worn = applyLook(changed, 0);
    expect(worn.inventory.equipped).toEqual({ wall: 'decor-star-garland', charm: 'fc-charm-star', face: 'fc-visor-frost' });
  });

  it('a look never equips something no longer owned', () => {
    let save = session(fresh(), 15, T0).save;
    save = saveLook(unwrap(equipItem(save, 'fc-visor-frost')), 1, T0);
    const items = { ...save.inventory.items };
    delete items['fc-visor-frost'];
    expect(applyLook({ ...save, inventory: { ...save.inventory, items } }, 1).inventory.equipped.face).toBeUndefined();
    expect(save.cosmetics.looks).toHaveLength(COSMETICS.maxLooks);
  });
});

describe('v4 → v5 migration', () => {
  it('adds cosmetics state and backfills missions, keeping items and outfits', () => {
    const base = createNewSave(T0);
    const v4 = JSON.parse(JSON.stringify({ ...base, schemaVersion: 4 }));
    delete v4.cosmetics;
    delete v4.stats.missionsCompleted;
    v4.inventory = { items: { 'acc-cap': { itemId: 'acc-cap', acquiredAt: 1, quantity: 1, lastUsedAt: null } }, equipped: { head: 'acc-cap' } };
    v4.daily = { '2026-09-27': { ...Object.values(base.daily)[0], date: '2026-09-27', focusMinutes: 0, sessionsCompleted: 0, sessionsAbandoned: 0, coinsEarned: 0, xpEarned: 0, missionsCompleted: 2, missionCoinsEarned: 20 } };
    const migrated = migrateSave(v4);
    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.cosmetics).toMatchObject({ newItemIds: [], looks: [null, null, null] });
    expect(migrated.stats.missionsCompleted).toBe(2);
    expect(migrated.inventory.equipped).toEqual({ head: 'acc-cap' });
    expect(getShopItem('acc-cap')?.passiveBonus).toBeUndefined();
  });
});
