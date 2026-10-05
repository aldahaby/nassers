import { COLLECTION_LIST } from '@/config/collections';
import { COLLECTION_ITEMS } from '@/config/cosmetics';
import { getReaction } from '@/config/reactions';
import { CATALOG } from '@/config/shopCatalog';
import { isWearable, WEARABLE_SLOTS } from '@/core';
import { ACCESSORY_ICON_VIEWBOX, fitTransform, resolveAccessoryArt } from '@/ui/pet/accessories';
import { hasAuraArt } from '@/ui/pet/auras';
import { DECORATION_ART, DECORATION_ICON_VIEWBOX } from '@/ui/room/decorations';
import { hasBadge } from '@/ui/style/CollectionBadge';

const HEX = /^#[0-9A-F]{6}$/i;
const SPECIES = ['cloudling', 'sproutling', 'emberling'];
const STAGES = ['baby', 'young', 'adult', 'evolved'];

describe('cosmetic art registry', () => {
  it('every wearable has a drawing and an icon', () => {
    for (const item of CATALOG.filter(isWearable)) {
      if (item.equipSlot === 'aura') {
        expect([item.id, hasAuraArt(item.art?.key ?? '')]).toEqual([item.id, true]);
      } else {
        const art = resolveAccessoryArt(item.id);
        expect([item.id, Boolean(art)]).toEqual([item.id, true]);
        expect([item.id, Boolean(ACCESSORY_ICON_VIEWBOX[art!.key])]).toEqual([item.id, true]);
      }
    }
  });

  it('collection pieces have valid ids, slots, palettes, credit and a way to obtain them', () => {
    for (const item of COLLECTION_ITEMS) {
      expect(item.id).toMatch(/^[a-z]{2}-[a-z0-9-]+$/);
      expect(item.credit).toEqual({ designer: 'Focusling', rights: 'original', art: 'v1' });
      if (item.category === 'decoration') continue;
      expect(WEARABLE_SLOTS).toContain(item.equipSlot);
      const p = item.art!.palette!;
      for (const c of [p.primary, p.secondary, p.accent]) expect([item.id, c]).toEqual([item.id, expect.stringMatching(HEX)]);
      if (p.opacity !== undefined) expect(p.opacity).toBeGreaterThanOrEqual(0.45); // eyes read through, lens still visible
      const source = item.source ?? 'shop';
      if (source === 'earned') expect(item.unlock).toBeDefined();
      if (source === 'shop') expect(item.price).toBeGreaterThan(0);
    }
  });

  it('fit overrides are small, valid adjustments', () => {
    for (const item of COLLECTION_ITEMS) {
      for (const f of item.art?.fit ?? []) {
        if (f.species) expect(SPECIES).toContain(f.species);
        if (f.stage) expect(STAGES).toContain(f.stage);
        expect(Math.abs(f.dx ?? 0)).toBeLessThanOrEqual(12);
        expect(Math.abs(f.dy ?? 0)).toBeLessThanOrEqual(12);
        expect(f.scale ?? 1).toBeGreaterThan(0.8);
        expect(f.scale ?? 1).toBeLessThan(1.25);
      }
    }
  });

  it('fit transforms apply only where they match, most specific last', () => {
    const anchor = { x: 100, y: 110 };
    expect(fitTransform([], 'cloudling', 'baby', anchor)).toBeUndefined();
    expect(fitTransform([{ stage: 'baby', scale: 1.1 }], 'cloudling', 'adult', anchor)).toBeUndefined();
    expect(fitTransform([{ stage: 'baby', scale: 1.1 }, { species: 'emberling', stage: 'baby', dy: -2 }], 'emberling', 'baby', anchor)).toBe(
      'translate(0 -2) translate(100 110) rotate(0) scale(1.1) translate(-100 -110)',
    );
  });

  it('every collection has a badge, a valid reaction and (if any) a drawn room accent', () => {
    for (const c of COLLECTION_LIST) {
      expect([c.id, hasBadge(c.badge)]).toEqual([c.id, true]);
      if (c.access !== 'premium') expect(getReaction(c.reaction!)).toBeDefined();
      if (c.roomAccent) {
        expect(DECORATION_ART[c.roomAccent]).toBeDefined();
        expect(DECORATION_ICON_VIEWBOX[c.roomAccent]).toBeDefined();
      }
    }
  });
});
