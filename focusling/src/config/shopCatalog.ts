import type { AccessorySlot, DecorationSlot, EquipSlot, ShopCategory, ShopItem } from '@/core/models';
import { ECONOMY } from './economy';

/**
 * PRICE BANDS (base coins, before `ECONOMY.priceMultiplier`)
 *
 * Earnings reference: 15 min ≈ 6 coins, 30 min ≈ 10, 60 min ≈ 18, plus 20 starter coins.
 *
 *   Food / treats ........ 4–12    affordable from one short session
 *   Basic toys ........... 12–20   one or two sessions
 *   Nicer toys ........... 20–30   two or three sessions
 *   Basic accessories .... 20–35   two or three sessions
 *   Nicer accessories .... 40–70   several sessions
 *   Room decorations ..... 30–80   several sessions
 *   Aspirational ......... 100+    a real goal (a week or two of regular focus)
 *
 * `balance.test.ts` checks every item stays inside its band.
 */
const price = (base: number) => Math.max(1, Math.round(base * ECONOMY.priceMultiplier));

/** How a toy plays out on the pet screen. Each maps to its own animation in the UI. */
export type ToyPlayStyle = 'bounce' | 'hug' | 'spin' | 'bubbles';

export interface CatalogItem extends ShopItem {
  /** Toys only. */
  playStyle?: ToyPlayStyle;
}

/**
 * The shop catalog. Every price, bonus, cooldown and slot is defined here.
 * Artwork is keyed by id in `ui/items/ItemArt.tsx` (icons), `ui/pet/accessories.tsx`
 * (worn) and `ui/room/decorations.tsx` (placed).
 */
