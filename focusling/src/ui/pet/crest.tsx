import type { ReactElement } from 'react';
import { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import type { GrowthStage, PetSpeciesId } from '@/core';
import type { PetSpecies } from '@/config/pets';
import { mix } from '@/ui/color';
import { useArtScope } from './artScope';
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
  /** `phase` 0 rests; 1 and 2 are the two idle/tap wiggle poses. */
  render: (palette: Palette, rank: number, phase?: number, scope?: string) => ReactElement;
}

/** A leaf from (x, y) of length `len`, pointing along `dir` (1 right, -1 left). */
function leafPath(x: number, y: number, len: number, dir: 1 | -1) {
  const d = dir;
  return `M${x} ${y} C${x + d * len} ${y - len * 0.9} ${x + d * len * 2} ${y - len * 0.3} ${x + d * len * 1.9} ${y + len * 0.1} C${x + d * len * 1.3} ${y + len * 0.5} ${x + d * 5} ${y + 2} ${x} ${y} Z`;
}

function Leaf({ x, y, len, dir, fill, id, rank }: { x: number; y: number; len: number; dir: 1 | -1; fill: string; id: string; rank: number }) {
  const d = dir;
  return (
    <G>
      <Path d={leafPath(x, y, len, dir)} fill={`url(#${id})`} />
      {/* Midrib, then side veins once the leaf has grown. */}
      <Path d={`M${x + d * 2} ${y} Q${x + d * len} ${y - len * 0.38} ${x + d * len * 1.75} ${y - len * 0.02}`} stroke="#FFFFFF" strokeWidth={1.3} strokeLinecap="round" fill="none" opacity={0.55} />
      {rank >= 2 && (
        <Path
          d={`M${x + d * len * 0.7} ${y - len * 0.28} l${d * len * 0.12} ${-len * 0.22} M${x + d * len * 1.15} ${y - len * 0.22} l${d * len * 0.14} ${-len * 0.2} M${x + d * len * 0.9} ${y - len * 0.26} l${d * len * 0.06} ${len * 0.18}`}
          stroke="#FFFFFF"
          strokeWidth={0.9}
          strokeLinecap="round"
          opacity={0.4}
        />
      )}
      <Path d={leafPath(x, y, len, dir)} fill="none" stroke={fill} strokeWidth={0.8} opacity={0.5} />
    </G>
  );
}

function Sprout(palette: Palette, rank: number, phase = 0, sc = '') {
  const leaf = 12 + rank * 5;
  // Idle "settling": the leaves tilt a few degrees around the stem tip.
  const sway = phase === 1 ? 5 : phase === 2 ? -4 : 0;
  const front = mix(palette.accent, '#FFFFFF', 0.35);
  const back = palette.bodyShade;
  return (
    <G>
      <Defs>
        <LinearGradient id={`cr-leaf-f-${rank}${sc}`} x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={palette.accent} />
          <Stop offset="1" stopColor={front} />
        </LinearGradient>
        <LinearGradient id={`cr-leaf-b-${rank}${sc}`} x1="1" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={mix(back, '#000000', 0.08)} />
          <Stop offset="1" stopColor={mix(back, '#FFFFFF', 0.25)} />
        </LinearGradient>
      </Defs>
      {/* Stem grows out of the head, with a light edge. */}
      <Path d="M100 70 C100 60 101 52 103 46" stroke={palette.accent} strokeWidth={4.2} strokeLinecap="round" fill="none" />
      <Path d="M99 66 C99.4 59 100.2 53 101.6 48" stroke="#FFFFFF" strokeWidth={1.1} strokeLinecap="round" fill="none" opacity={0.5} />
      <G transform={`rotate(${sway} 103 48)`}>
        {rank >= 1 && <Leaf x={101} y={52} len={leaf} dir={-1} fill={back} id={`cr-leaf-b-${rank}${sc}`} rank={rank} />}
        <Leaf x={103} y={48} len={leaf} dir={1} fill={palette.accent} id={`cr-leaf-f-${rank}${sc}`} rank={rank} />
        {rank === 0 && <Circle cx={102} cy={45} r={2.6} fill={front} />}
        {rank === 2 && <Path d="M103 47 C101 41 105 38 108 40" stroke={palette.accent} strokeWidth={1.6} strokeLinecap="round" fill="none" />}
        {rank >= 3 && (
          // Evolved: a bloom at the tip, and leaf edges that softly glow.
          <G>
            <Path d={leafPath(103, 48, leaf, 1)} fill="none" stroke="#FFF7C2" strokeWidth={1.4} opacity={0.7} />
            {[0, 72, 144, 216, 288].map((angle) => (
              <Circle key={angle} cx={103 + Math.cos((angle * Math.PI) / 180) * 7} cy={42 + Math.sin((angle * Math.PI) / 180) * 7} r={6} fill="#FFB3C7" />
            ))}
            {[36, 108, 180, 252, 324].map((angle) => (
              <Circle key={angle} cx={103 + Math.cos((angle * Math.PI) / 180) * 4.5} cy={42 + Math.sin((angle * Math.PI) / 180) * 4.5} r={2.4} fill="#FFD6E2" />
            ))}
            <Circle cx={103} cy={42} r={4.4} fill="#FFD166" />
            <Circle cx={101.8} cy={40.8} r={1.4} fill="#FFFFFF" opacity={0.8} />
          </G>
        )}
      </G>
    </G>
  );
}

