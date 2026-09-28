import fs from 'node:fs';
import path from 'node:path';
import { PET_SPECIES } from '@/config/pets';
import { ROOM_PRESETS } from '@/config/room';
import { contrast, hexToHsl, isHexColor, luminance } from '@/ui/color';
import { CRESTS, STAGE_RANK } from '@/ui/pet/crest';
import { EXPRESSIONS } from '@/ui/pet/PetFace';
import { SPECIES_ART } from '@/ui/pet/speciesArt';
import { roomPalette } from '@/ui/room/roomPalette';

const TEST_ROOMS = { white: '#FFFFFF', black: '#000000', red: '#FF0000', green: '#00FF00', blue: '#0000FF', yellow: '#FFFF00', purple: '#800080', gray: '#808080', pink: '#FFC0CB' };

describe('species detail registry', () => {
  it('every species has its own rendering language', () => {
    for (const id of Object.keys(PET_SPECIES)) {
      const art = SPECIES_ART[id as keyof typeof SPECIES_ART];
      expect(art).toBeDefined();
      for (const c of [art.eyeTint, art.rim, art.crease, art.highlight]) expect(isHexColor(c)).toBe(true);
      expect(art.cues.length).toBeGreaterThanOrEqual(3);
      expect(art.evolvedFlourish.length).toBeGreaterThan(10);
    }
    // Three species, three different eye tints (not just three body colours).
    expect(new Set(Object.values(SPECIES_ART).map((a) => a.eyeTint)).size).toBe(3);
  });

  it('crests grow with the stage (Baby smallest, Evolved richest)', () => {
    for (const crest of Object.values(CRESTS)) {
      const heights = (['baby', 'young', 'adult', 'evolved'] as const).map((s) => crest!.height(STAGE_RANK[s]));
      for (let i = 1; i < heights.length; i += 1) expect(heights[i]).toBeGreaterThan(heights[i - 1]!);
    }
  });

  it('the expression library covers the core vocabulary, with no punishing faces', () => {
    for (const e of ['auto', 'delighted', 'excited', 'sleepy', 'focused', 'curious', 'proud', 'surprised', 'wink'] as const) expect(EXPRESSIONS).toContain(e);
    for (const bad of ['sad', 'crying', 'angry', 'guilty', 'devastated']) expect(EXPRESSIONS as readonly string[]).not.toContain(bad);
  });
});

describe('room palette', () => {
  it('the default room is exactly the original art', () => {
    const p = roomPalette(null);
    expect(p).toMatchObject({ wall: '#FDE9D2', floor: '#F4D2AE', floorEdge: '#EAC096' });
  });

  it('respects the chosen colour and derives a coherent set of tones', () => {
    for (const [name, c] of [...Object.entries(TEST_ROOMS), ...ROOM_PRESETS.map((p) => [p.name, p.color] as const)]) {
      const p = roomPalette(c);
      expect([name, p.wall]).toEqual([name, c.toUpperCase()]);
      for (const tone of [p.trim, p.floor, p.floorEdge, p.spotlight, p.halo, p.shadow, p.accent, p.sky]) expect([name, isHexColor(tone)]).toEqual([name, true]);
      // Floor and wall separate; the halo separates the pet from the wall.
      expect([name, contrast(p.floor, p.wall) > 1.05]).toEqual([name, true]);
      expect([name, p.halo !== p.wall]).toEqual([name, true]);
    }
  });

  it('dark rooms get a lighter floor, a brighter halo and stronger shadows', () => {
    for (const c of [TEST_ROOMS.black, '#1E2447', '#4A2D5C']) {
      const p = roomPalette(c);
      expect(p.tone).toBe('dark');
      expect(luminance(p.floor)).toBeGreaterThan(luminance(p.wall));
      expect(luminance(p.halo)).toBeGreaterThan(luminance(p.wall));
      expect(p.shadowOpacity).toBeGreaterThan(roomPalette('#CFE4FA').shadowOpacity);
    }
  });

  it('very bright rooms tint the spotlight so it still shows', () => {
    for (const c of [TEST_ROOMS.white, TEST_ROOMS.yellow]) {
      const p = roomPalette(c);
      expect(p.bright).toBe(true);
      expect(p.spotlight).not.toBe('#FFFFFF');
      expect(luminance(p.floor)).toBeLessThan(luminance(p.wall));
    }
  });

  it('saturated walls get a softer halo (less saturated than the wall)', () => {
    for (const c of [TEST_ROOMS.red, TEST_ROOMS.green, TEST_ROOMS.blue]) expect(hexToHsl(roomPalette(c).halo).s).toBeLessThan(hexToHsl(c).s);
  });
});

describe('audio coverage guard', () => {
  const ALLOWED = new Set(['src/ui/components/Pressable.tsx', 'src/ui/pet/AnimatedPet.tsx']);
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
      return p.endsWith('.tsx') ? [p] : [];
    });

  it('no screen uses a raw (silent) React Native pressable outside the allow-list', () => {
    const root = path.join(__dirname, '../../..');
    const offenders = walk(path.join(root, 'src'))
      .map((f) => path.relative(root, f))
      .filter((rel) => !ALLOWED.has(rel))
      .filter((rel) => /import\s*\{[^}]*\b(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback)\b[^}]*\}\s*from\s*'react-native'/.test(fs.readFileSync(path.join(root, rel), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
