import { COLLECTION_LIST } from '@/config/collections';
import { PREMIUM_LOOKS } from '@/config/cosmetics';
import { ROOM_THEMES, getRoomTheme } from '@/config/roomThemes';
import { CATALOG, getShopItem } from '@/config/shopCatalog';
import { capabilitiesFor, canWear, FREE_ENTITLEMENT, isPremiumTier, itemAccess } from '../entitlements/entitlementService';
import { effectiveEquipped, getWardrobe, wearCollectionLook, wearOutfit, checkCollections, collectionProgress } from '../cosmetics/cosmeticsService';
import { equipItem, purchaseItem } from '../inventory/inventoryService';
import { adoptPet } from '../game/gameEngine';
import { setRoomColor, setRoomTheme } from '../room/roomService';
import { createNewSave } from '../save/createNewSave';
import { migrateSave } from '../save/migrations';
import type { Capabilities, EntitlementState, GameSave } from '../models';

const T0 = new Date(2026, 8, 28, 10, 0).getTime();
const fresh = (): GameSave => adoptPet(createNewSave(T0), 'cloudling', 'Nimbus', T0);
const ctx = { childView: false, storeAvailable: true };
const active: EntitlementState = { tier: 'premium', source: 'storekit', status: 'active', productId: 'p', willAutoRenew: true };
const FREE = capabilitiesFor(FREE_ENTITLEMENT, ctx);
const PREMIUM = capabilitiesFor(active, ctx);
const PREMIUM_IDS = CATALOG.filter((i) => i.access === 'premium').map((i) => i.id);
const themeOpts = (entitled: boolean) => ({ known: (id: string) => Boolean(getRoomTheme(id)), premium: (id: string) => getRoomTheme(id)?.access === 'premium', entitled });

describe('entitlement → capabilities (the single source of truth)', () => {
  it('Free has every core capability off for Premium content, previews on', () => {
    expect(FREE).toEqual({
      canUsePremiumCollections: false,
      canUsePremiumLooks: false,
      canUsePremiumRoomThemes: false,
      canUsePremiumEffects: false,
      canUseAdvancedCustomization: false,
      canPurchase: true,
      canPreviewPremium: true,
    });
  });

  it('an active Premium or student-promo subscription unlocks everything and stops offering purchase', () => {
    for (const tier of ['premium', 'premiumStudentPromo'] as const) {
      const caps = capabilitiesFor({ ...active, tier }, ctx);
      expect(Object.entries(caps).filter(([k]) => k.startsWith('canUse')).every(([, v]) => v)).toBe(true);
      expect(caps.canPurchase).toBe(false);
    }
  });

  it('pending, expired, revoked and unknown states are not Premium', () => {
    for (const status of ['pending', 'expired', 'revoked', 'unknown', 'inactive', 'unavailable'] as const) {
      expect(isPremiumTier({ ...active, status })).toBe(false);
      expect(capabilitiesFor({ ...active, status }, ctx).canUsePremiumCollections).toBe(false);
    }
  });

  it('a dev override counts (it only exists while Developer tools are on; see the store tests)', () => {
    expect(isPremiumTier({ tier: 'premium', source: 'devOverride', status: 'active' })).toBe(true);
    expect(isPremiumTier({ tier: 'free', source: 'devOverride', status: 'inactive' })).toBe(false);
  });

  it('Child View can never purchase, and neither can a device without a store', () => {
    expect(capabilitiesFor(FREE_ENTITLEMENT, { childView: true, storeAvailable: true }).canPurchase).toBe(false);
    expect(capabilitiesFor(FREE_ENTITLEMENT, { childView: false, storeAvailable: false }).canPurchase).toBe(false);
    // Previews still work everywhere.
    expect(capabilitiesFor(FREE_ENTITLEMENT, { childView: true, storeAvailable: false }).canPreviewPremium).toBe(true);
  });

  it('entitlement is not part of the save', () => {
    const keys = Object.keys(fresh());
    expect(keys).not.toEqual(expect.arrayContaining(['entitlement']));
    expect(JSON.stringify(fresh())).not.toMatch(/premium|entitlement|storekit/i);
  });
});

describe('Premium catalog metadata', () => {
  it('every item has an access tier; Premium pieces are not for sale and not earned', () => {
    for (const item of CATALOG) expect(['free', 'premium']).toContain(itemAccess(item));
    expect(PREMIUM_IDS.length).toBeGreaterThanOrEqual(6);
    for (const id of PREMIUM_IDS) {
      const item = getShopItem(id)!;
      expect(item.source).toBe('premium');
      expect(item.unlock).toBeUndefined();
      expect(purchaseItem({ ...fresh(), wallet: { coins: 99999 } }, id, T0).ok).toBe(false);
    }
  });

  it('Premium collections have no reaction or completion reward, and free ones are unchanged', () => {
    const premium = COLLECTION_LIST.filter((c) => c.access === 'premium');
    expect(premium.map((c) => c.id)).toEqual(['nightglow']);
    for (const c of premium) expect(c.reaction).toBeUndefined();
    for (const c of COLLECTION_LIST.filter((c) => c.access !== 'premium')) expect(c.reaction).toBeTruthy();
  });

  it('Premium Looks and themes only use known Premium/free pieces and original themes', () => {
    for (const l of PREMIUM_LOOKS) for (const id of Object.values(l.featuredLook)) expect(getShopItem(id!)).toBeDefined();
    expect(ROOM_THEMES.length).toBeGreaterThanOrEqual(4);
    for (const t of ROOM_THEMES) expect(t.access).toBe('premium');
  });
});

