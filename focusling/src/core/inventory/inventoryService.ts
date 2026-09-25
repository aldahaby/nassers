import { SHOP_ITEMS, getShopItem } from '@/config/shopCatalog';
import { combinePassiveBonuses } from '../economy/economyService';
import { applyStatDelta } from '../pet/petCareService';
import { MINUTE_MS } from '../shared/dates';
import { fail, ok, type Result } from '../shared/result';
import type {
  EquipSlot,
  GameSave,
  PassiveBonus,
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
  | 'on-cooldown'
  | 'no-pet';

export function createInventory(): UserInventory {
  return { items: {}, equipped: {} };
}

export function isOwned(inventory: UserInventory, itemId: string): boolean {
  return (inventory.items[itemId]?.quantity ?? 0) > 0;
}

export function getShopListings(inventory: UserInventory): ShopListing[] {
  return SHOP_ITEMS.map((item) => toListing(item, inventory));
}

export function getOwnedListings(inventory: UserInventory): ShopListing[] {
  return getShopListings(inventory).filter((listing) => listing.owned);
}

function toListing(item: ShopItem, inventory: UserInventory): ShopListing {
  const quantity = inventory.items[item.id]?.quantity ?? 0;
  return {
    ...item,
    owned: quantity > 0,
    quantity,
    equipped: item.equipSlot !== undefined && inventory.equipped[item.equipSlot] === item.id,
  };
}

/** Summed and capped bonuses from everything currently equipped. */
export function getEquippedBonuses(inventory: UserInventory): Required<PassiveBonus> {
  const bonuses = Object.values(inventory.equipped).map((id) => (id ? getShopItem(id)?.passiveBonus : undefined));
  return combinePassiveBonuses(bonuses);
}

export function purchaseItem(save: GameSave, itemId: string, now: Timestamp): Result<GameSave, InventoryError> {
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

  // Food pays out when eaten; everything else gives a little joy on arrival.
  const pet =
    save.pet && !item.consumable
      ? { ...save.pet, stats: applyStatDelta(save.pet.stats, { happiness: item.happinessBonus }) }
      : save.pet;

  return ok({ ...save, pet, inventory, wallet: { coins: save.wallet.coins - item.price } });
}

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
  const equipped = { ...save.inventory.equipped };
  delete equipped[slot];
  return { ...save, inventory: { ...save.inventory, equipped } };
}

export function feedPet(save: GameSave, itemId: string, now: Timestamp): Result<GameSave, InventoryError> {
  const item = getShopItem(itemId);
  if (!item) return fail('unknown-item');
  if (item.category !== 'food') return fail('wrong-category');
  if (!save.pet) return fail('no-pet');
  const owned = save.inventory.items[itemId];
  if (!owned || owned.quantity <= 0) return fail('not-owned');

  const items = { ...save.inventory.items };
  if (owned.quantity === 1) delete items[itemId];
  else items[itemId] = { ...owned, quantity: owned.quantity - 1, lastUsedAt: now };

  return ok({
    ...save,
    pet: {
      ...save.pet,
      stats: applyStatDelta(save.pet.stats, { health: item.healthBonus, happiness: item.happinessBonus }),
    },
    inventory: { ...save.inventory, items },
  });
}

export function toyCooldownRemainingMs(save: GameSave, itemId: string, now: Timestamp): number {
  const item = getShopItem(itemId);
  const lastUsedAt = save.inventory.items[itemId]?.lastUsedAt;
  if (!item?.playCooldownMinutes || !lastUsedAt) return 0;
  return Math.max(0, lastUsedAt + item.playCooldownMinutes * MINUTE_MS - now);
}

export function playWithToy(save: GameSave, itemId: string, now: Timestamp): Result<GameSave, InventoryError> {
  const item = getShopItem(itemId);
  if (!item) return fail('unknown-item');
  if (item.category !== 'toy') return fail('wrong-category');
  if (!save.pet) return fail('no-pet');
  const owned = save.inventory.items[itemId];
  if (!owned) return fail('not-owned');
  if (toyCooldownRemainingMs(save, itemId, now) > 0) return fail('on-cooldown');

  return ok({
    ...save,
    pet: { ...save.pet, stats: applyStatDelta(save.pet.stats, { happiness: item.happinessBonus }) },
    inventory: { ...save.inventory, items: { ...save.inventory.items, [itemId]: { ...owned, lastUsedAt: now } } },
  });
}
