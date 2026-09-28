import type { ReactElement } from 'react';
import { Circle, Ellipse, G, Path } from 'react-native-svg';
import type { GrowthStage, PetSpeciesId } from '@/core';
import type { PetSpecies } from '@/config/pets';
import type { PetAnatomy } from './anatomy';

/**
 * Species crests: the Sproutling's sprout and the Emberling's flame are part of
 * who they are, so no hat may hide them (docs/ART_DIRECTION.md, "Crest zones").
 *
 * The crest is drawn here, not in PetBody, so PetArt can place it relative to
 * whatever is worn on the head:
 * - `under`: normal stacking. Thin or open headwear (bands, headphones, flower
 *   garlands) is drawn over the crest's base and the crest still reads.
 * - `over`: the crest is redrawn in front of open-topped headwear (crowns).
 * - `lift`: closed-crown hats (caps, beanies, berets). The crest sits on top of
 *   the hat's crown, pokes through a small species opening (a stitched grommet
 *   for sprouts, a vent for flames), and scales down only if it would leave the
 *   200×200 canvas.
 *
 * All numbers are pet space (200×200) and live in two tables below: CRESTS (per
 * species) and HEAD_FIT (per head drawing). Adding a hat means adding one row.
 */

export const STAGE_RANK: Record<GrowthStage, number> = { baby: 0, young: 1, adult: 2, evolved: 3 };

type Palette = PetSpecies['palette'];

export interface CrestDef {
  /** Where the crest meets the head. */
  base: { x: number; y: number };
  /** Crest height above its base at a growth rank (0 baby … 3 evolved). */
  height: (rank: number) => number;
  /** Drawn before the body (grows from behind the head) or after it. */
  layer: 'behind' | 'front';
  render: (palette: Palette, rank: number) => ReactElement;
}

function Sprout(palette: Palette, rank: number) {
  const leaf = 12 + rank * 5;
  return (
    <G>
      {/* Sprout on top: a stem, then leaves that grow per stage. */}
      <Path d="M100 70 C100 60 101 52 103 46" stroke={palette.accent} strokeWidth={4} strokeLinecap="round" fill="none" />
      <Path
        d={`M103 48 C${103 + leaf} ${48 - leaf * 0.9} ${103 + leaf * 2} ${48 - leaf * 0.3} ${103 + leaf * 1.9} ${48 + leaf * 0.1} C${103 + leaf * 1.3} ${48 + leaf * 0.5} ${108} ${50} 103 48 Z`}
        fill={palette.accent}
      />
      {rank >= 1 && (
        <Path
          d={`M101 52 C${101 - leaf} ${52 - leaf * 0.9} ${101 - leaf * 2} ${52 - leaf * 0.3} ${101 - leaf * 1.9} ${52 + leaf * 0.1} C${101 - leaf * 1.3} ${52 + leaf * 0.5} ${96} ${54} 101 52 Z`}
          fill={palette.bodyShade}
        />
      )}
      {rank >= 3 && (
        // Evolved: a bloom at the tip.
        <G>
          {[0, 72, 144, 216, 288].map((angle) => (
            <Circle key={angle} cx={103 + Math.cos((angle * Math.PI) / 180) * 7} cy={42 + Math.sin((angle * Math.PI) / 180) * 7} r={6} fill="#FFB3C7" />
          ))}
          <Circle cx={103} cy={42} r={5} fill="#FFD166" />
        </G>
      )}
    </G>
  );
}

function Flame(palette: Palette, rank: number) {
  const flame = 10 + rank * 6;
  const flameColor = rank >= 3 ? '#FFE27A' : palette.accent;
  return (
    <G>
      {/* Flame tuft on the head. */}
      <Path
        d={`M100 ${66 - flame} C${108 + flame * 0.3} ${72 - flame * 0.4} ${112} 72 106 80 C104 74 101 72 100 72 C99 72 96 74 94 80 C88 72 ${92 - flame * 0.3} ${72 - flame * 0.4} 100 ${66 - flame} Z`}
        fill={flameColor}
      />
      {rank >= 1 && <Path d={`M100 ${72 - flame * 0.5} C104 70 104 76 100 80 C96 76 96 70 100 ${72 - flame * 0.5} Z`} fill="#FFF3C4" />}
    </G>
  );
}

/** Species that have a crest. Cloudling's crest is its whole cloud silhouette, so it has none here. */
export const CRESTS: Partial<Record<PetSpeciesId, CrestDef>> = {
  // Stem from (100, 70); the bloom/leaf tips reach ~33 + 4.5/rank above it.
  sproutling: { base: { x: 101, y: 70 }, height: (rank) => 33 + rank * 4.5, layer: 'behind', render: Sprout },
  // Flame from (100, 78); tip at 66 − (10 + 6·rank).
  emberling: { base: { x: 100, y: 78 }, height: (rank) => 22 + rank * 6, layer: 'front', render: Flame },
};

