import type { ReactElement } from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { ItemPalette } from '@/core';
import type { PetAnatomy } from './anatomy';
import { charm, heartPath, starPath } from './focusClubArt';
import { fillFor, FuzzEdge, Grain, KnitRibs, MaterialDefs, MaterialShape, materialId, Specular, Stitch, Streak } from './materials';

type Art = (a: PetAnatomy, p: ItemPalette) => ReactElement;

/**
 * Style-system collections (v1, in-house vector art; original Focusling designs).
 * Each collection has its own silhouette language so full Looks read as
 * different styles, not recolours:
 * - Midnight Arcade: angular, pixel-stepped, glowing dots.
 * - Dreamwave: round, glossy, bobbing celestial shapes.
 * - Cloud Racer: sleek, swept, checkered, wind-blown.
 * - Moss Club: soft, organic, lopsided on purpose (controlled asymmetry).
 * Face items stay translucent so the pet's eyes always read through.
 */

/** Crescent moon centred on (x, y). */
const moonPath = (x: number, y: number, r: number) =>
  `M${x + r * 0.35} ${y - r} A${r} ${r} 0 1 0 ${x + r * 0.35} ${y + r} A${r * 1.25} ${r * 1.25} 0 0 1 ${x + r * 0.35} ${y - r} Z`;

/** A small grid of squares, alternating two colours (pixels, checker). */
function Grid({ x, y, cols, rows, size, a, b }: { x: number; y: number; cols: number; rows: number; size: number; a: string; b: string }) {
  const cells: ReactElement[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      cells.push(<Rect key={`${r}-${c}`} x={x + c * size} y={y + r * size} width={size} height={size} fill={(r + c) % 2 === 0 ? a : b} />);
    }
  }
  return <G>{cells}</G>;
}

// ── Midnight Arcade ──────────────────────────────────────────────────────────
// Materials: knit + glossy plastic (beanie), smoked polycarbonate (visor),
// gunmetal chrome with LEDs (collar), glossy plastic (headset, charm).

