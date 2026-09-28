import type { ItemCredit, ItemPalette, UnlockRule } from '@/core/models';
import { ECONOMY } from './economy';
import type { CatalogItem } from './shopCatalog';

/**
 * Cosmetics: collections, colourways and earned unlocks.
 *
 * Design rules (docs/COSMETICS.md):
 * - Cosmetics are stat-neutral: wear what you like, not what's efficient.
 * - Earned items unlock from visible, predictable focus milestones. No random
 *   drops, no rarity ladder, no countdowns, no real-money purchases.
 * - One drawing (`art.key`) + a palette = a colourway. Adding an item is data only
 *   when its drawing already exists.
 */

export const COSMETICS = {
  /** Saved outfit slots in the wardrobe. */
  maxLooks: 3,
} as const;

export interface CollectionDef {
  id: string;
  name: string;
  tagline: string;
}

export const COLLECTIONS: Record<string, CollectionDef> = {
  'focus-club': {
    id: 'focus-club',
    name: 'Focus Club',
    tagline: 'Cute streetwear for a cloud that gets things done.',
  },
};

/**
 * Colourway palettes. Seasonal references (2026: frosty blue, jade, plum,
 * wasabi, persimmon) are inputs, not the permanent brand.
 */
export const COLORWAYS = {
  frost: { primary: '#A6D4FA', secondary: '#4E95D0', accent: '#FFFFFF', opacity: 0.78 },
  jade: { primary: '#B9D8C2', secondary: '#6FA888', accent: '#F2FFF6', opacity: 0.74 },
  persimmon: { primary: '#FF9C7A', secondary: '#FF5C34', accent: '#FFE3D8', opacity: 0.74 },
  wasabi: { primary: '#EEF38A', secondary: '#B9C23A', accent: '#FFFFE6', opacity: 0.76 },
  plum: { primary: '#5B3A4E', secondary: '#351E28', accent: '#F7C6DD' },
  cloud: { primary: '#F4F7FF', secondary: '#AFC4E8', accent: '#7B5CFF' },
  berry: { primary: '#FF6FA3', secondary: '#D94680', accent: '#FFE0EC' },
  sunny: { primary: '#FFD166', secondary: '#E8A93A', accent: '#FFF6D6' },
  lilac: { primary: '#C9B8FF', secondary: '#7B5CFF', accent: '#FFFFFF' },
} satisfies Record<string, ItemPalette>;

const ORIGINAL_V1: ItemCredit = { designer: 'Focusling', rights: 'original', art: 'v1' };

interface CosmeticSpec {
  id: string;
  name: string;
  description: string;
  slot: 'head' | 'face' | 'neck' | 'charm' | 'aura';
  artKey: string;
  palette?: ItemPalette;
  colorway?: string;
  /** Earned milestone, `starter`, or a coin price. */
  obtain: UnlockRule | 'starter' | { price: number };
}

function cosmetic(spec: CosmeticSpec): CatalogItem {
  const obtain = spec.obtain;
  const source = obtain === 'starter' ? 'starter' : 'price' in obtain ? 'shop' : 'earned';
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    category: 'accessory',
    price: typeof obtain === 'object' && 'price' in obtain ? Math.max(1, Math.round(obtain.price * ECONOMY.priceMultiplier)) : 0,
    icon: '',
    happinessBonus: 3,
    healthBonus: 0,
    consumable: false,
    equipSlot: spec.slot,
    source,
    unlock: source === 'earned' ? (obtain as UnlockRule) : undefined,
    collection: 'focus-club',
    art: { key: spec.artKey, palette: spec.palette },
    colorway: spec.colorway,
    credit: ORIGINAL_V1,
  };
}

/**
 * Focus Club: the first cosmetic collection. The earned path is ordered so a new
 * user unlocks something on their first finished session, then roughly every
 * few sessions, with the best-looking pieces tied to bigger milestones.
 */
