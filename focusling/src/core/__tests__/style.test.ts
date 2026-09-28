import { COLLECTION_LIST, getCollection } from '@/config/collections';
import { COLLECTION_ITEMS } from '@/config/cosmetics';
import { REACTIONS, STARTER_REACTIONS, getReaction } from '@/config/reactions';
import { getShopItem } from '@/config/shopCatalog';
import {
  applyLook,
  checkCollections,
  clearLook,
  collectionItemIds,
  collectionProgress,
  conflictsFor,
  equipReaction,
  favoriteReaction,
  lookName,
  processStyleRewards,
  renameLook,
  saveLook,
  wearCollectionLook,
  wearOutfit,
  WEARABLE_SLOTS,
} from '../cosmetics/cosmeticsService';
import { debugCollectionAlmostDone, debugUnlockCollection } from '../game/debugStyle';
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
const fresh = (): GameSave => adoptPet(createNewSave(T0), 'cloudling', 'Nimbus', T0);
const own = (save: GameSave, ids: string[]): GameSave => ({
  ...save,
  inventory: { ...save.inventory, items: { ...save.inventory.items, ...Object.fromEntries(ids.map((id) => [id, { itemId: id, acquiredAt: T0, quantity: 1, lastUsedAt: null }])) } },
});
function session(save: GameSave, planned: number, at: number, outcome: 'completed' | 'abandoned' = 'completed', stopAfter = planned) {
  const started = unwrap(startSession(save, planned, [], at));
  return unwrap(endSession(started, outcome, at + stopAfter * MINUTE_MS));
}

describe('collection registry', () => {
  it('registers five permanent, first-party collections with unique ids', () => {
    expect(COLLECTION_LIST.map((c) => c.id)).toEqual(['focus-club', 'midnight-arcade', 'dreamwave', 'cloud-racer', 'moss-club']);
    for (const c of COLLECTION_LIST) {
      expect(c.availability).toEqual({ kind: 'permanent' });
      expect(c.origin.kind).toBe('first-party');
      expect(c.name && c.tagline && c.description && c.badge).toBeTruthy();
    }
  });

  it('each new collection has 6–8 wearable pieces with real silhouette variety', () => {
    for (const id of ['midnight-arcade', 'dreamwave', 'cloud-racer', 'moss-club']) {
      const ids = collectionItemIds(id);
      expect(ids.length).toBeGreaterThanOrEqual(6);
      expect(ids.length).toBeLessThanOrEqual(8);
      const artKeys = new Set(ids.map((i) => getShopItem(i)!.art!.key));
      expect(artKeys.size).toBeGreaterThanOrEqual(5); // colourways allowed, but mostly new shapes
      const slots = new Set(ids.map((i) => getShopItem(i)!.equipSlot));
      expect([...slots].sort()).toEqual(['aura', 'charm', 'face', 'head', 'neck']);
    }
    const total = ['midnight-arcade', 'dreamwave', 'cloud-racer'].reduce((n, id) => n + collectionItemIds(id).length, 0);
    expect(total).toBeGreaterThanOrEqual(18);
    expect(total).toBeLessThanOrEqual(24);
  });

  it('every collection item points at a registered collection', () => {
    for (const item of COLLECTION_ITEMS) expect(getCollection(item.collection!)).toBeDefined();
  });

  it('curated Looks use owned-able pieces from their own collection, in the right slots', () => {
    for (const c of COLLECTION_LIST) {
      const entries = Object.entries(c.featuredLook);
      expect(entries.length).toBeGreaterThanOrEqual(3);
      for (const [slot, id] of entries) {
        const item = getShopItem(id!);
        expect(item?.collection).toBe(c.id);
        expect(item?.equipSlot).toBe(slot);
      }
    }
  });

  it('each collection unlocks its own distinct reaction', () => {
    const reactions = COLLECTION_LIST.map((c) => c.reaction);
    expect(new Set(reactions).size).toBe(reactions.length);
    for (const c of COLLECTION_LIST) {
      expect(getReaction(c.reaction)?.unlock).toEqual({ kind: 'collection', collectionId: c.id });
    }
  });

  it('room accents belong to their collection but not to its completion', () => {
    for (const c of COLLECTION_LIST.filter((x) => x.roomAccent)) {
      expect(getShopItem(c.roomAccent!)?.category).toBe('decoration');
      expect(collectionItemIds(c.id)).not.toContain(c.roomAccent);
    }
  });
});

