import { ART_MATERIAL, COLLECTION_ITEMS, MATERIAL_LABEL } from '@/config/cosmetics';
import { PERSONALITIES, PERSONALITY_TAP_LINES, REACTIONS } from '@/config/reactions';
import { CATALOG } from '@/config/shopCatalog';
import { isWearable, type GrowthStage, type PetSpeciesId } from '@/core';
import { resolveAccessoryArt } from '@/ui/pet/accessories';
import { ANATOMY } from '@/ui/pet/anatomy';
import { AURA_FRAME, auraSpotsFor, hasAuraArt } from '@/ui/pet/auras';
import { CRESTS, crestPlacement, EYE_CLEARANCE, eyeRadius, HEAD_FIT } from '@/ui/pet/crest';

const SPECIES: PetSpeciesId[] = ['cloudling', 'sproutling', 'emberling'];
const STAGES: GrowthStage[] = ['baby', 'young', 'adult', 'evolved'];
const wearables = CATALOG.filter(isWearable);

describe('materials bible', () => {
  it('every drawn (non-aura) wearable has a material family with a label', () => {
    for (const item of wearables.filter((i) => i.equipSlot !== 'aura')) {
      const key = resolveAccessoryArt(item.id)!.key;
      expect([item.id, ART_MATERIAL[key]]).toEqual([item.id, expect.any(String)]);
      expect(MATERIAL_LABEL[ART_MATERIAL[key]!]).toBeTruthy();
    }
  });

  it('collection items carry their material in art metadata', () => {
    for (const item of COLLECTION_ITEMS.filter((i) => i.category === 'accessory' && i.equipSlot !== 'aura')) {
      expect([item.id, item.art?.material]).toEqual([item.id, ART_MATERIAL[item.art!.key]]);
    }
  });

  it('eyewear stays see-through (jelly, smoked or holo lenses, never opaque)', () => {
    for (const item of COLLECTION_ITEMS.filter((i) => i.equipSlot === 'face')) {
      expect(['jelly', 'holo', 'wood']).toContain(item.art!.material);
      expect(item.art!.palette!.opacity).toBeLessThanOrEqual(0.8);
    }
  });
});

describe('species-aware headwear', () => {
  const headKeys = [...new Set(wearables.filter((i) => i.equipSlot === 'head').map((i) => resolveAccessoryArt(i.id)!.key))];

  it('every head drawing declares how it treats crests', () => {
    for (const key of headKeys) expect([key, Boolean(HEAD_FIT[key])]).toEqual([key, true]);
  });

  it('no hat hides a sprout or a flame, and lifted crests stay on the canvas', () => {
    for (const species of ['sproutling', 'emberling'] as const) {
      for (const stage of STAGES) {
        for (const key of headKeys) {
          const placed = crestPlacement(species, stage, key, ANATOMY[species])!;
          expect(placed).not.toBeNull();
          expect(['under', 'over', 'lift']).toContain(placed.mode);
          expect([species, stage, key, placed.top >= 2]).toEqual([species, stage, key, true]);
          const fit = HEAD_FIT[key]!;
          if (fit.crest === 'lift') {
            // The crest's tip is above the hat's crown, i.e. visible.
            expect(placed.top).toBeLessThan(ANATOMY[species].headTop + fit.crownTop!);
          }
        }
      }
    }
  });

  it('closed-crown hats lift the crest; a lifted crest keeps most of its size', () => {
    for (const species of ['sproutling', 'emberling'] as const) {
      const placed = crestPlacement(species, 'evolved', 'pixel-beanie', ANATOMY[species])!;
      expect(placed.mode).toBe('lift');
      const scale = Number(/scale\(([\d.]+)\)/.exec(placed.transform!)![1]);
      expect(scale).toBeGreaterThan(0.7);
    }
  });

  it('Cloudling has no crest to move: its cloud silhouette is the crest', () => {
    expect(CRESTS.cloudling).toBeUndefined();
    expect(crestPlacement('cloudling', 'adult', 'pixel-beanie', ANATOMY.cloudling)).toBeNull();
  });

  it('hats stay clear of the eyes on every species and stage (fit overrides included)', () => {
    for (const item of wearables.filter((i) => i.equipSlot === 'head')) {
      const key = resolveAccessoryArt(item.id)!.key;
      for (const species of SPECIES) {
        for (const stage of STAGES) {
          const a = ANATOMY[species];
          const dy = (item.art?.fit ?? []).filter((f) => (!f.species || f.species === species) && (!f.stage || f.stage === stage)).reduce((n, f) => n + (f.dy ?? 0), 0);
          const edge = a.headTop + HEAD_FIT[key]!.faceEdge + dy;
          expect([item.id, species, stage, edge <= a.eyeY - eyeRadius(stage) - EYE_CLEARANCE]).toEqual([item.id, species, stage, true]);
        }
      }
    }
  });
});