export const FOCUS_CLUB_ITEMS: readonly CatalogItem[] = [
  cosmetic({
    id: 'fc-charm-star',
    name: 'Mood Charm',
    colorway: 'Star',
    description: 'A little star that dangles in front. Every Focusling starts with one.',
    slot: 'charm',
    artKey: 'mood-charm-star',
    palette: COLORWAYS.sunny,
    obtain: 'starter',
  }),
  cosmetic({
    id: 'fc-visor-frost',
    name: 'Gummy Visor',
    colorway: 'Frost',
    description: 'Oversized, translucent and very cool. Earned on your first finished session.',
    slot: 'face',
    artKey: 'gummy-visor',
    palette: COLORWAYS.frost,
    obtain: { kind: 'sessions', count: 1 },
  }),
  cosmetic({
    id: 'fc-charm-heart',
    name: 'Mood Charm',
    colorway: 'Heart',
    description: 'A squishy heart charm.',
    slot: 'charm',
    artKey: 'mood-charm-heart',
    palette: COLORWAYS.berry,
    obtain: { kind: 'sessions', count: 3 },
  }),
  cosmetic({
    id: 'fc-cap-plum',
    name: 'Cloud Cap',
    colorway: 'Plum',
    description: 'An oversized cap with a stitched cloud. Two hours of focus earns it.',
    slot: 'head',
    artKey: 'cloud-cap',
    palette: COLORWAYS.plum,
    obtain: { kind: 'focusMinutes', minutes: 120 },
  }),
  cosmetic({
    id: 'fc-aura-sparkle',
    name: 'Sparkle Aura',
    description: 'Soft sparkles that follow your Focusling around. Unlocks when it first grows up.',
    slot: 'aura',
    artKey: 'aura-sparkle',
    palette: COLORWAYS.sunny,
    obtain: { kind: 'stage', stage: 'young' },
  }),
  cosmetic({
    id: 'fc-harness',
    name: 'Charm Harness',
    description: 'A little collar covered in pins. Earned by finishing five missions.',
    slot: 'neck',
    artKey: 'charm-harness',
    palette: COLORWAYS.lilac,
    obtain: { kind: 'missions', count: 5 },
  }),
  cosmetic({
    id: 'fc-aura-sleepy',
    name: 'Sleepy Stars',
    description: 'Tiny dozing stars. For focusing three days in a row.',
    slot: 'aura',
    artKey: 'aura-sleepy-stars',
    palette: COLORWAYS.lilac,
    obtain: { kind: 'dayStreak', days: 3 },
  }),
  cosmetic({
    id: 'fc-visor-jade',
    name: 'Gummy Visor',
    colorway: 'Jade',
    description: 'The visor in calm jade. Ten finished sessions.',
    slot: 'face',
    artKey: 'gummy-visor',
    palette: COLORWAYS.jade,
    obtain: { kind: 'sessions', count: 10 },
  }),
  cosmetic({
    id: 'fc-charm-bolt',
    name: 'Mood Charm',
    colorway: 'Bolt',
    description: 'A zippy lightning charm. Five hours of focus.',
    slot: 'charm',
    artKey: 'mood-charm-bolt',
    palette: COLORWAYS.wasabi,
    obtain: { kind: 'focusMinutes', minutes: 300 },
  }),
  cosmetic({
    id: 'fc-aura-hearts',
    name: 'Pixel Hearts',
    description: 'Blocky little hearts. Ten hours of focus.',
    slot: 'aura',
    artKey: 'aura-pixel-hearts',
    palette: COLORWAYS.berry,
    obtain: { kind: 'focusMinutes', minutes: 600 },
  }),
  cosmetic({
    id: 'fc-cap-frost',
    name: 'Cloud Cap',
    colorway: 'Frost',
    description: 'The cap in frosty blue. Twenty finished sessions.',
    slot: 'head',
    artKey: 'cloud-cap',
    palette: COLORWAYS.frost,
    obtain: { kind: 'sessions', count: 20 },
  }),
  // Coin colourways: bought with coins earned by focusing (never real money).
  cosmetic({
    id: 'fc-visor-persimmon',
    name: 'Gummy Visor',
    colorway: 'Persimmon',
    description: 'The visor in warm orange-red.',
    slot: 'face',
    artKey: 'gummy-visor',
    palette: COLORWAYS.persimmon,
    obtain: { price: 36 },
  }),
  cosmetic({
    id: 'fc-visor-wasabi',
    name: 'Gummy Visor',
    colorway: 'Wasabi',
    description: 'The visor in electric yellow-green.',
    slot: 'face',
    artKey: 'gummy-visor',
    palette: COLORWAYS.wasabi,
    obtain: { price: 36 },
  }),
  cosmetic({
    id: 'fc-charm-planet',
    name: 'Mood Charm',
    colorway: 'Planet',
    description: 'A tiny ringed planet.',
    slot: 'charm',
    artKey: 'mood-charm-planet',
    palette: COLORWAYS.lilac,
    obtain: { price: 28 },
  }),
];

/** Display name with colourway, e.g. "Gummy Visor · Frost". */
export function cosmeticName(item: { name: string; colorway?: string }): string {
  return item.colorway ? `${item.name} · ${item.colorway}` : item.name;
}