describe('wearing Premium pieces', () => {
  const id = 'ng-headband';
  it('can be previewed by anyone (wardrobe state "premium") but only worn with Premium', () => {
    const save = fresh();
    expect(getWardrobe(save, FREE).find((e) => e.item.id === id)?.state).toBe('premium');
    expect(getWardrobe(save, PREMIUM).find((e) => e.item.id === id)?.state).toBe('included');
    expect(equipItem(save, id, FREE).ok).toBe(false);
    expect(equipItem(save, id).ok).toBe(false);
    const worn = equipItem(save, id, PREMIUM);
    expect(worn.ok && worn.value.inventory.equipped.head).toBe(id);
    expect(worn.ok && worn.value.inventory.items[id]).toBeUndefined(); // never added to inventory
  });

  it('owned (free) items are always wearable, with or without Premium', () => {
    const save = fresh();
    const owned = Object.keys(save.inventory.items).find((k) => getShopItem(k)?.equipSlot);
    if (owned) {
      expect(canWear(save, getShopItem(owned)!, FREE)).toBe(true);
      expect(equipItem(save, owned, FREE).ok).toBe(true);
    }
  });

  it('losing Premium hides Premium pieces without deleting them; they return on resubscribe', () => {
    const worn = wearCollectionLook(fresh(), 'nightglow', PREMIUM);
    const look = Object.values(COLLECTION_LIST.find((c) => c.id === 'nightglow')!.featuredLook) as string[];
    expect(look.length).toBeGreaterThanOrEqual(4);
    expect(Object.values(worn.inventory.equipped)).toEqual(expect.arrayContaining(look));
    const hidden = effectiveEquipped(worn, FREE);
    for (const pid of look) expect(Object.values(hidden)).not.toContain(pid);
    expect(worn.inventory.equipped).toEqual(migrateSave(JSON.parse(JSON.stringify(worn))).inventory.equipped);
    expect(effectiveEquipped(worn, PREMIUM)).toBe(worn.inventory.equipped);
  });

  it('wearOutfit without Premium only applies the owned parts', () => {
    const look = PREMIUM_LOOKS[0]!.featuredLook;
    const free = wearOutfit(fresh(), look, FREE);
    for (const v of Object.values(free.inventory.equipped)) expect(getShopItem(v!)?.access ?? 'free').toBe('free');
  });

  it('Premium collections never count toward completion or grant rewards', () => {
    const worn = wearCollectionLook(fresh(), 'nightglow', PREMIUM);
    expect(checkCollections(worn).completedCollections).not.toContain('nightglow');
    expect(collectionProgress(worn, 'nightglow').owned).toBe(0);
  });
});

describe('room: free colour, Premium themes', () => {
  it('colour stays free regardless of entitlement', () => {
    expect(setRoomColor(fresh(), '#123456').room.color).toBe('#123456');
  });

  it('a Premium theme needs Premium to be saved; unknown themes are ignored; null clears', () => {
    const save = fresh();
    expect(setRoomTheme(save, 'dreamwave-night', themeOpts(false))).toBe(save);
    expect(setRoomTheme(save, 'nope', themeOpts(true))).toBe(save);
    const themed = setRoomTheme(save, 'dreamwave-night', themeOpts(true));
    expect(themed.room).toEqual({ color: null, theme: 'dreamwave-night' });
    expect(setRoomTheme(themed, null, themeOpts(false)).room.theme).toBeNull();
  });
});

describe('v7 → v8 migration', () => {
  it('adds room.theme and keeps everything else exactly', () => {
    const current = setRoomColor(wearCollectionLook(fresh(), 'dreamwave', FREE), '#1E2447');
    const v7 = JSON.parse(JSON.stringify({ ...current, schemaVersion: 7 })) as Record<string, unknown>;
    (v7.room as Record<string, unknown>) = { color: '#1E2447' };
    const migrated = migrateSave(v7);
    expect(migrated.schemaVersion).toBe(8);
    expect(migrated.room).toEqual({ color: '#1E2447', theme: null });
    const { room: _a, schemaVersion: _b, ...rest } = migrated;
    const { room: _c, schemaVersion: _d, ...before } = current;
    expect(rest).toEqual(before);
  });

  it('drops a corrupted theme value instead of crashing', () => {
    const save = JSON.parse(JSON.stringify(fresh()));
    save.room = { color: null, theme: 42 };
    expect(migrateSave(save).room.theme).toBeNull();
  });

  it('keeps friends/student data out of the save', () => {
    const json = JSON.stringify(fresh());
    expect(json).not.toMatch(/friend|student|verification/i);
  });
});

export type { Capabilities };