export type CrestMode = 'under' | 'over' | 'lift';

export interface HeadFit {
  crest: CrestMode;
  /** Top of the hat's crown, relative to the head top (lift only). */
  crownTop?: number;
  /**
   * Lowest point the drawing reaches above the eyes (measured over the eye
   * columns), relative to the head top. Must stay above the eye-clearance line
   * for every species and stage (tested). Side pieces that sit beside the face
   * (headphone cups, a mic beside the mouth) are not in the eye columns.
   */
  faceEdge: number;
}

/**
 * How each head drawing treats crests. Every head art key must be listed
 * (tested), so a new hat can't silently cover a sprout or a flame.
 */
export const HEAD_FIT: Record<string, HeadFit> = {
  'acc-cap': { crest: 'lift', crownTop: 1, faceEdge: 26 },
  'acc-headphones': { crest: 'over', faceEdge: -4 },
  'acc-flower-crown': { crest: 'under', faceEdge: 25 },
  'acc-golden-crown': { crest: 'over', faceEdge: 18 },
  'cloud-cap': { crest: 'lift', crownTop: -9, faceEdge: 31 },
  'pixel-beanie': { crest: 'lift', crownTop: -24, faceEdge: 25 },
  'arcade-headset': { crest: 'over', faceEdge: -6 },
  'crescent-headband': { crest: 'over', faceEdge: 20 },
  'cloud-beret': { crest: 'lift', crownTop: -18, faceEdge: 25 },
  'racing-cap': { crest: 'lift', crownTop: -6, faceEdge: 30 },
  'racer-goggles': { crest: 'under', faceEdge: 28 },
  'leaf-beanie': { crest: 'lift', crownTop: -21, faceEdge: 24 },
};

/** Minimum gap between a hat's face edge and the top of the eyes. */
export const EYE_CLEARANCE = 2;
/** How far the eyes reach above eyeY (PetFace: ry 10, ×1.18 for babies). */
export const eyeRadius = (stage: GrowthStage) => (stage === 'baby' ? 11.8 : 10);

/** A lifted crest never pokes above this line. */
const CANVAS_TOP = 3;

export interface CrestPlacement {
  mode: CrestMode;
  /** SVG transform for a lifted crest (undefined when drawn in place). */
  transform?: string;
  /** Where to draw the opening in the hat (lift only). */
  opening?: { x: number; y: number };
  /** Top of the crest after placement, for tests. */
  top: number;
}

/** Where the crest goes for this species, stage and head drawing (null: no crest). */
export function crestPlacement(species: PetSpeciesId, stage: GrowthStage, headKey: string | undefined, anatomy: PetAnatomy): CrestPlacement | null {
  const crest = CRESTS[species];
  if (!crest) return null;
  const height = crest.height(STAGE_RANK[stage]);
  const fit = headKey ? HEAD_FIT[headKey] : undefined;
  if (!fit || fit.crest !== 'lift' || fit.crownTop === undefined) {
    return { mode: fit?.crest ?? 'under', top: crest.base.y - height };
  }
  const crownY = anatomy.headTop + fit.crownTop;
  // Sit the crest's base just inside the crown so it reads as poking through.
  const baseY = crownY + 3;
  const scale = Math.min(1, (baseY - CANVAS_TOP) / height);
  const { x, y } = crest.base;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return {
    mode: 'lift',
    transform: `translate(${x} ${r(baseY)}) scale(${r(scale)}) translate(${-x} ${-y})`,
    opening: { x, y: crownY + 2 },
    top: baseY - height * scale,
  };
}

/** The crest itself, drawn in place (callers wrap it for `lift`). */
export function PetCrest({ species, palette, stage }: { species: PetSpeciesId; palette: Palette; stage: GrowthStage }) {
  const crest = CRESTS[species];
  return crest ? crest.render(palette, STAGE_RANK[stage]) : null;
}

/** The little opening a lifted crest grows out of: a stitched grommet (sprout) or a vent (flame). */
export function CrestOpening({ species, x, y, palette }: { species: PetSpeciesId; x: number; y: number; palette: Palette }) {
  if (species === 'emberling') {
    return (
      <G>
        <Ellipse cx={x} cy={y} rx={9} ry={3.2} fill="#000000" opacity={0.28} />
        <Ellipse cx={x} cy={y - 0.4} rx={6.5} ry={2} fill={palette.accent} opacity={0.55} />
      </G>
    );
  }
  return (
    <G>
      <Ellipse cx={x} cy={y} rx={6.5} ry={2.6} fill="#000000" opacity={0.25} />
      <Ellipse cx={x} cy={y} rx={6.5} ry={2.6} fill="none" stroke="#FFFFFF" strokeWidth={0.9} strokeDasharray="1.6 1.4" opacity={0.8} />
    </G>
  );
}