const MIDNIGHT_ARCADE_ART: Record<string, Art> = {
  'pixel-beanie': ({ headTop: h }, p) => (
    <G>
      {/* Knit crown leaning right: rib lines follow the slouch. */}
      <Path d={`M58 ${h + 20} C56 ${h - 6} 72 ${h - 24} 100 ${h - 26} C130 ${h - 28} 148 ${h - 10} 144 ${h + 18} Z`} fill={p.primary} />
      {[76, 88, 100, 112, 124, 136].map((x, i) => (
        <Path key={x} d={`M${x - 2} ${h + 12} C${x - 1} ${h - 2} ${x + 2 + i} ${h - 12} ${x + 6 + i} ${h - 20 + Math.abs(i - 2.5) * 1.6}`} stroke={p.secondary} strokeWidth={1.4} fill="none" opacity={0.35} />
      ))}
      <Path d={`M120 ${h - 20} C132 ${h - 18} 142 ${h - 6} 144 ${h + 12}`} stroke="#000000" strokeWidth={6} fill="none" opacity={0.12} strokeLinecap="round" />
      {/* Glossy plastic pixel pom. */}
      <Grid x={120} y={h - 38} cols={3} rows={3} size={5.5} a={p.accent} b={p.secondary} />
      <Specular x={124} y={h - 35} rx={2.4} ry={1.2} rotate={0} opacity={0.9} />
      {/* Ribbed knit cuff with a strip of glowing pixels. */}
      <Rect x={54} y={h + 8} width={92} height={17} rx={6} fill={p.secondary} />
      <KnitRibs x={56} y={h + 9} w={88} h={5} color={p.primary} step={4.6} />
      <KnitRibs x={56} y={h + 20} w={88} h={5} color={p.primary} step={4.6} />
      {[64, 76, 88, 100, 112, 124, 136].map((x, i) => (
        <G key={x}>
          <Circle cx={x} cy={h + 16.5} r={4.2} fill={p.accent} opacity={0.22} />
          <Rect x={x - 2.5} y={h + 14} width={5} height={5} fill={i % 2 ? p.accent : '#FFFFFF'} />
        </G>
      ))}
    </G>
  ),
  'arcade-headset': ({ headTop: h, eyeY, headHalfWidth: w, mouthY }, p) => (
    <G>
      <MaterialDefs family="plastic" p={p} />
      <Path d={`M${100 - w + 4} ${eyeY - 8} C${100 - w} ${h - 22} ${100 + w} ${h - 22} ${100 + w - 4} ${eyeY - 8}`} stroke={p.primary} strokeWidth={9} strokeLinecap="round" fill="none" />
      <Streak d={`M${100 - w + 16} ${h - 4} C${100 - 20} ${h - 17} ${100 + 20} ${h - 17} ${100 + w - 16} ${h - 4}`} width={1.8} opacity={0.35} />
      {[-1, 1].map((side) => {
        const cx = 100 + side * w;
        return (
          <G key={side}>
            <Rect x={cx - 13} y={eyeY - 20} width={26} height={38} rx={10} fill={fillFor('plastic', p)} />
            <Rect x={cx - 8} y={eyeY - 13} width={16} height={24} rx={6} fill="none" stroke={p.secondary} strokeWidth={2.5} />
            <Rect x={cx - 3} y={eyeY - 4} width={6} height={6} fill={p.accent} />
            <Specular x={cx - 6} y={eyeY - 15} rx={4} ry={1.8} rotate={0} opacity={0.7} />
          </G>
        );
      })}
      {/* Mic boom from the left cup, stopping beside the mouth (never over it). */}
      <Path d={`M${100 - w + 6} ${eyeY + 14} C${100 - w + 10} ${mouthY + 10} ${74} ${mouthY + 12} ${80} ${mouthY + 4}`} stroke={p.primary} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <Circle cx={80} cy={mouthY + 3} r={4.5} fill={p.accent} />
      <Specular x={78.6} y={mouthY + 1.6} rx={1.4} ry={1} opacity={0.9} />
    </G>
  ),
  'scanline-visor': ({ eyeY, eyeDx, headHalfWidth }, p) => {
    const L = 100 - eyeDx - 26;
    const R = 100 + eyeDx + 26;
    const top = eyeY - 14;
    const bottom = eyeY + 12;
    const shape = `M${L + 8} ${top} L${R - 8} ${top} L${R} ${top + 10} L${R - 6} ${bottom} L108 ${bottom} L100 ${bottom - 6} L92 ${bottom} L${L + 6} ${bottom} L${L} ${top + 10} Z`;
    return (
      <G>
        <Path d={`M${L + 1} ${eyeY - 4} L${100 - headHalfWidth + 2} ${eyeY - 7}`} stroke={p.secondary} strokeWidth={4} strokeLinecap="round" />
        <Path d={`M${R - 1} ${eyeY - 4} L${100 + headHalfWidth - 2} ${eyeY - 7}`} stroke={p.secondary} strokeWidth={4} strokeLinecap="round" />
        {/* Smoked polycarbonate: tinted darker at the top, clearer at the bottom. */}
        <MaterialShape family="smoked" d={shape} p={p} rimWidth={2.6} />
        {[6, 11, 16].map((dy) => (
          <Path key={dy} d={`M${L + 5} ${top + dy} L${R - 5} ${top + dy}`} stroke={p.accent} strokeWidth={1.1} opacity={0.3} />
        ))}
        {/* A sharp diagonal reflection: the "hard glass" cue. */}
        <Path d={`M${R - 30} ${top + 1.5} L${R - 22} ${top + 1.5} L${R - 34} ${bottom - 1} L${R - 42} ${bottom - 1} Z`} fill="#FFFFFF" opacity={0.28} />
        <Streak d={`M${L + 9} ${top + 3.5} L${L + 26} ${top + 3.5}`} width={2} opacity={0.75} />
        <Rect x={L + 9} y={top + 7} width={4} height={4} fill={p.accent} opacity={0.9} />
      </G>
    );
  },
  'tech-collar': ({ neckY: n }, p) => (
    <G>
      {/* Gunmetal chrome band with light-up pixels. */}
      <MaterialDefs family="chrome" p={p} />
      <Path d={`M60 ${n - 8} Q100 ${n + 12} 140 ${n - 8}`} stroke={fillFor('chrome', p)} strokeWidth={11} fill="none" strokeLinecap="round" />
      <Path d={`M60 ${n - 8} Q100 ${n + 12} 140 ${n - 8}`} stroke={p.secondary} strokeWidth={11} fill="none" strokeLinecap="round" opacity={0.35} />
      <Streak d={`M66 ${n - 10} Q100 ${n + 6.5} 134 ${n - 10}`} width={1.6} opacity={0.7} />
      {[
        [72, n - 1],
        [86, n + 3],
        [114, n + 3],
        [128, n - 1],
      ].map(([x, y]) => (
        <G key={x}>
          <Circle cx={x} cy={y} r={5} fill={p.accent} opacity={0.3} />
          <Rect x={x! - 2.5} y={y! - 2.5} width={5} height={5} fill={p.accent} />
        </G>
      ))}
      {/* Centre chip. */}
      <Path d={`M94 ${n - 1} L106 ${n - 1} L110 ${n + 5} L106 ${n + 11} L94 ${n + 11} L90 ${n + 5} Z`} fill={p.secondary} stroke={p.primary} strokeWidth={1.5} />
      <Rect x={97.5} y={n + 2.5} width={5} height={5} fill={p.accent} />
      <Specular x={95.5} y={n + 1} rx={2.4} ry={0.9} rotate={0} opacity={0.6} />
    </G>
  ),
  'dpad-charm': charm((x, y, _s, p) => (
    <G>
      <MaterialDefs family="plastic" p={p} />
      <Rect x={x - 12} y={y - 7} width={24} height={14} rx={7} fill={fillFor('plastic', p)} stroke={p.secondary} strokeWidth={1.6} />
      <Rect x={x - 8.5} y={y - 1.2} width={7} height={2.4} fill={p.secondary} />
      <Rect x={x - 6.2} y={y - 3.5} width={2.4} height={7} fill={p.secondary} />
      <Circle cx={x + 4.5} cy={y - 1} r={1.8} fill={p.accent} />
      <Circle cx={x + 8} cy={y + 1.5} r={1.8} fill="#FF4FD8" />
    </G>
  )),
};