describe('aura composition', () => {
  const auraKeys = [...new Set(wearables.filter((i) => i.equipSlot === 'aura').map((i) => i.art?.key ?? ''))].filter(hasAuraArt);

  it('auras frame the pet: outside the pet ellipse, out of the crest column, inside the box', () => {
    const { pet, crest, box, particleScale } = AURA_FRAME;
    for (const key of auraKeys) {
      for (const spot of auraSpotsFor(key)) {
        const half = (24 * spot.s * particleScale) / 2;
        const inside = ((spot.x - pet.cx) / pet.rx) ** 2 + ((spot.y - pet.cy) / pet.ry) ** 2;
        expect([key, spot, inside > 1]).toEqual([key, spot, true]);
        const inCrest = spot.x + half > crest.x1 && spot.x - half < crest.x2 && spot.y - half < crest.yMax;
        expect([key, spot, inCrest]).toEqual([key, spot, false]);
        expect(spot.x - half).toBeGreaterThanOrEqual(box.min);
        expect(spot.x + half).toBeLessThanOrEqual(box.max);
        expect(spot.y - half).toBeGreaterThanOrEqual(box.min);
        expect(spot.y + half).toBeLessThanOrEqual(box.max);
      }
    }
  });

  it('auras stay light: at most six particles', () => {
    for (const key of auraKeys) expect(auraSpotsFor(key).length).toBeLessThanOrEqual(6);
  });
});

describe('personality presentation', () => {
  it('every reaction belongs to one of the four families, and every family has reactions and tap lines', () => {
    const ids = PERSONALITIES.map((p) => p.id);
    expect(ids).toEqual(['calm', 'hype', 'dreamy', 'cool']);
    for (const r of REACTIONS) expect(ids).toContain(r.personality);
    for (const id of ids) {
      expect(REACTIONS.some((r) => r.personality === id)).toBe(true);
      expect(PERSONALITY_TAP_LINES[id].length).toBeGreaterThan(0);
    }
  });

  it('personalities are presentation only: no numbers or bonuses attached', () => {
    for (const p of PERSONALITIES) expect(Object.keys(p).sort()).toEqual(['id', 'ink', 'line', 'name', 'tint']);
  });
});

describe('acquisition provenance', () => {
  const { describeProvenance, describeHowToGet } = jest.requireActual('@/features/wardrobe/cosmeticCopy');
  const { provenanceOf } = jest.requireActual('@/core');
  const { getShopItem } = jest.requireActual('@/config/shopCatalog');

  it('says how an owned piece was earned, in plain words', () => {
    expect(describeProvenance(provenanceOf(getShopItem('ma-beanie')), { withDate: false })).toBe('Earned after 5 completed focus sessions');
    expect(describeProvenance(provenanceOf(getShopItem('fc-visor-frost')), { withDate: false })).toBe('Earned after your first completed focus session');
    expect(describeProvenance(provenanceOf(getShopItem('mc-aura')), { withDate: false })).toBe('Earned after 20 hours of focus');
    expect(describeProvenance(provenanceOf(getShopItem('mc-scarf')), { withDate: false })).toBe('Earned after 12 completed missions');
    expect(describeProvenance(provenanceOf(getShopItem('mc-toadstool')), { withDate: false })).toBe('Earned by focusing 10 days in a row');
    expect(describeProvenance(provenanceOf(getShopItem('fc-charm-star')), { withDate: false })).toBe('Every Focusling starts with one');
    expect(describeProvenance(provenanceOf(getShopItem('mc-satchel')), { withDate: false })).toMatch(/^Bought with \d+ focus coins$/);
  });

  it('adds the date a piece arrived when known', () => {
    const at = new Date(2026, 8, 28).getTime();
    expect(describeProvenance(provenanceOf(getShopItem('ma-beanie'), at))).toMatch(/^Earned after 5 completed focus sessions · .+/);
  });

  it('says how to get pieces that are not owned yet', () => {
    expect(describeHowToGet(getShopItem('mc-beanie'))).toBe('Finish 15 focus sessions');
    expect(describeHowToGet(getShopItem('mc-ladybug'))).toMatch(/^In the shop for \d+ focus coins$/);
  });
});