describe('collection progress and completion', () => {
  it('reports 0%, partial and complete', () => {
    const save = fresh();
    expect(collectionProgress(save, 'midnight-arcade')).toEqual({ owned: 0, total: 7, complete: false, celebrated: false });
    const partial = own(save, ['ma-beanie', 'ma-visor', 'ma-charm']);
    expect(collectionProgress(partial, 'midnight-arcade')).toMatchObject({ owned: 3, total: 7, complete: false });
    const full = debugUnlockCollection(save, 'midnight-arcade', T0);
    expect(collectionProgress(full, 'midnight-arcade')).toMatchObject({ owned: 7, complete: true, celebrated: false });
  });

  it('completion is detected exactly once and unlocks the right reaction once', () => {
    const full = debugUnlockCollection(fresh(), 'dreamwave', T0);
    const first = checkCollections(full);
    expect(first.completedCollections).toEqual(['dreamwave']);
    expect(first.unlockedReactions).toEqual(['dream-float']);
    expect(first.save.cosmetics.reactions.unlocked).toContain('dream-float');
    const again = checkCollections(first.save);
    expect(again.completedCollections).toEqual([]);
    expect(again.unlockedReactions).toEqual([]);
    // A reload (serialise + migrate) doesn't repeat it either.
    const reloaded = migrateSave(JSON.parse(JSON.stringify(first.save)));
    expect(checkCollections(reloaded).completedCollections).toEqual([]);
    expect(reloaded.cosmetics.reactions.unlocked.filter((r) => r === 'dream-float')).toHaveLength(1);
  });

  it('buying the last coin piece completes the collection', () => {
    const { save: almost, missing } = debugCollectionAlmostDone(fresh(), 'cloud-racer', T0);
    expect(getShopItem(missing!)?.source ?? 'shop').toBe('shop');
    const bought = unwrap(purchaseItem({ ...almost, wallet: { coins: 999 } }, missing!, T0)).save;
    const style = processStyleRewards(bought, T0);
    expect(style.completedCollections).toEqual(['cloud-racer']);
    expect(style.unlockedReactions).toEqual(['victory-lap']);
  });

  it('earning the final piece in a session reports the completion in the summary', () => {
    // Own Midnight Arcade except the 5-session beanie, with 4 sessions already done.
    let save = own(fresh(), collectionItemIds('midnight-arcade').filter((id) => id !== 'ma-beanie'));
    save = { ...save, stats: { ...save.stats, sessionsCompleted: 4 } };
    const ended = session(save, 15, T0);
    expect(ended.summary.unlockedItems).toContain('ma-beanie');
    expect(ended.summary.completedCollections).toEqual(['midnight-arcade']);
    expect(ended.summary.unlockedReactions).toEqual(['pixel-pop']);
    const next = session(ended.save, 15, T0 + 60 * MINUTE_MS);
    expect(next.summary.completedCollections).toEqual([]);
  });
});

describe('Looks', () => {
  it('wears a complete collection Look, then allows changing single pieces', () => {
    let save = wearCollectionLook(debugUnlockCollection(fresh(), 'cloud-racer', T0), 'cloud-racer');
    expect(save.inventory.equipped).toMatchObject({ head: 'cr-cap', face: 'cr-shades', neck: 'cr-scarf', aura: 'cr-aura' });
    save = unwrap(equipItem(save, 'cr-cap-cobalt'));
    expect(save.inventory.equipped.head).toBe('cr-cap-cobalt');
    expect(save.inventory.equipped.face).toBe('cr-shades');
  });

  it('a collection Look only wears owned pieces and replaces the current outfit', () => {
    let save = own(fresh(), ['dw-shades']);
    save = unwrap(equipItem(save, 'fc-charm-star'));
    const worn = wearCollectionLook(save, 'dreamwave');
    expect(worn.inventory.equipped).toEqual({ face: 'dw-shades' });
  });

  it('saves, loads, overwrites, renames and deletes personal Looks without touching collection Looks', () => {
    let save = debugUnlockCollection(fresh(), 'midnight-arcade', T0);
    save = wearCollectionLook(save, 'midnight-arcade');
    save = saveLook(save, 0, T0, 'Arcade night');
    expect(lookName(save.cosmetics.looks[0]!, 0)).toBe('Arcade night');
    expect(save.cosmetics.looks.filter(Boolean)).toHaveLength(1); // collection Looks use no slot

    save = unwrap(equipItem(save, 'ma-headset'));
    save = saveLook(save, 0, T0 + 1); // overwrite keeps the name
    expect(save.cosmetics.looks[0]).toMatchObject({ name: 'Arcade night', equipped: expect.objectContaining({ head: 'ma-headset' }) });

    save = renameLook(save, 0, '  Headset era  ');
    expect(save.cosmetics.looks[0]?.name).toBe('Headset era');
    const changed = unwrap(equipItem(save, 'ma-beanie'));
    expect(applyLook(changed, 0).inventory.equipped.head).toBe('ma-headset');

    save = clearLook(save, 0);
    expect(save.cosmetics.looks).toEqual([null, null, null]);
    expect(lookName({ id: 'x', equipped: {}, savedAt: 0 }, 2)).toBe('Look 3');
  });

  it('legacy or unknown ids in a Look are skipped gracefully', () => {
    const save = own(fresh(), ['ma-beanie']);
    const worn = wearOutfit(save, { head: 'ma-beanie', face: 'retired-item-123', neck: 'fc-charm-star' as never });
    expect(worn.inventory.equipped).toEqual({ head: 'ma-beanie' });
  });
});