// ── Dreamwave ────────────────────────────────────────────────────────────────
// Materials: glossy plastic band with pearl/holo boppers, fuzzy felt beret,
// pink jelly lenses, real pearls, a pearl moon.

const DREAMWAVE_ART: Record<string, Art> = {
  'crescent-headband': ({ headTop: h }, p) => {
    const moon: ItemPalette = { primary: '#FFC4E1', secondary: p.secondary, accent: '#FFFFFF' };
    return (
      <G>
        <MaterialDefs family="holo" p={moon} />
        <MaterialDefs family="pearl" p={p} />
        {/* Wobbly springs with a pearl star and a holographic moon bobbing on top. */}
        <Path d={`M82 ${h + 6} q-6 -5 0 -9 q6 -5 0 -9 q-6 -5 -2 -9`} stroke={p.secondary} strokeWidth={2.2} fill="none" strokeLinecap="round" />
        <Path d={`M120 ${h + 4} q6 -5 0 -9 q-6 -5 0 -9 q6 -5 3 -10`} stroke={p.secondary} strokeWidth={2.2} fill="none" strokeLinecap="round" />
        <Path d={starPath(79, h - 25, 9)} fill={fillFor('pearl', p)} stroke={p.secondary} strokeWidth={1.8} strokeLinejoin="round" />
        <Path d={moonPath(122, h - 28, 9)} fill={fillFor('holo', moon)} stroke={p.secondary} strokeWidth={1.8} strokeLinejoin="round" />
        <Specular x={119} y={h - 33} rx={2.2} ry={1.2} opacity={0.9} />
        {/* Glossy plastic band: one clean highlight. */}
        {/* A darker outline under the band keeps it readable on lavender pets and in grayscale. */}
        <Path d={`M62 ${h + 24} Q100 ${h - 6} 138 ${h + 24}`} stroke={p.secondary} strokeWidth={9.5} strokeLinecap="round" fill="none" />
        <Path d={`M62 ${h + 24} Q100 ${h - 6} 138 ${h + 24}`} stroke={p.primary} strokeWidth={6} strokeLinecap="round" fill="none" />
        <Streak d={`M70 ${h + 17} Q100 ${h - 4} 128 ${h + 16}`} width={1.8} opacity={0.85} />
      </G>
    );
  },
  'cloud-beret': ({ headTop: h }, p) => {
    const puffs: [number, number, number][] = [
      [78, h + 8, 13],
      [96, h - 2, 18],
      [118, h + 2, 16],
      [133, h + 12, 9],
    ];
    return (
      <G transform={`rotate(-8 100 ${h + 10})`}>
        {/* Soft felt: a fuzzy outline (dotted strokes drawn under the fills). */}
        <Ellipse cx={100} cy={h + 18} rx={40} ry={6.5} fill={p.secondary} />
        {puffs.map(([x, y, r]) => (
          <Circle key={x} cx={x} cy={y} r={r + 0.6} fill="none" stroke={p.secondary} strokeWidth={3.4} strokeDasharray="0.1 3.4" strokeLinecap="round" />
        ))}
        {puffs.map(([x, y, r]) => (
          <Circle key={`f${x}`} cx={x} cy={y} r={r} fill={p.primary} />
        ))}
        <Rect x={70} y={h + 4} width={64} height={14} fill={p.primary} />
        <Path d={`M104 ${h - 16} C118 ${h - 14} 128 ${h - 4} 128 ${h + 6}`} stroke={p.secondary} strokeWidth={5} fill="none" opacity={0.18} strokeLinecap="round" />
        <Circle cx={98} cy={h - 21} r={3.5} fill={p.secondary} />
        <Circle cx={124} cy={h + 8} r={2.4} fill={p.accent} />
      </G>
    );
  },
  'heart-shades': ({ eyeY, eyeDx, headHalfWidth }, p) => (
    <G>
      <Path d={`M${100 - eyeDx - 15} ${eyeY - 5} L${100 - headHalfWidth + 3} ${eyeY - 8}`} stroke={p.secondary} strokeWidth={3} strokeLinecap="round" />
      <Path d={`M${100 + eyeDx + 15} ${eyeY - 5} L${100 + headHalfWidth - 3} ${eyeY - 8}`} stroke={p.secondary} strokeWidth={3} strokeLinecap="round" />
      <Path d={`M${100 - eyeDx + 9} ${eyeY - 3} Q100 ${eyeY - 9} ${100 + eyeDx - 9} ${eyeY - 3}`} stroke={p.secondary} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      {[100 - eyeDx, 100 + eyeDx].map((x) => (
        <G key={x}>
          {/* Jelly lenses: gradient, rim, a soft blob highlight and a glint. */}
          <MaterialShape family="jelly" d={heartPath(x, eyeY + 1, 15)} p={p} rimWidth={2.6} />
          <Specular x={x - 6} y={eyeY - 6} rx={4.6} ry={2.2} rotate={-30} />
          <Specular x={x + 6} y={eyeY + 5} rx={1.4} ry={1.4} rotate={0} opacity={0.8} />
        </G>
      ))}
    </G>
  ),
  'pearl-collar': ({ neckY: n }, p) => {
    const pearls: ReactElement[] = [];
    for (let i = 0; i <= 10; i += 1) {
      const t = i / 10;
      const x = 64 + t * 72;
      const y = n - 6 + 4 * 11 * t * (1 - t);
      pearls.push(
        <G key={i}>
          {/* Real pearl: white core, tinted edge, iridescent sheen, pin-point glint. */}
          <Circle cx={x} cy={y} r={4.5} fill={fillFor('pearl', p)} stroke={p.secondary} strokeWidth={0.8} />
          <Circle cx={x} cy={y} r={4.5} fill={`url(#${materialId('pearl', p)}-sheen)`} />
          <Circle cx={x - 1.5} cy={y - 1.6} r={1.1} fill="#FFFFFF" />
        </G>,
      );
    }
    return (
      <G>
        <MaterialDefs family="pearl" p={p} />
        {pearls}
        {/* Satin bow off to one side (asymmetry). */}
        <Path d={`M72 ${n - 2} L60 ${n - 10} L60 ${n + 6} Z`} fill={p.accent} stroke="#E07BB0" strokeWidth={1.2} strokeLinejoin="round" />
        <Path d={`M72 ${n - 2} L84 ${n - 10} L84 ${n + 6} Z`} fill={p.accent} stroke="#E07BB0" strokeWidth={1.2} strokeLinejoin="round" />
        <Path d={`M62 ${n - 6} L70 ${n - 2.5}`} stroke="#FFFFFF" strokeWidth={1.4} opacity={0.8} strokeLinecap="round" />
        <Circle cx={72} cy={n - 2} r={3.4} fill="#E07BB0" />
      </G>
    );
  },
  'moon-charm': charm(
    (x, y, s, p) => (
      <G>
        <MaterialDefs family="pearl" p={p} />
        <Path d={moonPath(x - 1, y, s + 1)} fill={fillFor('pearl', p)} stroke={p.secondary} strokeWidth={1.8} strokeLinejoin="round" />
        <Path d={moonPath(x - 1, y, s + 1)} fill={`url(#${materialId('pearl', p)}-sheen)`} />
        <Path d={starPath(x + 6, y - 5, 3.6)} fill={p.accent} />
        <Circle cx={x - 5} cy={y - 4} r={1.2} fill="#FFFFFF" />
      </G>
    ),
    { gloss: false },
  ),
};

