import type { Id, Timestamp } from './common';
import type { GameSave } from './save';

export type ShopCategory = 'toy' | 'accessory' | 'food' | 'decoration';

/**
 * One item per slot. Items that would overlap on the pet share a slot (a cap,
 * headphones and crowns are all `head`), so incompatible pairs can't be worn together.
 */
export type AccessorySlot = 'head' | 'face' | 'neck';
/** Fixed placement spots in the pet's room. */
export type DecorationSlot = 'wall' | 'floorLeft' | 'floorRight' | 'floorCenter';
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
  /** Emoji fallback, used only if an item has no vector art in `ui/items`. */
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

/** Result of buying an item. */
export interface PurchaseOutcome {
  save: GameSave;
  /** True only for the player's first-ever purchase. */
  firstPurchase: boolean;
  happinessGained: number;
}

/** Result of playing with a toy or feeding the pet. */
export interface CareOutcome {
  save: GameSave;
  happinessGained: number;
  healthGained: number;
  /**
   * False when a toy was played with during its cooldown: the pet still plays
   * and reacts, it just doesn't grant stats again yet.
   */
  rewarded: boolean;
}

/** Catalog item joined with the user's ownership state, for the shop UI. */
export interface ShopListing extends ShopItem {
  owned: boolean;
  quantity: number;
  equipped: boolean;
}