export const SHOP_ITEMS: readonly CatalogItem[] = [
  // ── Accessories: cosmetic, worn on the pet, small passive XP bonus ─────────
  {
    id: 'acc-bow-tie',
    name: 'Dapper Bow',
    description: 'For formal focus occasions.',
    category: 'accessory',
    price: price(22),
    icon: '🎀',
    happinessBonus: 4,
    healthBonus: 0,
    consumable: false,
    equipSlot: 'neck',
    passiveBonus: { xpPct: 0.01 },
  },
  {
    id: 'acc-cap',
    name: 'Sporty Cap',
    description: 'Keeps the glare off focused eyes.',
    category: 'accessory',
    price: price(28),
    icon: '🧢',
    happinessBonus: 5,
    healthBonus: 0,
    consumable: false,
    equipSlot: 'head',
    passiveBonus: { xpPct: 0.02 },
  },
  {
    id: 'acc-sunglasses',
    name: 'Cool Shades',
    description: 'Too cool for doomscrolling.',
    category: 'accessory',
    price: price(32),
    icon: '🕶️',
    happinessBonus: 5,
    healthBonus: 0,
    consumable: false,
    equipSlot: 'face',
    passiveBonus: { xpPct: 0.02 },
  },
  {
    id: 'acc-flower-crown',
    name: 'Flower Crown',
    description: 'Fresh blooms for a fresh mind.',
    category: 'accessory',
    price: price(50),
    icon: '🌼',
    happinessBonus: 6,
    healthBonus: 0,
    consumable: false,
    equipSlot: 'head',
    passiveBonus: { xpPct: 0.03 },
  },
  {
    id: 'acc-headphones',
    name: 'Focus Headphones',
    description: 'Noise-cancelling, distraction-cancelling.',
    category: 'accessory',
    price: price(65),
    icon: '🎧',
    happinessBonus: 6,
    healthBonus: 0,
    consumable: false,
    equipSlot: 'head',
    passiveBonus: { xpPct: 0.03 },
  },
  {
    id: 'acc-golden-crown',
    name: 'Golden Crown',
    description: 'For true champions of focus. Sparkles included.',
    category: 'accessory',
    price: price(150),
    icon: '👑',
    happinessBonus: 10,
    healthBonus: 0,
    consumable: false,
    equipSlot: 'head',
    passiveBonus: { xpPct: 0.05 },
  },

  // ── Toys: interactive, reusable, happiness on a per-toy cooldown ───────────
  {
    id: 'toy-bouncy-ball',
    name: 'Bouncy Ball',
    description: 'Boing! A classic for burning off energy.',
    category: 'toy',
    price: price(15),
    icon: '🔴',
    happinessBonus: 4,
    healthBonus: 0,
    consumable: false,
    playCooldownMinutes: 30,
    playStyle: 'bounce',
  },
  {
    id: 'toy-squeaky-star',
    name: 'Squeaky Star',
    description: 'Squeaks and twirls. Endlessly funny.',
    category: 'toy',
    price: price(18),
    icon: '⭐',
    happinessBonus: 4,
    healthBonus: 0,
    consumable: false,
    playCooldownMinutes: 30,
    playStyle: 'spin',
  },
  {
    id: 'toy-plush-bear',
    name: 'Plush Bear',
    description: 'A squishy friend for big hugs.',
    category: 'toy',
    price: price(24),
    icon: '🧸',
    happinessBonus: 6,
    healthBonus: 0,
    consumable: false,
    playCooldownMinutes: 60,
    playStyle: 'hug',
  },
  {
    id: 'toy-bubble-wand',
    name: 'Bubble Wand',
    description: 'A flurry of shimmering bubbles to chase.',
    category: 'toy',
    price: price(30),
    icon: '🫧',
    happinessBonus: 6,
    healthBonus: 0,
    consumable: false,
    playCooldownMinutes: 60,
    playStyle: 'bubbles',
  },

  // ── Food: consumable, optional care ─────────────────────────────────────────
  {
    id: 'food-berry-snack',
    name: 'Berry Snack',
    description: 'A quick, juicy pick-me-up.',
    category: 'food',
    price: price(5),
    icon: '🫐',
    happinessBonus: 3,
    healthBonus: 6,
    consumable: true,
  },
  {
    id: 'food-cookie',
    name: 'Oat Cookie',
    description: 'Crunchy, warm and just a little sweet.',
    category: 'food',
    price: price(6),
    icon: '🍪',
    happinessBonus: 6,
    healthBonus: 2,
    consumable: true,
  },
  {
    id: 'food-fruit-bowl',
    name: 'Fruit Bowl',
    description: 'Colourful, fresh and very nourishing.',
    category: 'food',
    price: price(8),
    icon: '🥗',
    happinessBonus: 3,
    healthBonus: 12,
    consumable: true,
  },
  {
    id: 'food-honey-cake',
    name: 'Honey Cake',
    description: 'A special treat for a job well done.',
    category: 'food',
    price: price(12),
    icon: '🍰',
    happinessBonus: 10,
    healthBonus: 6,
    consumable: true,
  },

  // ── Room: cosmetic, placed in fixed slots, small passive coin bonus ────────
  {
    id: 'decor-potted-plant',
    name: 'Potted Plant',
    description: 'A little green makes everything calmer.',
    category: 'decoration',
    price: price(35),
    icon: '🪴',
    happinessBonus: 4,
    healthBonus: 0,
    consumable: false,
    equipSlot: 'floorLeft',
    passiveBonus: { coinPct: 0.02 },
  },
  {
    id: 'decor-star-garland',
    name: 'Star Garland',
    description: 'Twinkly stars strung across the wall.',
    category: 'decoration',
    price: price(40),
    icon: '✨',
    happinessBonus: 4,
    healthBonus: 0,
    consumable: false,
    equipSlot: 'wall',
    passiveBonus: { coinPct: 0.02 },
  },
  {
    id: 'decor-glow-lamp',
    name: 'Glow Lamp',
    description: 'A warm light for late-night focus.',
    category: 'decoration',
    price: price(45),
    icon: '💡',
    happinessBonus: 5,
    healthBonus: 0,
    consumable: false,
    equipSlot: 'floorRight',
    passiveBonus: { coinPct: 0.02 },
  },
  {
    id: 'decor-cozy-rug',
    name: 'Cozy Rug',
    description: 'A soft round rug for happy feet.',
    category: 'decoration',
    price: price(50),
    icon: '🟣',
    happinessBonus: 5,
    healthBonus: 0,
    consumable: false,
    equipSlot: 'floorCenter',
    passiveBonus: { coinPct: 0.03 },
  },
  {
    id: 'decor-beanbag',
    name: 'Comfy Beanbag',
    description: 'The ultimate flop spot after a long session.',
    category: 'decoration',
    price: price(70),
    icon: '🛋️',
    happinessBonus: 7,
    healthBonus: 0,
    consumable: false,
    equipSlot: 'floorRight',
    passiveBonus: { coinPct: 0.03 },
  },
  {
    id: 'decor-aquarium',
    name: 'Tiny Aquarium',
    description: 'Two little fish who cheer on every session.',
    category: 'decoration',
    price: price(120),
    icon: '🐠',
    happinessBonus: 10,
    healthBonus: 0,
    consumable: false,
    equipSlot: 'floorLeft',
    passiveBonus: { coinPct: 0.04 },
  },
];

export const SHOP_CATEGORIES: readonly { id: ShopCategory; label: string }[] = [
  { id: 'accessory', label: 'Accessories' },
  { id: 'toy', label: 'Toys' },
  { id: 'food', label: 'Food' },
  { id: 'decoration', label: 'Room' },
];

/** Player-facing names for equipment slots. */
export const ACCESSORY_SLOTS: Record<AccessorySlot, string> = {
  head: 'Head',
  face: 'Face',
  neck: 'Neck',
};

export const DECORATION_SLOTS: Record<DecorationSlot, string> = {
  wall: 'Wall',
  floorLeft: 'Left floor',
  floorCenter: 'Centre rug',
  floorRight: 'Right floor',
};

export function slotLabel(slot: EquipSlot): string {
  return slot in ACCESSORY_SLOTS
    ? ACCESSORY_SLOTS[slot as AccessorySlot]
    : DECORATION_SLOTS[slot as DecorationSlot];
}

const ITEMS_BY_ID: ReadonlyMap<string, CatalogItem> = new Map(SHOP_ITEMS.map((item) => [item.id, item]));

export function getShopItem(id: string): CatalogItem | undefined {
  return ITEMS_BY_ID.get(id);
}
