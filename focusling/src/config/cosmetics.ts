import type { AccessorySlot, ItemCredit, ItemFit, ItemPalette, MaterialFamily, UnlockRule } from '@/core/models';
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

/**
 * The material each drawing is rendered in (the Materials Bible,
 * docs/ART_DIRECTION.md). One drawing = one material, so every colourway
 * shares it. The art layer uses the same recipe for every item of a family.
 */
export const ART_MATERIAL: Record<string, MaterialFamily> = {
  // Classic shop pieces
  'acc-cap': 'fabric',
  'acc-sunglasses': 'jelly',
  'acc-headphones': 'plastic',
  'acc-flower-crown': 'fabric',
  'acc-golden-crown': 'chrome',
  'acc-bow-tie': 'fabric',
  // Focus Club
  'gummy-visor': 'jelly',
  'cloud-cap': 'fabric',
  'charm-harness': 'fabric',
  'mood-charm-star': 'plastic',
  'mood-charm-heart': 'jelly',
  'mood-charm-bolt': 'plastic',
  'mood-charm-planet': 'pearl',
  // Midnight Arcade
  'pixel-beanie': 'knit',
  'scanline-visor': 'jelly',
  'arcade-headset': 'plastic',
  'tech-collar': 'chrome',
  'dpad-charm': 'plastic',
  // Dreamwave
  'heart-shades': 'jelly',
  'moon-charm': 'pearl',
  'crescent-headband': 'holo',
  'cloud-beret': 'fuzzy',
  'pearl-collar': 'pearl',
  // Cloud Racer
  'racing-cap': 'fabric',
  'aero-shades': 'holo',
  'racing-scarf': 'fabric',
  'winner-rosette': 'fabric',
  'racer-goggles': 'chrome',
  // Moss Club
  'leaf-beanie': 'knit',
  'acorn-specs': 'wood',
  'moss-scarf': 'fuzzy',
  'acorn-satchel': 'fabric',
  'toadstool-charm': 'wood',
  'ladybug-pin': 'plastic',
};

/** Player-facing material names (shown on item details). */
export const MATERIAL_LABEL: Record<MaterialFamily, string> = {
  jelly: 'Jelly',
  chrome: 'Chrome',
  pearl: 'Pearl',
  fabric: 'Fabric',
  knit: 'Knit',
  plastic: 'Glossy plastic',
  holo: 'Holographic',
  fuzzy: 'Fuzzy',
  wood: 'Wood',
};

const ORIGINAL_V1: ItemCredit = { designer: 'Focusling', rights: 'original', art: 'v1' };

interface CosmeticSpec {
  id: string;
  name: string;
  description: string;
  slot: AccessorySlot;
  artKey: string;
  palette?: ItemPalette;
  colorway?: string;
  /** Earned milestone, `starter`, or a coin price. */
  obtain: UnlockRule | 'starter' | { price: number };
  /** Defaults to Focus Club. */
  collection?: string;
  fit?: ItemFit[];
  excludes?: AccessorySlot[];
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
    collection: spec.collection ?? 'focus-club',
    art: { key: spec.artKey, palette: spec.palette, fit: spec.fit, material: ART_MATERIAL[spec.artKey] },
    colorway: spec.colorway,
    excludes: spec.excludes,
    credit: ORIGINAL_V1,
  };
}

/** A matching room accent for a collection: a Shop decoration, not part of completion. */
function roomAccent(spec: { id: string; name: string; description: string; slot: 'wall' | 'floorLeft' | 'floorRight'; price: number; collection: string }): CatalogItem {
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    category: 'decoration',
    price: Math.max(1, Math.round(spec.price * ECONOMY.priceMultiplier)),
    icon: '',
    happinessBonus: 6,
    healthBonus: 0,
    consumable: false,
    equipSlot: spec.slot,
    collection: spec.collection,
    credit: ORIGINAL_V1,
  };
}

/**
 * Fit overrides, shared by every colourway of a drawing. Babies have bigger eyes
 * (PetFace scales them ~1.18×), so eyewear opens up a little at that stage and
 * brimmed caps ride a little higher. Everything else fits from the anatomy
 * anchors alone; crest handling (sprout, flame) is in `ui/pet/crest.tsx`.
 */
const FIT = {
  babyEyewear: [{ stage: 'baby', scale: 1.08 }],
  babyHearts: [{ stage: 'baby', scale: 1.12, dy: 1 }],
  babyBrim: [{ stage: 'baby', dy: -2 }],
} satisfies Record<string, ItemFit[]>;

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
    fit: FIT.babyBrim,
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
    fit: FIT.babyBrim,
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

// ── Midnight Arcade: retro arcade nights × streetwear ─────────────────────────