// ── Cloud Racer ──────────────────────────────────────────────────────────────
// Materials: stitched fabric (cap, scarf), chrome + glass (goggles), mirrored
// holographic lens on a chrome bar (shades), satin ribbon (rosette).

const CLOUD_RACER_ART: Record<string, Art> = {
  'racing-cap': ({ headTop: h }, p) => (
    <G>
      <Path d={`M58 ${h + 22} C58 ${h - 16} 142 ${h - 16} 142 ${h + 22} Z`} fill={p.primary} />
      {/* A soft seam outline so a cream cap still reads against a cream background. */}
      <Path d={`M58 ${h + 22} C58 ${h - 16} 142 ${h - 16} 142 ${h + 22}`} stroke="#000000" strokeWidth={1.6} fill="none" opacity={0.16} />
      <Path d={`M120 ${h - 4} C134 ${h} 142 ${h + 10} 142 ${h + 22} L126 ${h + 22} C126 ${h + 10} 124 ${h + 2} 120 ${h - 4} Z`} fill="#000000" opacity={0.1} />
      {/* Racing stripe front to back, stitched on. */}
      <Path d={`M94 ${h - 6} Q100 ${h - 7.5} 106 ${h - 6} L112 ${h + 22} L88 ${h + 22} Z`} fill={p.secondary} />
      <Path d={`M98.5 ${h - 7} L101.5 ${h - 7} L103 ${h + 22} L97 ${h + 22} Z`} fill={p.primary} opacity={0.9} />
      <Stitch d={`M92.5 ${h - 3} L86.5 ${h + 21}`} color={p.primary} width={1} />
      <Stitch d={`M107.5 ${h - 3} L113.5 ${h + 21}`} color={p.primary} width={1} />
      {/* Checker panel and a winged-cloud patch (original mark). */}
      <Grid x={64} y={h + 5} cols={3} rows={2} size={5} a="#2A2A33" b="#FFFFFF" />
      <Path d={`M120 ${h + 12} C120 ${h + 6} 127 ${h + 4} 130 ${h + 8} C132 ${h + 4} 138 ${h + 6} 137 ${h + 12} Z`} fill={p.secondary} />
      <Path d={`M117 ${h + 8} L112 ${h + 6} M117 ${h + 11} L111 ${h + 11}`} stroke={p.secondary} strokeWidth={1.6} strokeLinecap="round" />
      <Path d={`M44 ${h + 25} Q100 ${h + 12} 156 ${h + 25} Q100 ${h + 37} 44 ${h + 25} Z`} fill={p.accent} />
      <Stitch d={`M50 ${h + 26} Q100 ${h + 17} 150 ${h + 26}`} color="#FFFFFF" />
      <Circle cx={100} cy={h - 7} r={4} fill={p.secondary} />
    </G>
  ),
  'racer-goggles': ({ headTop: h, headHalfWidth: w }, p) => {
    const glass: ItemPalette = { primary: p.secondary, secondary: '#8A3A12', accent: '#FFE3C8', opacity: p.opacity ?? 0.72 };
    const metal: ItemPalette = { primary: '#B8C0CC', secondary: '#4A5160', accent: '#FFFFFF' };
    return (
      <G>
        <MaterialDefs family="chrome" p={metal} />
        {/* Fabric strap, pushed up on the forehead: the eyes stay completely clear. */}
        <Path d={`M${100 - w + 4} ${h + 26} Q100 ${h + 8} ${100 + w - 4} ${h + 26}`} stroke={p.primary} strokeWidth={6} strokeLinecap="round" fill="none" />
        <Stitch d={`M${100 - w + 8} ${h + 23.5} Q100 ${h + 6} ${100 + w - 8} ${h + 23.5}`} color="#FFFFFF" width={0.9} />
        {[84, 116].map((x) => (
          <G key={x}>
            {/* Glass lens + two reflection streaks, inside a chrome ring. */}
            <MaterialShape family="jelly" d={`M${x - 11} ${h + 14} A11 11 0 1 0 ${x + 11} ${h + 14} A11 11 0 1 0 ${x - 11} ${h + 14} Z`} p={glass} rim={false} />
            <Path d={`M${x - 7} ${h + 18} L${x + 1} ${h + 6}`} stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" opacity={0.75} />
            <Path d={`M${x - 2} ${h + 21} L${x + 5} ${h + 11}`} stroke="#FFFFFF" strokeWidth={1.2} strokeLinecap="round" opacity={0.6} />
            <Circle cx={x} cy={h + 14} r={12} fill="none" stroke={fillFor('chrome', metal)} strokeWidth={4.5} />
          </G>
        ))}
        <Rect x={95} y={h + 11} width={10} height={5} rx={2} fill={fillFor('chrome', metal)} stroke="#4A5160" strokeWidth={0.8} />
      </G>
    );
  },
  'aero-shades': ({ eyeY, eyeDx, headHalfWidth }, p) => {
    const L = 100 - eyeDx - 27;
    const R = 100 + eyeDx + 27;
    const lens = `M${L} ${eyeY - 6} Q100 ${eyeY - 16} ${R} ${eyeY - 6} L${R - 5} ${eyeY + 6} Q100 ${eyeY + 13} ${L + 5} ${eyeY + 6} Z`;
    const metal: ItemPalette = { primary: '#C7CDD6', secondary: p.secondary, accent: '#FFFFFF' };
    return (
      <G>
        <MaterialDefs family="chrome" p={metal} />
        <Path d={`M${L} ${eyeY - 6} L${100 - headHalfWidth + 2} ${eyeY - 9}`} stroke={p.secondary} strokeWidth={3.5} strokeLinecap="round" />
        <Path d={`M${R} ${eyeY - 6} L${100 + headHalfWidth - 2} ${eyeY - 9}`} stroke={p.secondary} strokeWidth={3.5} strokeLinecap="round" />
        {/* Mirrored lens: a restrained holographic sheen, still see-through. */}
        <MaterialShape family="holo" d={lens} p={p} opacity={p.opacity ?? 0.62} rimWidth={2.2} />
        <Path d={`M${L} ${eyeY - 6} Q100 ${eyeY - 16} ${R} ${eyeY - 6}`} stroke={fillFor('chrome', metal)} strokeWidth={3.6} fill="none" strokeLinecap="round" />
        {/* Speed stripe. */}
        <Path d={`M${L + 10} ${eyeY + 3} L${L + 24} ${eyeY - 9} L${L + 30} ${eyeY - 9} L${L + 16} ${eyeY + 4} Z`} fill={p.accent} opacity={0.85} />
        <Streak d={`M${R - 22} ${eyeY - 7} L${R - 10} ${eyeY - 7}`} width={1.8} opacity={0.8} />
      </G>
    );
  },
  'racing-scarf': ({ neckY: n }, p) => (
    <G>
      {/* Fabric: a matte wrap tied in a side knot, tails blowing right, folds and a stitched hem. */}
      <Path d={`M126 ${n} C140 ${n - 2} 150 ${n + 8} 164 ${n + 4} L166 ${n + 14} C150 ${n + 20} 140 ${n + 12} 128 ${n + 10} Z`} fill={p.primary} />
      <Path d={`M124 ${n + 4} C132 ${n + 14} 140 ${n + 24} 154 ${n + 26} L150 ${n + 35} C136 ${n + 34} 128 ${n + 22} 120 ${n + 10} Z`} fill={p.primary} />
      <Path d={`M132 ${n + 5} C142 ${n + 6} 150 ${n + 11} 160 ${n + 9}`} stroke="#000000" strokeWidth={1.4} fill="none" opacity={0.18} />
      <Path d={`M128 ${n + 14} C134 ${n + 22} 140 ${n + 27} 148 ${n + 29}`} stroke="#000000" strokeWidth={1.4} fill="none" opacity={0.18} />
      <Grid x={160} y={n + 3} cols={2} rows={2} size={5} a={p.accent} b={p.secondary} />
      <Grid x={146} y={n + 25} cols={2} rows={2} size={5} a={p.accent} b={p.secondary} />
      <Path d={`M60 ${n - 8} Q100 ${n + 12} 140 ${n - 8}`} stroke={p.primary} strokeWidth={13} fill="none" strokeLinecap="round" />
      <Path d={`M70 ${n - 4} Q98 ${n + 8} 120 ${n - 1}`} stroke="#000000" strokeWidth={2} fill="none" opacity={0.12} />
      <Stitch d={`M62 ${n - 2.5} Q100 ${n + 16.5} 138 ${n - 2.5}`} color={p.secondary} />
      <Circle cx={126} cy={n + 2} r={7.5} fill={p.primary} />
      <Path d={`M121 ${n + 1} C124 ${n - 3} 130 ${n - 2} 131 ${n + 3}`} stroke="#000000" strokeWidth={1.4} fill="none" opacity={0.2} />
    </G>
  ),
  'winner-rosette': charm((x, y, s, p) => (
    <G>
      {/* Satin ribbon tails with a fold line, a pleated ring, an enamel centre. */}
      <Path d={`M${x - 4} ${y + 4} L${x - 8} ${y + 16} L${x - 4} ${y + 13} L${x - 1} ${y + 17} L${x} ${y + 5} Z`} fill={p.secondary} />
      <Path d={`M${x + 4} ${y + 4} L${x + 8} ${y + 16} L${x + 4} ${y + 13} L${x + 1} ${y + 17} L${x} ${y + 5} Z`} fill={p.secondary} />
      <Path d={`M${x - 3} ${y + 7} L${x - 5.5} ${y + 14}`} stroke="#FFFFFF" strokeWidth={0.9} opacity={0.6} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <Circle key={i} cx={x + Math.cos(a) * s} cy={y + Math.sin(a) * s} r={2.8} fill={p.primary} opacity={i % 2 ? 0.8 : 1} />;
      })}
      <Circle cx={x} cy={y} r={s} fill={p.primary} />
      <Circle cx={x} cy={y} r={s * 0.62} fill={p.accent} />
      <Path d={starPath(x, y, s * 0.45)} fill={p.secondary} />
    </G>
  )),
};

