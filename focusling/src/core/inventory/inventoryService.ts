import { SHOP_ITEMS, getShopItem } from '@/config/shopCatalog';
import { combinePassiveBonuses } from '../economy/economyService';
import { applyStatDelta } from '../pet/petCareService';
import { MINUTE_MS } from '../shared/dates';
import { fail, ok, type Result } from '../shared/result';
import type {
  CareOutcome,
  EquipSlot,
  GameSave,
  PassiveBonus,
  PurchaseOutcome,
  ShopItem,
  ShopListing,
  Timestamp,
  UserInventory,
} from '../models';

export type InventoryError =
  | 'unknown-item'
  | 'insufficient-coins'
  | 'already-owned'
  | 'not-owned'
  | 'not-equippable'
  | 'wrong-category'
  | 'no-pet';

export function createInventory(): UserInventory {
  return { items: {}, equipped: {} };
}

export function isOwned(inventory: UserInventory, itemId: string): boolean {
  return (inventory.items[itemId]?.quantity ?? 0) > 0;
}

export function isEquipped(inventory: UserInventory, itemId: string): boolean {
  const slot = getShopItem(itemId)?.equipSlot;
  return slot !== undefined && inventory.equipped[slot] === itemId;
}

export function getShopListings(inventory: UserInventory): ShopListing[] {
  return SHOP_ITEMS.map((item) => toListing(item, inventory));
}

export function getOwnedListings(inventory: UserInventory): ShopListing[] {
  return getShopListings(inventory).filter((listing) => listing.owned);
}

function toListing(item: ShopItem, inventory: UserInventory): ShopListing {
  const quantity = inventory.items[item.id]?.quantity ?? 0;
  return { ...item, owned: quantity > 0, quantity, equipped: isEquipped(inventory, item.id) };
}

/** Summed and capped bonuses from everything currently equipped. */
export function getEquippedBonuses(inventory: UserInventory): Required<PassiveBonus> {
  const bonuses = Object.values(inventory.equipped).map((id) => (id ? getShopItem(id)?.passiveBonus : undefined));
  return combinePassiveBonuses(bonuses);
}

/** Coins still needed to afford an item (0 when affordable). */
export function coinsShort(save: GameSave, itemId: string): number {
  const item = getShopItem(itemId);
  return item ? Math.max(0, item.price - save.wallet.coins) : 0;
}

/**
 * Buy one of an item. Coins are deducted exactly once, here. Food stacks; every
 * other item can be owned once. Non-food items give a small one-time happiness
 * bump ("a gift!"); food pays out when eaten instead.
 */
export function purchaseItem(save: GameSave, itemId: string, now: Timestamp): Result<PurchaseOutcome, InventoryError> {
  const item = getShopItem(itemId);
  if (!item) return fail('unknown-item');
  if (!item.consumable && isOwned(save.inventory, itemId)) return fail('already-owned');
  if (save.wallet.coins < item.price) return fail('insufficient-coins');

  const existing = save.inventory.items[itemId];
  const inventory: UserInventory = {
    ...save.inventory,
    items: {
      ...save.inventory.items,
      [itemId]: {
        itemId,
        acquiredAt: existing?.acquiredAt ?? now,
        quantity: (existing?.quantity ?? 0) + 1,
        lastUsedAt: existing?.lastUsedAt ?? null,
      },
    },
  };

  let pet = save.pet;
  let happinessGained = 0;
  if (pet && !item.consumable) {
    const stats = applyStatDelta(pet.stats, { happiness: item.happinessBonus });
    happinessGained = stats.happiness - pet.stats.happiness;
    pet = { ...pet, stats };
  }

  return ok({
    save: {
      ...save,
      pet,
      inventory,
      wallet: { coins: save.wallet.coins - item.price },
      stats: {
        ...save.stats,
        itemsPurchased: save.stats.itemsPurchased + 1,
        coinsSpent: save.stats.coinsSpent + item.price,
      },
    },
    firstPurchase: save.stats.itemsPurchased === 0,
    happinessGained,
  });
}

/** Wear or place an owned item. Replaces whatever was in the same slot. */
export function equipItem(save: GameSave, itemId: string): Result<GameSave, InventoryError> {
  const item = getShopItem(itemId);
  if (!item) return fail('unknown-item');
  if (!item.equipSlot) return fail('not-equippable');
  if (!isOwned(save.inventory, itemId)) return fail('not-owned');
  return ok({
    ...save,
    inventory: { ...save.inventory, equipped: { ...save.inventory.equipped, [item.equipSlot]: itemId } },
  });
}

export function unequipSlot(save: GameSave, slot: EquipSlot): GameSave {
  if (!(slot in save.inventory.equipped)) return save;
  const equipped = { ...save.inventory.equipped };
  delete equipped[slot];
  return { ...save, inventory: { ...save.inventory, equipped } };
}

/** Take off / remove an item if it is the one in its slot. */
export function unequipItem(save: GameSave, itemId: string): GameSave {
  const slot = getShopItem(itemId)?.equipSlot;
  return slot && save.inventory.equipped[slot] === itemId ? unequipSlot(save, slot) : save;
}

export function feedPet(save: GameSave, itemId: string, now: Timestamp): Result<CareOutcome, InventoryError> {
  const item = getShopItem(itemId);
  if (!item) return fail('unknown-item');
  if (item.category !== 'food') return fail('wrong-category');
  if (!save.pet) return fail('no-pet');
  const owned = save.inventory.items[itemId];
  if (!owned || owned.quantity <= 0) return fail('not-owned');

  const items = { ...save.inventory.items };
  if (owned.quantity === 1) delete items[itemId];
  else items[itemId] = { ...owned, quantity: owned.quantity - 1, lastUsedAt: now };

  const stats = applyStatDelta(save.pet.stats, { health: item.healthBonus, happiness: item.happinessBonus });
  return ok({
    save: { ...save, pet: { ...save.pet, stats }, inventory: { ...save.inventory, items } },
    happinessGained: stats.happiness - save.pet.stats.happiness,
    healthGained: stats.health - save.pet.stats.health,
    rewarded: true,
  });
}

export function toyCooldownRemainingMs(save: GameSave, itemId: string, now: Timestamp): number {
  const item = getShopItem(itemId);
  const lastUsedAt = save.inventory.items[itemId]?.lastUsedAt;
  if (!item?.playCooldownMinutes || !lastUsedAt) return 0;
  return Math.max(0, lastUsedAt + item.playCooldownMinutes * MINUTE_MS - now);
}

/**
 * Play with a toy. Playing is always allowed (the reaction is the point), but
 * happiness is only granted once per cooldown window, so it can't be farmed.
 */
export function playWithToy(save: GameSave, itemId: string, now: Timestamp): Result<CareOutcome, InventoryError> {
  const item = getShopItem(itemId);
  if (!item) return fail('unknown-item');
  if (item.category !== 'toy') return fail('wrong-category');
  if (!save.pet) return fail('no-pet');
  const owned = save.inventory.items[itemId];
  if (!owned) return fail('not-owned');

  if (toyCooldownRemainingMs(save, itemId, now) > 0) {
    return ok({ save, happinessGained: 0, healthGained: 0, rewarded: false });
  }
  const stats = applyStatDelta(save.pet.stats, { happiness: item.happinessBonus });
  return ok({
    save: {
      ...save,
      pet: { ...save.pet, stats },
      inventory: { ...save.inventory, items: { ...save.inventory.items, [itemId]: { ...owned, lastUsedAt: now } } },
    },
    happinessGained: stats.happiness - save.pet.stats.happiness,
    healthGained: 0,
    rewarded: true,
  });
}