describe('compatibility', () => {
  it('equipping the acorn satchel quietly takes off a charm, and vice versa (its strap crosses the charm)', () => {
    let save = own(fresh(), ['mc-satchel', 'cr-badge']);
    save = unwrap(equipItem(save, 'cr-badge'));
    expect(conflictsFor(save.inventory.equipped, 'mc-satchel')).toEqual(['cr-badge']);
    save = unwrap(equipItem(save, 'mc-satchel'));
    expect(save.inventory.equipped).toMatchObject({ neck: 'mc-satchel' });
    expect(save.inventory.equipped.charm).toBeUndefined();
    save = unwrap(equipItem(save, 'fc-charm-star'));
    expect(save.inventory.equipped).toMatchObject({ charm: 'fc-charm-star' });
    expect(save.inventory.equipped.neck).toBeUndefined();
  });

  it('the racing scarf ties at the side now, so it wears with a charm', () => {
    let save = own(fresh(), ['cr-scarf', 'cr-badge']);
    save = unwrap(equipItem(unwrap(equipItem(save, 'cr-badge')), 'cr-scarf'));
    expect(save.inventory.equipped).toMatchObject({ neck: 'cr-scarf', charm: 'cr-badge' });
  });

  it('exclusions are rare: only pieces with a real visual overlap carry one', () => {
    const excluding = COLLECTION_ITEMS.filter((i) => (i.excludes ?? []).length > 0).map((i) => i.id);
    expect(excluding).toEqual(['mc-satchel']);
  });

  it('a cross-collection remix wears together with no conflicts and no set bonus', () => {
    const remix = { head: 'dw-beret', face: 'ma-visor', neck: 'cr-scarf', charm: 'dw-charm', aura: 'mc-aura' };
    let save = own(fresh(), Object.values(remix));
    const before = { ...save.pet!.stats };
    save = wearOutfit(save, remix);
    expect(save.inventory.equipped).toMatchObject(remix);
    expect(save.pet!.stats).toEqual(before); // stat-neutral: a remix is never worse than a full set
  });

  it('non-conflicting slots stack as before', () => {
    let save = own(fresh(), ['dw-pearls', 'dw-charm']);
    save = unwrap(equipItem(unwrap(equipItem(save, 'dw-pearls')), 'dw-charm'));
    expect(save.inventory.equipped).toMatchObject({ neck: 'dw-pearls', charm: 'dw-charm' });
  });

  it('only wearable slots are ever excluded', () => {
    for (const item of COLLECTION_ITEMS) for (const slot of item.excludes ?? []) expect(WEARABLE_SLOTS).toContain(slot);
  });
});

describe('moss club', () => {
  it('has 7 original pieces across every slot, with a Look and a calm reaction', () => {
    const ids = collectionItemIds('moss-club');
    expect(ids).toHaveLength(7);
    const c = getCollection('moss-club')!;
    for (const id of Object.values(c.featuredLook)) expect(ids).toContain(id);
    expect(getReaction(c.reaction)).toMatchObject({ id: 'firefly-hello', personality: 'calm', unlock: { kind: 'collection', collectionId: 'moss-club' } });
  });

  it('is earned by visible milestones or focus coins, never randomly', () => {
    for (const id of collectionItemIds('moss-club')) {
      const item = getShopItem(id)!;
      if (item.source === 'earned') expect(item.unlock).toBeDefined();
      else expect(item.source === 'shop' && item.price > 0).toBe(true);
    }
  });

  it('completing it unlocks Firefly Hello once', () => {
    let save = own(fresh(), collectionItemIds('moss-club'));
    const result = checkCollections(save);
    expect(result.save.cosmetics.completedCollections).toContain('moss-club');
    expect(result.save.cosmetics.reactions.unlocked).toContain('firefly-hello');
    expect(checkCollections(result.save).save.cosmetics.reactions.unlocked.filter((r) => r === 'firefly-hello')).toHaveLength(1);
  });
});