/** The flame tuft path (tip at 66 − flame), with a tip offset for flicker. */
function flamePath(flame: number, lean: number) {
  return `M${100 + lean} ${66 - flame} C${108 + flame * 0.3} ${72 - flame * 0.4} ${112} 72 106 80 C104 74 101 72 100 72 C99 72 96 74 94 80 C88 72 ${92 - flame * 0.3} ${72 - flame * 0.4} ${100 + lean} ${66 - flame} Z`;
}

function Flame(palette: Palette, rank: number, phase = 0, sc = '') {
  const flame = 10 + rank * 6;
  // Idle flicker: the tip leans a touch, then settles.
  const lean = phase === 1 ? 2.5 : phase === 2 ? -2 : 0;
  const gold = rank >= 3 ? '#FFE27A' : palette.accent;
  const outer = mix(palette.bodyShade, '#FF5A2E', 0.45);
  const layer = (scale: number) => `translate(100 80) scale(${scale}) translate(-100 -80)`;
  return (
    <G>
      <Defs>
        <LinearGradient id={`cr-flame-${rank}${sc}`} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={outer} />
          <Stop offset="1" stopColor={gold} />
        </LinearGradient>
      </Defs>
      {rank >= 3 &&
        // Evolved: two small flamelets beside the crest.
        [-1, 1].map((side) => (
          <Path key={side} d={flamePath(8, 0)} transform={`translate(${side * 12} 3) rotate(${side * 22} 100 80) translate(100 80) scale(0.62) translate(-100 -80)`} fill={`url(#cr-flame-${rank}${sc})`} opacity={0.9} />
        ))}
      {/* Three layers: warm outer, gold middle, cream core. */}
      <Path d={flamePath(flame, lean)} fill={`url(#cr-flame-${rank}${sc})`} />
      <Path d={flamePath(flame, lean * 0.7)} transform={layer(0.68)} fill={gold} />
      {rank >= 1 && <Path d={flamePath(flame, lean * 0.5)} transform={layer(0.4)} fill="#FFF3C4" />}
      <Path d={`M${97 + lean * 0.3} ${70 - flame * 0.55} Q${96} ${72 - flame * 0.2} 97 76`} stroke="#FFFFFF" strokeWidth={1.2} strokeLinecap="round" fill="none" opacity={0.55} />
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
export function PetCrest({ species, palette, stage, phase = 0 }: { species: PetSpeciesId; palette: Palette; stage: GrowthStage; phase?: number }) {
  const crest = CRESTS[species];
  const scope = useArtScope();
  return crest ? crest.render(palette, STAGE_RANK[stage], phase, scope) : null;
}

/**
 * The opening a lifted crest grows out of. Sprouts come through a brass eyelet
 * (a ringed grommet with a highlight); flames through a heat vent with a warm
 * glow and a stitched surround.
 */
export function CrestOpening({ species, x, y, palette }: { species: PetSpeciesId; x: number; y: number; palette: Palette }) {
  const sc = useArtScope();
  if (species === 'emberling') {
    return (
      <G>
        <Defs>
          <RadialGradient id={`cr-vent${sc}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFE27A" stopOpacity={0.95} />
            <Stop offset="0.6" stopColor={palette.accent} stopOpacity={0.6} />
            <Stop offset="1" stopColor={palette.bodyShade} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={x} cy={y} rx={13} ry={4.6} fill={`url(#cr-vent${sc})`} />
        <Ellipse cx={x} cy={y} rx={8.5} ry={2.8} fill="#6B2A12" opacity={0.55} />
        <Ellipse cx={x} cy={y} rx={10.5} ry={3.8} fill="none" stroke="#FFFFFF" strokeWidth={0.9} strokeDasharray="1.8 1.6" opacity={0.7} />
      </G>
    );
  }
  return (
    <G>
      <Ellipse cx={x} cy={y + 0.6} rx={8} ry={3.3} fill="#000000" opacity={0.18} />
      <Ellipse cx={x} cy={y} rx={7.4} ry={3} fill="#E0B45A" />
      <Ellipse cx={x} cy={y} rx={4.6} ry={1.8} fill="#4A3A22" />
      <Path d={`M${x - 6} ${y - 1} Q${x - 2} ${y - 3} ${x + 3} ${y - 2.6}`} stroke="#FFF3C4" strokeWidth={1} strokeLinecap="round" fill="none" />
    </G>
  );
}

/**
 * Cloudling under a closed hat: soft cloud tufts puff out from under the brim
 * on both sides, so the silhouette still reads as a cloud, not a flat cap.
 */
export function CloudTufts({ headTop: h, palette }: { headTop: number; palette: Palette }) {
  const tuft = (x: number, dir: 1 | -1) => (
    <G key={x}>
      <Circle cx={x} cy={h + 26} r={8.5} fill={palette.body} />
      <Circle cx={x + dir * 7} cy={h + 30} r={6.5} fill={palette.body} />
      <Path d={`M${x - 5 * dir} ${h + 21} Q${x} ${h + 18} ${x + 5 * dir} ${h + 21}`} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.6} />
    </G>
  );
  return <G>{[tuft(58, -1), tuft(142, 1)]}</G>;
}