const MA = {
  navy: { primary: '#1C2143', secondary: '#8B5CFF', accent: '#5CF0FF' },
  plum: { primary: '#3B2150', secondary: '#5CF0FF', accent: '#FF4FD8' },
  cyanGlass: { primary: '#5CF0FF', secondary: '#1C2143', accent: '#FFFFFF', opacity: 0.5 },
  pinkGlass: { primary: '#FF4FD8', secondary: '#3B2150', accent: '#FFFFFF', opacity: 0.5 },
  violet: { primary: '#8B5CFF', secondary: '#1C2143', accent: '#5CF0FF' },
  burst: { primary: '#5CF0FF', secondary: '#8B5CFF', accent: '#FF4FD8' },
} satisfies Record<string, ItemPalette>;

export const MIDNIGHT_ARCADE_ITEMS: readonly CatalogItem[] = [
  cosmetic({ id: 'ma-beanie', name: 'Pixel Beanie', description: 'A slouchy beanie with a pixel pom and a glowing trim.', slot: 'head', artKey: 'pixel-beanie', palette: MA.navy, collection: 'midnight-arcade', obtain: { kind: 'sessions', count: 5 } }),
  cosmetic({ id: 'ma-visor', name: 'Scanline Visor', description: 'An angular glass visor with soft scanlines.', slot: 'face', artKey: 'scanline-visor', fit: FIT.babyEyewear, palette: MA.cyanGlass, colorway: 'Ice', collection: 'midnight-arcade', obtain: { kind: 'focusMinutes', minutes: 180 } }),
  cosmetic({ id: 'ma-charm', name: 'D-Pad Charm', description: 'A tiny game-pad charm with glowing buttons.', slot: 'charm', artKey: 'dpad-charm', palette: MA.violet, collection: 'midnight-arcade', obtain: { kind: 'missions', count: 3 } }),
  cosmetic({ id: 'ma-collar', name: 'Tech Collar', description: 'A sleek collar with a row of light-up pixels.', slot: 'neck', artKey: 'tech-collar', palette: MA.navy, collection: 'midnight-arcade', obtain: { kind: 'dayStreak', days: 5 } }),
  cosmetic({ id: 'ma-aura', name: 'Pixel Burst', description: 'Chunky pixels and plus-signs blinking around.', slot: 'aura', artKey: 'aura-pixel-burst', palette: MA.burst, collection: 'midnight-arcade', obtain: { kind: 'focusMinutes', minutes: 480 } }),
  cosmetic({ id: 'ma-headset', name: 'Arcade Headset', description: 'Chunky headphones with a little mic, for the high-score run.', slot: 'head', artKey: 'arcade-headset', palette: MA.plum, collection: 'midnight-arcade', obtain: { price: 60 } }),
  cosmetic({ id: 'ma-visor-pink', name: 'Scanline Visor', description: 'The visor in neon pink.', slot: 'face', artKey: 'scanline-visor', fit: FIT.babyEyewear, palette: MA.pinkGlass, colorway: 'Neon', collection: 'midnight-arcade', obtain: { price: 40 } }),
];

// ── Dreamwave: dreamy Y2K × celestial soft-pop ────────────────────────────────

const DW = {
  lilac: { primary: '#CDB8FF', secondary: '#9C82E8', accent: '#FFF6EE' },
  pearl: { primary: '#FFF6EE', secondary: '#CDB8FF', accent: '#FFC4E1' },
  pinkGlass: { primary: '#FFB3D6', secondary: '#E07BB0', accent: '#FFFFFF', opacity: 0.62 },
  blueGlass: { primary: '#A9DAFF', secondary: '#6FA9DE', accent: '#FFFFFF', opacity: 0.62 },
  moon: { primary: '#FFD867', secondary: '#7E62D6', accent: '#FF9CC8' },
  dream: { primary: '#CDB8FF', secondary: '#BDE4FF', accent: '#FFC4E1' },
} satisfies Record<string, ItemPalette>;