describe('reactions', () => {
  it('starts with the starter reactions and a favourite', () => {
    const save = fresh();
    expect(save.cosmetics.reactions.unlocked).toEqual([...STARTER_REACTIONS]);
    expect(favoriteReaction(save)).toBe('happy-hop');
    expect(STARTER_REACTIONS).toEqual(['wave', 'happy-hop', 'sleepy', 'cool-pose']);
  });

  it('locked reactions cannot be equipped; unlocked ones persist as favourite', () => {
    const save = fresh();
    expect(equipReaction(save, 'pixel-pop')).toEqual({ ok: false, error: 'locked' });
    expect(equipReaction(save, 'nope')).toEqual({ ok: false, error: 'unknown-reaction' });
    const cool = unwrap(equipReaction(save, 'cool-pose'));
    expect(migrateSave(JSON.parse(JSON.stringify(cool))).cosmetics.reactions.equipped).toBe('cool-pose');
  });

  it('completing a collection makes its reaction equippable', () => {
    const done = checkCollections(debugUnlockCollection(fresh(), 'midnight-arcade', T0)).save;
    expect(unwrap(equipReaction(done, 'pixel-pop')).cosmetics.reactions.equipped).toBe('pixel-pop');
  });

  it('every reaction is 1–3 s and has a known style', () => {
    for (const r of REACTIONS) {
      expect(r.durationMs).toBeGreaterThanOrEqual(1000);
      expect(r.durationMs).toBeLessThanOrEqual(3000);
    }
  });

  it('reactions never touch the focus session', () => {
    const started = unwrap(startSession(fresh(), 15, [], T0));
    const cool = unwrap(equipReaction(started, 'cool-pose'));
    expect(cool.focus).toBe(started.focus);
  });
});

describe('milestone rules', () => {
  it('ended-early minutes count toward focus-minute pieces; the session does not count as completed', () => {
    // 45 planned, 38 focused, ended early.
    let save = fresh();
    save = session(save, 45, T0, 'abandoned', 38).save;
    expect(save.stats.totalFocusMinutes).toBe(38);
    expect(save.stats.sessionsCompleted).toBe(0);
    expect(save.inventory.items['fc-visor-frost']).toBeUndefined(); // "finish your first session"
    // 3 more early-ended sessions pass 120 minutes → Cloud Cap (focus minutes) unlocks.
    for (let i = 1; i <= 3; i += 1) save = session(save, 45, T0 + i * 60 * MINUTE_MS, 'abandoned', 38).save;
    expect(save.stats.totalFocusMinutes).toBe(152);
    expect(save.inventory.items['fc-cap-plum']?.quantity).toBe(1);
    expect(save.inventory.items['fc-visor-frost']).toBeUndefined();
  });

  it('mission, streak and growth milestones unlock the right pieces', () => {
    const base = fresh();
    const withStats: GameSave = {
      ...base,
      stats: { ...base.stats, missionsCompleted: 7 },
      streak: { ...base.streak, bestDays: 7 },
      pet: { ...base.pet!, lifetimeXp: 1500 },
    };
    const { unlocked } = processStyleRewards(withStats, T0);
    expect(unlocked).toEqual(expect.arrayContaining(['ma-charm', 'dw-headband', 'ma-collar', 'dw-aura', 'dw-beret']));
    expect(unlocked).not.toContain('cr-scarf'); // needs 10 missions
  });

  it('coin pieces are bought, earned pieces are not for sale, and nothing duplicates after restart', () => {
    const rich = { ...fresh(), wallet: { coins: 999 } };
    expect(purchaseItem(rich, 'ma-beanie', T0)).toEqual({ ok: false, error: 'not-for-sale' });
    const bought = unwrap(purchaseItem(rich, 'ma-headset', T0)).save;
    expect(purchaseItem(bought, 'ma-headset', T0)).toEqual({ ok: false, error: 'already-owned' });
    const reloaded = migrateSave(JSON.parse(JSON.stringify(processStyleRewards(bought, T0).save)));
    expect(processStyleRewards(reloaded, T0).unlocked).toEqual([]);
  });
});

describe('v5 → v6 migration', () => {
  it('adds reactions and completion records, keeping cosmetics, outfit and saved Looks', () => {
    const base = own(fresh(), ['fc-visor-frost', 'acc-cap']);
    const v5 = JSON.parse(JSON.stringify({ ...base, schemaVersion: 5 }));
    v5.inventory.equipped = { face: 'fc-visor-frost', head: 'acc-cap' };
    v5.cosmetics = { newItemIds: ['fc-visor-frost'], looks: [{ id: 'l1', equipped: { face: 'fc-visor-frost' }, savedAt: 1 }, null, null] };
    const migrated = migrateSave(v5);
    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.cosmetics).toMatchObject({
      newItemIds: ['fc-visor-frost'],
      looks: [{ id: 'l1', equipped: { face: 'fc-visor-frost' } }, null, null],
      completedCollections: [],
      reactions: { unlocked: ['wave', 'happy-hop', 'sleepy', 'cool-pose'], equipped: 'happy-hop' },
    });
    expect(migrated.inventory.equipped).toEqual({ face: 'fc-visor-frost', head: 'acc-cap' });
    expect(migrated.pet?.name).toBe('Nimbus');
  });
});