// ── Moss Club ────────────────────────────────────────────────────────────────
// Materials: knit (beanie), wood + amber jelly (specs), fuzzy (scarf), canvas
// fabric (satchel), carved wood (toadstool), glossy enamel (ladybug).
// Controlled asymmetry: one detail per piece sits off-centre (leaf on the left,
// long scarf tail on the left, satchel on the right hip, pin right of centre),
// while the face stays symmetric and clear.

const LEAF = '#9CC46E';

/** A leaf pointing up-right from (x, y). */
const leafPath = (x: number, y: number, len: number) =>
  `M${x} ${y} C${x + len * 0.1} ${y - len * 0.55} ${x + len * 0.55} ${y - len * 0.95} ${x + len} ${y - len} C${x + len * 0.95} ${y - len * 0.5} ${x + len * 0.55} ${y - len * 0.05} ${x} ${y} Z`;

const MOSS_CLUB_ART: Record<string, Art> = {
  'leaf-beanie': ({ headTop: h }, p) => (
    <G>
      {/* Rounded knit crown with vertical ribs (a clean opening lets a sprout or flame through). */}
      <Path d={`M58 ${h + 18} C56 ${h - 8} 76 ${h - 22} 100 ${h - 22} C124 ${h - 22} 144 ${h - 8} 142 ${h + 18} Z`} fill={p.primary} />
      {[70, 80, 90, 110, 120, 130].map((x) => (
        <Path key={x} d={`M${x} ${h + 12} C${x + (x - 100) * 0.05} ${h} ${x + (x - 100) * 0.12} ${h - 10} ${100 + (x - 100) * 0.7} ${h - 18}`} stroke={p.secondary} strokeWidth={1.3} fill="none" opacity={0.3} />
      ))}
      <Path d={`M126 ${h - 14} C136 ${h - 8} 142 ${h + 2} 142 ${h + 14}`} stroke="#000000" strokeWidth={6} fill="none" opacity={0.1} strokeLinecap="round" />
      {/* Folded, ribbed cuff. */}
      <Rect x={54} y={h + 8} width={92} height={16} rx={7} fill={p.secondary} />
      <KnitRibs x={57} y={h + 9} w={86} h={5} color={p.primary} step={4.8} />
      <KnitRibs x={57} y={h + 18} w={86} h={5} color={p.primary} step={4.8} />
      {/* Off-centre felt leaf, stitched on. */}
      <G transform={`rotate(-18 72 ${h + 8})`}>
        <Path d={leafPath(64, h + 12, 22)} fill={LEAF} />
        <Path d={`M64 ${h + 12} C72 ${h + 4} 78 ${h - 2} 84 ${h - 8}`} stroke={p.secondary} strokeWidth={1.2} fill="none" opacity={0.6} />
        <Stitch d={leafPath(65.5, h + 10.5, 19)} color={p.accent} width={0.9} />
      </G>
      {/* A tiny wooden toggle on the other side. */}
      <Rect x={128} y={h + 12} width={9} height={5} rx={2.5} fill="#A9744F" />
      <Path d={`M129.5 ${h + 14.5} L135.5 ${h + 14.5}`} stroke="#6B4630" strokeWidth={0.7} opacity={0.6} />
    </G>
  ),
  'acorn-specs': ({ eyeY, eyeDx, headHalfWidth }, p) => {
    const wood = p.secondary;
    return (
      <G>
        <Path d={`M${100 - eyeDx - 15} ${eyeY - 3} L${100 - headHalfWidth + 2} ${eyeY - 7}`} stroke={wood} strokeWidth={3.2} strokeLinecap="round" />
        <Path d={`M${100 + eyeDx + 15} ${eyeY - 3} L${100 + headHalfWidth - 2} ${eyeY - 7}`} stroke={wood} strokeWidth={3.2} strokeLinecap="round" />
        {[-1, 1].map((side) => {
          const x = 100 + side * eyeDx;
          const ring = `M${x - 14} ${eyeY} A14 14 0 1 0 ${x + 14} ${eyeY} A14 14 0 1 0 ${x - 14} ${eyeY} Z`;
          return (
            <G key={side}>
              {/* Warm amber jelly lens: eyes glow through. */}
              <MaterialShape family="jelly" d={ring} p={p} rim={false} />
              <Specular x={x - 6} y={eyeY - 7} rx={4} ry={1.8} opacity={0.75} />
              {/* Turned-wood frame with grain. */}
              <Circle cx={x} cy={eyeY} r={14} fill="none" stroke={wood} strokeWidth={4.4} />
              <Path d={`M${x - 11} ${eyeY - 9} A14 14 0 0 1 ${x + 2} ${eyeY - 14}`} stroke="#E3B98E" strokeWidth={1} fill="none" opacity={0.8} />
              <Path d={`M${x + 8} ${eyeY + 11} A14 14 0 0 0 ${x + 13} ${eyeY + 4}`} stroke="#6B4630" strokeWidth={1} fill="none" opacity={0.7} />
            </G>
          );
        })}
        <Path d={`M${100 - eyeDx + 13} ${eyeY - 3} Q100 ${eyeY - 9} ${100 + eyeDx - 13} ${eyeY - 3}`} stroke={wood} strokeWidth={3.4} fill="none" strokeLinecap="round" />
        {/* A tiny acorn cap perched on one frame. */}
        <Path d={`M${100 - eyeDx - 12} ${eyeY - 12} C${100 - eyeDx - 12} ${eyeY - 19} ${100 - eyeDx - 2} ${eyeY - 19} ${100 - eyeDx - 2} ${eyeY - 12} Z`} fill="#6B4630" />
        <Path d={`M${100 - eyeDx - 7} ${eyeY - 18} L${100 - eyeDx - 6} ${eyeY - 21}`} stroke="#6B4630" strokeWidth={1.6} strokeLinecap="round" />
      </G>
    );
  },
  'moss-scarf': ({ neckY: n }, p) => {
    const tail = `M70 ${n - 2} C66 ${n + 8} 62 ${n + 18} 63 ${n + 28} L78 ${n + 30} C78 ${n + 20} 80 ${n + 10} 85 ${n + 2} Z`;
    const nub = `M121 ${n + 2} C127 ${n + 8} 131 ${n + 13} 135 ${n + 17} L141 ${n + 11} C137 ${n + 7} 132 ${n + 2} 128 ${n - 2} Z`;
    return (
      <G>
        {/* Fuzzy: soft fill with a bumpy dotted outline, no hard edges. */}
        <Path d={nub} fill={p.primary} />
        <FuzzEdge d={nub} color={p.primary} width={4.4} />
        <Path d={tail} fill={p.primary} />
        <FuzzEdge d={tail} color={p.primary} width={4.4} />
        <Path d={`M63.5 ${n + 22} L78.5 ${n + 24}`} stroke={p.accent} strokeWidth={3} opacity={0.9} />
        {[64, 68, 72, 76].map((x) => (
          <Path key={x} d={`M${x} ${n + 30} L${x - 0.6} ${n + 34}`} stroke={p.secondary} strokeWidth={1.8} strokeLinecap="round" />
        ))}
        <Path d={`M60 ${n - 8} Q100 ${n + 12} 140 ${n - 8}`} stroke={p.primary} strokeWidth={14} fill="none" strokeLinecap="round" />
        <FuzzEdge d={`M60 ${n - 15} Q100 ${n + 5} 140 ${n - 15}`} color={p.primary} />
        <FuzzEdge d={`M61 ${n - 1} Q100 ${n + 19} 139 ${n - 1}`} color={p.primary} />
        {/* Moss flecks. */}
        {[
          [72, n - 5],
          [88, n + 1],
          [106, n + 3],
          [124, n - 1],
          [69, n + 14],
          [74, n + 7],
        ].map(([x, y]) => (
          <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.3} fill={p.secondary} opacity={0.55} />
        ))}
      </G>
    );
  },
  'acorn-satchel': ({ neckY: n }, p) => (
    <G>
      {/* Canvas cross-body strap, stitched. It crosses the charm spot (hence excludes: charm). */}
      <Path d={`M64 ${n - 6} L128 ${n + 20}`} stroke={p.secondary} strokeWidth={5.5} strokeLinecap="round" />
      <Stitch d={`M65 ${n - 6} L127 ${n + 19}`} color={p.accent} width={0.9} />
      {/* The satchel rides on the right hip. */}
      <Rect x={120} y={n + 14} width={28} height={22} rx={8} fill={p.primary} />
      <Stitch d={`M123 ${n + 22} L123 ${n + 32} Q123 ${n + 34} 125 ${n + 34} L143 ${n + 34} Q145 ${n + 34} 145 ${n + 32} L145 ${n + 22}`} color={p.accent} width={0.9} />
      {/* Acorn-cap flap with a woven texture. */}
      <Path d={`M118 ${n + 24} C118 ${n + 12} 150 ${n + 12} 150 ${n + 24} Z`} fill={p.secondary} />
      <Grain lines={[`M123 ${n + 21} L127 ${n + 16}`, `M129 ${n + 22} L134 ${n + 15}`, `M136 ${n + 22} L141 ${n + 15.5}`, `M142 ${n + 22} L146 ${n + 18}`]} color={p.accent} />
      <Circle cx={134} cy={n + 25} r={2.6} fill={p.accent} />
      <Specular x={133.2} y={n + 24.2} rx={1} ry={0.6} opacity={0.9} />
    </G>
  ),
  'toadstool-charm': charm(
    (x, y, _s, p) => (
      <G>
        {/* Carved wood: matte, grain on the stem, a small varnish glint. */}
        <Path d={`M${x - 4} ${y} L${x - 4.6} ${y + 9} Q${x} ${y + 11} ${x + 4.6} ${y + 9} L${x + 4} ${y} Z`} fill={p.secondary} />
        <Grain lines={[`M${x - 2} ${y + 2} C${x - 2.6} ${y + 5} ${x - 1.6} ${y + 7} ${x - 2.2} ${y + 9}`, `M${x + 1.6} ${y + 2} C${x + 1} ${y + 5} ${x + 2} ${y + 7} ${x + 1.4} ${y + 9.4}`]} color={p.accent} />
        <Path d={`M${x - 11} ${y + 1} C${x - 11} ${y - 11} ${x + 11} ${y - 11} ${x + 11} ${y + 1} Q${x} ${y + 3.5} ${x - 11} ${y + 1} Z`} fill={p.primary} />
        <Circle cx={x - 5} cy={y - 3} r={2} fill={p.secondary} />
        <Circle cx={x + 2} cy={y - 6} r={1.6} fill={p.secondary} />
        <Circle cx={x + 6} cy={y - 1} r={1.3} fill={p.secondary} />
        <Path d={`M${x - 7} ${y - 6} Q${x - 4} ${y - 8.5} ${x - 1} ${y - 8.6}`} stroke="#FFFFFF" strokeWidth={1.1} fill="none" strokeLinecap="round" opacity={0.5} />
      </G>
    ),
    { gloss: false },
  ),
  'ladybug-pin': ({ neckY: n }, p) => {
    const x = 118;
    const y = n + 8;
    return (
      <G transform={`rotate(18 ${x} ${y})`}>
        {/* Glossy enamel pin, deliberately off-centre. */}
        <MaterialDefs family="plastic" p={p} />
        <Circle cx={x} cy={y - 7.5} r={4} fill={p.secondary} />
        <Ellipse cx={x} cy={y} rx={7.5} ry={8.2} fill={fillFor('plastic', p)} stroke={p.secondary} strokeWidth={1.2} />
        <Path d={`M${x} ${y - 7.5} L${x} ${y + 8}`} stroke={p.secondary} strokeWidth={1.2} />
        <Circle cx={x - 3.6} cy={y - 1.5} r={1.6} fill={p.secondary} />
        <Circle cx={x + 3.8} cy={y + 2} r={1.6} fill={p.secondary} />
        <Circle cx={x - 3} cy={y + 4.4} r={1.2} fill={p.secondary} />
        <Specular x={x - 3.2} y={y - 4.4} rx={2.2} ry={1.1} opacity={0.9} />
      </G>
    );
  },
};