export const DREAMWAVE_ITEMS: readonly CatalogItem[] = [
  cosmetic({ id: 'dw-shades', name: 'Heart Shades', description: 'Glossy heart-shaped glasses. Eyes still show through.', slot: 'face', artKey: 'heart-shades', fit: FIT.babyHearts, palette: DW.pinkGlass, colorway: 'Pink', collection: 'dreamwave', obtain: { kind: 'sessions', count: 8 } }),
  cosmetic({ id: 'dw-charm', name: 'Moon Charm', description: 'A crescent moon with a little star.', slot: 'charm', artKey: 'moon-charm', palette: DW.moon, collection: 'dreamwave', obtain: { kind: 'focusMinutes', minutes: 240 } }),
  cosmetic({ id: 'dw-headband', name: 'Crescent Headband', description: 'A headband with a bobbing moon and stars.', slot: 'head', artKey: 'crescent-headband', palette: DW.lilac, collection: 'dreamwave', obtain: { kind: 'missions', count: 7 } }),
  cosmetic({ id: 'dw-aura', name: 'Dream Aura', description: 'Pastel stars and cloud puffs drifting by.', slot: 'aura', artKey: 'aura-dream', palette: DW.dream, collection: 'dreamwave', obtain: { kind: 'dayStreak', days: 7 } }),
  cosmetic({ id: 'dw-beret', name: 'Cloud Beret', description: 'A pearly beret, soft as a cloud. Unlocks when your Focusling is grown up.', slot: 'head', artKey: 'cloud-beret', palette: DW.pearl, collection: 'dreamwave', obtain: { kind: 'stage', stage: 'adult' } }),
  cosmetic({ id: 'dw-pearls', name: 'Pearl Collar', description: 'A string of pearls with a satin bow.', slot: 'neck', artKey: 'pearl-collar', palette: DW.pearl, collection: 'dreamwave', obtain: { price: 45 } }),
  cosmetic({ id: 'dw-shades-blue', name: 'Heart Shades', description: 'The heart shades in baby blue.', slot: 'face', artKey: 'heart-shades', fit: FIT.babyHearts, palette: DW.blueGlass, colorway: 'Baby Blue', collection: 'dreamwave', obtain: { price: 40 } }),
];

// ── Cloud Racer: original motorsport style (no real teams, brands or liveries) ─

const CR = {
  cream: { primary: '#FFF3DC', secondary: '#E5402B', accent: '#2E5BD6' },
  cobalt: { primary: '#2E5BD6', secondary: '#FFF3DC', accent: '#2A2A33' },
  goggles: { primary: '#2A2A33', secondary: '#FF8A3D', accent: '#FFF3DC', opacity: 0.7 },
  aero: { primary: '#FF8A3D', secondary: '#2A2A33', accent: '#FFF3DC', opacity: 0.66 },
  scarf: { primary: '#E5402B', secondary: '#FFF3DC', accent: '#2A2A33' },
  rosette: { primary: '#FF8A3D', secondary: '#E5402B', accent: '#FFF3DC' },
  speed: { primary: '#FFF3DC', secondary: '#FF8A3D', accent: '#2E5BD6' },
} satisfies Record<string, ItemPalette>;

export const CLOUD_RACER_ITEMS: readonly CatalogItem[] = [
  cosmetic({ id: 'cr-cap', name: 'Racing Cap', description: 'A cream racing cap with a checker panel and a winged-cloud patch.', slot: 'head', artKey: 'racing-cap', fit: FIT.babyBrim, palette: CR.cream, colorway: 'Cream', collection: 'cloud-racer', obtain: { kind: 'sessions', count: 12 } }),
  cosmetic({ id: 'cr-shades', name: 'Aero Shades', description: 'Wraparound shades with a speed stripe. Tinted, not blacked out.', slot: 'face', artKey: 'aero-shades', fit: FIT.babyEyewear, palette: CR.aero, collection: 'cloud-racer', obtain: { kind: 'focusMinutes', minutes: 360 } }),
  cosmetic({ id: 'cr-scarf', name: 'Racing Scarf', description: 'A wind-blown scarf with checker ends, knotted to one side so a charm still fits.', slot: 'neck', artKey: 'racing-scarf', palette: CR.scarf, collection: 'cloud-racer', obtain: { kind: 'missions', count: 10 } }),
  cosmetic({ id: 'cr-badge', name: 'Winner’s Rosette', description: 'A ribbon rosette with a star. No numbers, just a win.', slot: 'charm', artKey: 'winner-rosette', palette: CR.rosette, collection: 'cloud-racer', obtain: { kind: 'sessions', count: 25 } }),
  cosmetic({ id: 'cr-aura', name: 'Speed Lines', description: 'Streaks and little dust puffs, like you just pulled in.', slot: 'aura', artKey: 'aura-speed', palette: CR.speed, collection: 'cloud-racer', obtain: { kind: 'focusMinutes', minutes: 900 } }),
  cosmetic({ id: 'cr-goggles', name: 'Racer Goggles', description: 'Retro goggles pushed up on the head.', slot: 'head', artKey: 'racer-goggles', palette: CR.goggles, collection: 'cloud-racer', obtain: { price: 70 } }),
  cosmetic({ id: 'cr-cap-cobalt', name: 'Racing Cap', description: 'The racing cap in cobalt.', slot: 'head', artKey: 'racing-cap', fit: FIT.babyBrim, palette: CR.cobalt, colorway: 'Cobalt', collection: 'cloud-racer', obtain: { price: 45 } }),
];

