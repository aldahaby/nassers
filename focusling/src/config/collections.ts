import type { CosmeticCollection } from '@/core/models';

/**
 * Cosmetic collections: small, art-directed drops. Membership is declared on
 * each item (`collection` in `config/cosmetics.ts`); a collection adds identity,
 * a curated Look and a completion Reaction. All current collections are
 * permanent and first-party (docs/COSMETICS.md).
 */
export const COLLECTION_LIST: readonly CosmeticCollection[] = [
  {
    id: 'focus-club',
    name: 'Focus Club',
    tagline: 'Where every Focusling starts.',
    description: 'Cute streetwear basics: a gummy visor, a cloud cap and mood charms.',
    theme: 'cute streetwear, gummy translucent, soft pastels',
    palette: { primary: '#A6D4FA', secondary: '#5B3A4E', accent: '#FFD166', ink: '#2F2548', wash: '#FDEBD8' },
    badge: 'badge-focus-club',
    featuredLook: { head: 'fc-cap-plum', face: 'fc-visor-frost', charm: 'fc-charm-star', aura: 'fc-aura-sparkle' },
    reaction: 'star-twirl',
    availability: { kind: 'permanent' },
    origin: { kind: 'first-party', designer: 'Focusling' },
    order: 0,
  },
  {
    id: 'midnight-arcade',
    name: 'Midnight Arcade',
    tagline: 'Focus after dark.',
    description: 'Retro arcade nights meet streetwear: a pixel beanie, a scanline visor and glowing tech.',
    theme: 'retro arcade, digital nightlife, streetwear; plum, navy, electric violet, icy cyan',
    palette: { primary: '#8B5CFF', secondary: '#1C2143', accent: '#5CF0FF', ink: '#1C2143', wash: '#E7E1FF' },
    badge: 'badge-midnight-arcade',
    featuredLook: { head: 'ma-beanie', face: 'ma-visor', neck: 'ma-collar', aura: 'ma-aura' },
    reaction: 'pixel-pop',
    roomAccent: 'ma-room-lamp',
    availability: { kind: 'permanent' },
    origin: { kind: 'first-party', designer: 'Focusling' },
    order: 1,
  },
  {
    id: 'dreamwave',
    name: 'Dreamwave',
    tagline: 'Soft colours, big dreams.',
    description: 'Glossy soft-pop with a celestial streak: heart shades, a crescent headband, pearls and moonlight.',
    theme: 'dreamy Y2K, celestial, glossy soft-pop; lavender, pink, pearl, baby blue',
    palette: { primary: '#CDB8FF', secondary: '#FFC4E1', accent: '#BDE4FF', ink: '#5A3F8C', wash: '#F6EEFF' },
    badge: 'badge-dreamwave',
    featuredLook: { head: 'dw-headband', face: 'dw-shades', charm: 'dw-charm', aura: 'dw-aura' },
    reaction: 'dream-float',
    roomAccent: 'dw-room-lamp',
    availability: { kind: 'permanent' },
    origin: { kind: 'first-party', designer: 'Focusling' },
    order: 2,
  },
  {
    id: 'cloud-racer',
    name: 'Cloud Racer',
    tagline: 'Built for the long run.',
    description: 'Original motorsport style: a racing cap, aero shades, a wind-blown scarf and speed lines.',
    theme: 'motorsport-inspired (no real teams, brands or liveries); cream, racing red, cobalt, charcoal, checker',
    palette: { primary: '#E5402B', secondary: '#2E5BD6', accent: '#FF8A3D', ink: '#2A2A33', wash: '#FFF3DC' },
    badge: 'badge-cloud-racer',
    featuredLook: { head: 'cr-cap', face: 'cr-shades', neck: 'cr-scarf', aura: 'cr-aura' },
    reaction: 'victory-lap',
    roomAccent: 'cr-room-pennant',
    availability: { kind: 'permanent' },
    origin: { kind: 'first-party', designer: 'Focusling' },
    order: 3,
  },
  {
    id: 'moss-club',
    name: 'Moss Club',
    tagline: 'Grown slowly, worn softly.',
    description: 'Forest streetwear for a tiny magical creature: a leaf-knit beanie, acorn specs, a fuzzy moss scarf and fireflies.',
    theme: 'forest streetwear, cosy tactile, organic asymmetry; moss, forest, mushroom red, cream, warm wood, firefly yellow',
    palette: { primary: '#6E9B4E', secondary: '#C8553D', accent: '#E9F27A', ink: '#2F4A2E', wash: '#EEF2E0' },
    badge: 'badge-moss-club',
    featuredLook: { head: 'mc-beanie', face: 'mc-specs', neck: 'mc-scarf', charm: 'mc-ladybug', aura: 'mc-aura' },
    reaction: 'firefly-hello',
    availability: { kind: 'permanent' },
    origin: { kind: 'first-party', designer: 'Focusling' },
    order: 4,
  },
];

const BY_ID = new Map(COLLECTION_LIST.map((c) => [c.id, c]));
export function getCollection(id: string): CosmeticCollection | undefined {
  return BY_ID.get(id);
}