export const STYLE_ART: Record<string, Art> = { ...MIDNIGHT_ARCADE_ART, ...DREAMWAVE_ART, ...CLOUD_RACER_ART, ...MOSS_CLUB_ART };

/** Icon crops (Cloudling anatomy) so wardrobe tiles reuse the worn artwork. */
export const STYLE_ICON_VIEWBOX: Record<string, string> = {
  'pixel-beanie': '48 20 106 76',
  'arcade-headset': '26 36 148 110',
  'scanline-visor': '48 90 104 40',
  'tech-collar': '52 144 96 34',
  'dpad-charm': '80 148 40 36',
  'crescent-headband': '54 22 94 72',
  'cloud-beret': '54 36 96 56',
  'heart-shades': '48 88 104 44',
  'pearl-collar': '54 142 92 36',
  'moon-charm': '80 148 40 36',
  'racing-cap': '40 44 120 64',
  'racer-goggles': '40 62 120 38',
  'aero-shades': '46 90 108 34',
  'racing-scarf': '52 140 120 60',
  'winner-rosette': '78 148 44 44',
  'leaf-beanie': '50 36 100 58',
  'acorn-specs': '40 88 120 40',
  'moss-scarf': '52 140 100 62',
  'acorn-satchel': '58 146 96 52',
  'toadstool-charm': '80 148 40 36',
  'ladybug-pin': '102 150 32 32',
};