// ── Moss Club: forest streetwear × a tiny magical creature ───────────────────

const MC = {
  moss: { primary: '#6E9B4E', secondary: '#2F4A2E', accent: '#F4E9D2' },
  amber: { primary: '#E9B44C', secondary: '#A9744F', accent: '#FFF4D6', opacity: 0.55 },
  fuzz: { primary: '#8AA65A', secondary: '#4E6B34', accent: '#F4E9D2' },
  satchel: { primary: '#A9744F', secondary: '#6B4630', accent: '#F4E9D2' },
  toadstool: { primary: '#C8553D', secondary: '#F4E9D2', accent: '#A9744F' },
  ladybug: { primary: '#D8402F', secondary: '#2A2A33', accent: '#FFFFFF' },
  firefly: { primary: '#E9F27A', secondary: '#6E9B4E', accent: '#FFFBE0' },
} satisfies Record<string, ItemPalette>;

export const MOSS_CLUB_ITEMS: readonly CatalogItem[] = [
  cosmetic({ id: 'mc-beanie', name: 'Leaf-Knit Beanie', description: 'A cosy knit beanie with a leaf sewn on. It leaves room for a sprout or a flame.', slot: 'head', artKey: 'leaf-beanie', palette: MC.moss, collection: 'moss-club', obtain: { kind: 'sessions', count: 15 } }),
  cosmetic({ id: 'mc-specs', name: 'Acorn Specs', description: 'Round wooden frames with warm amber lenses. Eyes still shine through.', slot: 'face', artKey: 'acorn-specs', fit: FIT.babyEyewear, palette: MC.amber, collection: 'moss-club', obtain: { kind: 'focusMinutes', minutes: 720 } }),
  cosmetic({ id: 'mc-scarf', name: 'Moss Scarf', description: 'A fuzzy scarf with one tail longer than the other.', slot: 'neck', artKey: 'moss-scarf', palette: MC.fuzz, collection: 'moss-club', obtain: { kind: 'missions', count: 12 } }),
  cosmetic({ id: 'mc-satchel', name: 'Acorn Satchel', description: 'A tiny satchel on a cross-body strap. The strap sits where a charm would hang.', slot: 'neck', artKey: 'acorn-satchel', palette: MC.satchel, collection: 'moss-club', excludes: ['charm'], obtain: { price: 55 } }),
  cosmetic({ id: 'mc-toadstool', name: 'Toadstool Charm', description: 'A little carved toadstool on a cord.', slot: 'charm', artKey: 'toadstool-charm', palette: MC.toadstool, collection: 'moss-club', obtain: { kind: 'dayStreak', days: 10 } }),
  cosmetic({ id: 'mc-ladybug', name: 'Ladybug Pin', description: 'A shiny ladybug pinned just off-centre.', slot: 'charm', artKey: 'ladybug-pin', palette: MC.ladybug, collection: 'moss-club', obtain: { price: 35 } }),
  cosmetic({ id: 'mc-aura', name: 'Firefly Glow', description: 'A few fireflies drifting on one side, like a quiet evening.', slot: 'aura', artKey: 'aura-firefly', palette: MC.firefly, collection: 'moss-club', obtain: { kind: 'focusMinutes', minutes: 1200 } }),
];

/** One lightweight matching room accent per new collection. */
export const ROOM_ACCENTS: readonly CatalogItem[] = [
  roomAccent({ id: 'ma-room-lamp', name: 'Pixel Lamp', description: 'A chunky pixel lamp that glows cyan.', slot: 'floorLeft', price: 60, collection: 'midnight-arcade' }),
  roomAccent({ id: 'dw-room-lamp', name: 'Moon Lamp', description: 'A crescent-moon night light.', slot: 'floorRight', price: 60, collection: 'dreamwave' }),
  roomAccent({ id: 'cr-room-pennant', name: 'Racing Pennant', description: 'A checkered pennant with a winged cloud.', slot: 'wall', price: 50, collection: 'cloud-racer' }),
];

/** Every collection piece, in collection order. */
export const COLLECTION_ITEMS: readonly CatalogItem[] = [
  ...FOCUS_CLUB_ITEMS,
  ...MIDNIGHT_ARCADE_ITEMS,
  ...DREAMWAVE_ITEMS,
  ...CLOUD_RACER_ITEMS,
  ...MOSS_CLUB_ITEMS,
  ...ROOM_ACCENTS,
];

/** Display name with colourway, e.g. "Gummy Visor · Frost". */
export function cosmeticName(item: { name: string; colorway?: string }): string {
  return item.colorway ? `${item.name} · ${item.colorway}` : item.name;
}
