import type { Id, Timestamp } from './common';

export type ShopCategory = 'toy' | 'accessory' | 'food' | 'decoration';

export type AccessorySlot = 'head' | 'face' | 'ears' | 'neck';
export type DecorationSlot = 'wall' | 'floorLeft' | 'floorRight';
export type EquipSlot = AccessorySlot | DecorationSlot;

/** Small permanent bonuses from equipped items. Fractions, e.g. 0.03 = +3%. */
export interface PassiveBonus {
  xpPct?: number;
  coinPct?: number;
}

/** Catalog definition. Static data lives in `config/shopCatalog.ts`. */
export interface ShopItem {
  id: Id;
  name: string;
  description: string;
  category: ShopCategory;
  price: number;
  /** Placeholder icon (emoji) until final art exists. */
  icon: string;
  /** Happiness gained on purchase (toys/accessories/decor) or on use (food/toys). */
  happinessBonus: number;
  /** Health gained when eaten (food only). */
  healthBonus: number;
  /** Consumables stack and are used up (food). Others are owned once. */
  consumable: boolean;
  /** Where the item goes when equipped. Absent = not equippable. */
  equipSlot?: EquipSlot;
  passiveBonus?: PassiveBonus;
  /** Toys: minimum minutes between happiness-granting plays. */
  playCooldownMinutes?: number;
}

/** An owned item. */
export interface InventoryItem {
  itemId: Id;
  acquiredAt: Timestamp;
  quantity: number;
  lastUsedAt: Timestamp | null;
}

export interface UserInventory {
  items: Record<Id, InventoryItem>;
  equipped: Partial<Record<EquipSlot, Id>>;
}

/** Catalog item joined with the user's ownership state, for the shop UI. */
export interface ShopListing extends ShopItem {
  owned: boolean;
  quantity: number;
  equipped: boolean;
}
