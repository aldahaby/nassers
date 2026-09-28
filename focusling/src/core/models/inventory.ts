import type { Id, Timestamp } from './common';
import type { GrowthStage, PetSpeciesId } from './pet';
import type { GameSave } from './save';
import type { ReactionId } from './style';

export type ShopCategory = 'toy' | 'accessory' | 'food' | 'decoration';

/**
 * One item per slot. Items that would overlap on the pet share a slot (a cap,
 * headphones and crowns are all `head`), so incompatible pairs can't be worn together.
 */
export type AccessorySlot = 'head' | 'face' | 'neck' | 'charm' | 'aura';
/** Fixed placement spots in the pet's room. */
export type DecorationSlot = 'wall' | 'floorLeft' | 'floorRight' | 'floorCenter';
export type EquipSlot = AccessorySlot | DecorationSlot;

/** Small permanent bonuses from equipped items. Fractions, e.g. 0.03 = +3%. */
export interface PassiveBonus {
  xpPct?: number;
  coinPct?: number;
}

/**
 * How an item is obtained. `shop` items are bought with coins; `starter` items
 * are given to everyone; `earned` items unlock from real focus milestones.
 * (Future provenance such as seasonal, creator or licensed capsules would add
 * values here; none involve randomness.)
 */
export type ItemSource = 'shop' | 'starter' | 'earned';

/** A predictable milestone that unlocks an earned item. Progress is always shown. */
export type UnlockRule =
  | { kind: 'sessions'; count: number }
  | { kind: 'focusMinutes'; minutes: number }
  | { kind: 'missions'; count: number }
  | { kind: 'stage'; stage: 'young' | 'adult' | 'evolved' }
  | { kind: 'dayStreak'; days: number };

/** Colours for palette-driven art, so one drawing supports many colourways. */
export interface ItemPalette {
  primary: string;
  secondary: string;
  accent: string;
  /** 0–1, for translucent materials (gummy, jelly, glass). */
  opacity?: number;
}

/**
 * A fit adjustment for one species and/or growth stage, applied around the
 * item's slot anchor. Most items need none: anchors handle every species.
 */
export interface ItemFit {
  species?: PetSpeciesId;
  stage?: GrowthStage;
  /** Pet-space units (the pet is drawn in a 200×200 box). */
  dx?: number;
  dy?: number;
  scale?: number;
  /** Degrees. */
  rotate?: number;
}

/** Where an item's artwork came from, and whether it is final. */
export interface ItemCredit {
  designer: string;
  /** `original`: made in-house, no third-party IP. Licensed items would carry the licence reference. */
  rights: 'original';
  /** `v1`: in-code vector art, fine to ship but slated for an illustrator pass. */
  art: 'v1' | 'final';
}

/** Catalog definition. Static data lives in `config/shopCatalog.ts` and `config/cosmetics.ts`. */
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
  /** Cosmetics are stat-neutral by default; a bonus must be set deliberately. */
  passiveBonus?: PassiveBonus;
  /** Toys: minimum minutes between happiness-granting plays. */
  playCooldownMinutes?: number;
  /** Defaults to `shop`. Only `shop` items can be bought. */
  source?: ItemSource;
  /** Required when `source` is `earned`. */
  unlock?: UnlockRule;
  /** Collection id (see `config/cosmetics.ts`). */
  collection?: string;
  /** Shared artwork key (defaults to the item id), its colourway and optional fit overrides. */
  art?: { key: string; palette?: ItemPalette; fit?: ItemFit[] };
  /**
   * Wearable slots this item can't be worn with (e.g. a long scarf covers where a
   * charm hangs). Equipping either side quietly takes the other off.
   */
  excludes?: AccessorySlot[];
  /** Colourway name shown after the item name, e.g. "Frost". */
  colorway?: string;
  credit?: ItemCredit;
}

/** A saved outfit: what goes in each wearable slot. */
export interface SavedLook {
  id: Id;
  /** Player-chosen name; defaults to "Look 1" etc. */
  name?: string;
  equipped: Partial<Record<AccessorySlot, Id>>;
  savedAt: Timestamp;
}

/** Wardrobe state that isn't ownership. */
export interface CosmeticsState {
  /** Unlocked or bought items not yet seen in the wardrobe ("New" badge). */
  newItemIds: Id[];
  /** Up to `COSMETICS.maxLooks` saved outfits; `null` = empty slot. */
  looks: (SavedLook | null)[];
  /** Collections whose completion has been recorded (and rewarded) once. */
  completedCollections: string[];
  reactions: {
    unlocked: ReactionId[];
    /** The favourite the pet uses on its own (tap, session end, completion). */
    equipped: ReactionId | null;
  };
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
