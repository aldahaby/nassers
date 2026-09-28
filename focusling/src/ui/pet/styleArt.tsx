import type { ReactElement } from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { ItemPalette } from '@/core';
import type { PetAnatomy } from './anatomy';
import { charm, heartPath, starPath } from './focusClubArt';

type Art = (a: PetAnatomy, p: ItemPalette) => ReactElement;

/**
 * Style-system collections (v1, in-house vector art; original Focusling designs).
 * Each collection has its own silhouette language so full Looks read as
 * different styles, not recolours:
 * - Midnight Arcade: angular, pixel-stepped, glowing dots.
 * - Dreamwave: round, glossy, bobbing celestial shapes.
 * - Cloud Racer: sleek, swept, checkered, wind-blown.
 * Face items stay translucent so the pet's eyes always read through.
 */

/** Crescent moon centred on (x, y). */
const moonPath = (x: number, y: number, r: number) =>
  `M${x + r * 0.35} ${y - r} A${r} ${r} 0 1 0 ${x + r * 0.35} ${y + r} A${r * 0.78} ${r * 0.78} 0 1 1 ${x + r * 0.35} ${y - r} Z`;

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

const MIDNIGHT_ARCADE_ART: Record<string, Art> = {
  'pixel-beanie': ({ headTop: h }, p) => (
    <G>
      {/* Slouchy crown leaning right, with a pixel pom. */}
      <Path d={`M58 ${h + 20} C56 ${h - 6} 72 ${h - 24} 100 ${h - 26} C130 ${h - 28} 148 ${h - 10} 144 ${h + 18} Z`} fill={p.primary} />
      <Path d={`M84 ${h - 20} C92 ${h - 8} 92 ${h + 6} 90 ${h + 12}`} stroke={p.secondary} strokeWidth={2} fill="none" opacity={0.55} />
      <Path d={`M112 ${h - 23} C118 ${h - 10} 118 ${h + 4} 116 ${h + 12}`} stroke={p.secondary} strokeWidth={2} fill="none" opacity={0.55} />
      <Grid x={120} y={h - 38} cols={3} rows={3} size={5.5} a={p.accent} b={p.secondary} />
      {/* Cuff with a strip of glowing pixels. */}
      <Rect x={54} y={h + 8} width={92} height={17} rx={6} fill={p.secondary} />
      {[64, 76, 88, 100, 112, 124, 136].map((x, i) => (
        <Rect key={x} x={x - 2.5} y={h + 14} width={5} height={5} fill={i % 2 ? p.accent : '#FFFFFF'} opacity={0.95} />
      ))}
    </G>
  ),
  'arcade-headset': ({ headTop: h, eyeY, headHalfWidth: w, mouthY }, p) => (
    <G>
      <Path d={`M${100 - w + 4} ${eyeY - 8} C${100 - w} ${h - 22} ${100 + w} ${h - 22} ${100 + w - 4} ${eyeY - 8}`} stroke={p.primary} strokeWidth={9} strokeLinecap="round" fill="none" />
      <Path d={`M${100 - w + 14} ${h - 2} C${100 - 20} ${h - 16} ${100 + 20} ${h - 16} ${100 + w - 14} ${h - 2}`} stroke={p.secondary} strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={0.8} />
      {[-1, 1].map((side) => {
        const cx = 100 + side * w;
        return (
          <G key={side}>
            <Rect x={cx - 13} y={eyeY - 20} width={26} height={38} rx={10} fill={p.primary} />
            <Rect x={cx - 8} y={eyeY - 13} width={16} height={24} rx={6} fill="none" stroke={p.secondary} strokeWidth={2.5} />
            <Rect x={cx - 3} y={eyeY - 4} width={6} height={6} fill={p.accent} />
          </G>
        );
      })}
      {/* Mic boom from the left cup, stopping beside the mouth (never over it). */}
      <Path d={`M${100 - w + 6} ${eyeY + 14} C${100 - w + 10} ${mouthY + 10} ${74} ${mouthY + 12} ${80} ${mouthY + 4}`} stroke={p.primary} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <Circle cx={80} cy={mouthY + 3} r={4.5} fill={p.accent} />
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
        <Path d={shape} fill={p.primary} opacity={p.opacity ?? 0.5} />
        {[5, 10, 15, 20].map((dy) => (
          <Path key={dy} d={`M${L + 5} ${top + dy} L${R - 5} ${top + dy}`} stroke={p.accent} strokeWidth={1.3} opacity={0.4} />
        ))}
        <Path d={shape} fill="none" stroke={p.secondary} strokeWidth={2.6} strokeLinejoin="round" />
        <Rect x={L + 9} y={top + 3} width={5} height={5} fill={p.accent} opacity={0.95} />
        <Rect x={L + 16} y={top + 3} width={3} height={3} fill={p.accent} opacity={0.8} />
      </G>
    );
  },
  'tech-collar': ({ neckY: n }, p) => (
    <G>
      <Path d={`M60 ${n - 8} Q100 ${n + 12} 140 ${n - 8}`} stroke={p.primary} strokeWidth={11} fill="none" strokeLinecap="round" />
      <Path d={`M62 ${n - 4} Q100 ${n + 15} 138 ${n - 4}`} stroke={p.secondary} strokeWidth={1.6} fill="none" />
      {[
        [72, n - 1],
        [86, n + 3],
        [114, n + 3],
        [128, n - 1],
      ].map(([x, y]) => (
        <G key={x}>
          <Circle cx={x} cy={y} r={5} fill={p.accent} opacity={0.25} />
          <Rect x={x! - 2.5} y={y! - 2.5} width={5} height={5} fill={p.accent} />
        </G>
      ))}
      {/* Centre chip. */}
      <Path d={`M94 ${n - 1} L106 ${n - 1} L110 ${n + 5} L106 ${n + 11} L94 ${n + 11} L90 ${n + 5} Z`} fill={p.secondary} stroke={p.primary} strokeWidth={1.5} />
      <Rect x={97.5} y={n + 2.5} width={5} height={5} fill={p.accent} />
    </G>
  ),
  'dpad-charm': charm((x, y, _s, p) => (
    <G>
      <Rect x={x - 12} y={y - 7} width={24} height={14} rx={7} fill={p.primary} stroke={p.secondary} strokeWidth={1.6} />
      <Rect x={x - 8.5} y={y - 1.2} width={7} height={2.4} fill={p.secondary} />
      <Rect x={x - 6.2} y={y - 3.5} width={2.4} height={7} fill={p.secondary} />
      <Circle cx={x + 4.5} cy={y - 1} r={1.8} fill={p.accent} />
      <Circle cx={x + 8} cy={y + 1.5} r={1.8} fill="#FF4FD8" />
    </G>
  )),
};

// ── Dreamwave ────────────────────────────────────────────────────────────────

const DREAMWAVE_ART: Record<string, Art> = {
  'crescent-headband': ({ headTop: h }, p) => (
    <G>
      {/* Wobbly springs with a star and a moon bobbing on top. */}
      <Path d={`M82 ${h + 6} q-6 -5 0 -9 q6 -5 0 -9 q-6 -5 -2 -9`} stroke={p.secondary} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <Path d={`M120 ${h + 4} q6 -5 0 -9 q-6 -5 0 -9 q6 -5 3 -10`} stroke={p.secondary} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <Path d={starPath(79, h - 25, 9)} fill={p.accent} stroke={p.secondary} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d={moonPath(122, h - 28, 9)} fill="#FFC4E1" stroke={p.secondary} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d={`M62 ${h + 24} Q100 ${h - 6} 138 ${h + 24}`} stroke={p.primary} strokeWidth={7} strokeLinecap="round" fill="none" />
      <Path d={`M66 ${h + 21} Q100 ${h - 6} 134 ${h + 21}`} stroke={p.accent} strokeWidth={1.8} strokeLinecap="round" fill="none" opacity={0.8} />
    </G>
  ),
  'cloud-beret': ({ headTop: h }, p) => (
    <G transform={`rotate(-8 100 ${h + 10})`}>
      <Ellipse cx={100} cy={h + 18} rx={40} ry={6.5} fill={p.secondary} />
      <Circle cx={78} cy={h + 8} r={13} fill={p.primary} stroke={p.secondary} strokeWidth={1.5} />
      <Circle cx={96} cy={h - 2} r={18} fill={p.primary} stroke={p.secondary} strokeWidth={1.5} />
      <Circle cx={118} cy={h + 2} r={16} fill={p.primary} stroke={p.secondary} strokeWidth={1.5} />
      <Circle cx={133} cy={h + 12} r={9} fill={p.primary} stroke={p.secondary} strokeWidth={1.5} />
      <Rect x={70} y={h + 4} width={64} height={14} fill={p.primary} />
      <Circle cx={98} cy={h - 21} r={3.5} fill={p.secondary} />
      <Circle cx={90} cy={h - 8} r={3} fill="#FFFFFF" opacity={0.9} />
      <Circle cx={124} cy={h + 8} r={2.4} fill={p.accent} />
    </G>
  ),
  'heart-shades': ({ eyeY, eyeDx, headHalfWidth }, p) => (
    <G>
      <Path d={`M${100 - eyeDx - 15} ${eyeY - 5} L${100 - headHalfWidth + 3} ${eyeY - 8}`} stroke={p.secondary} strokeWidth={3} strokeLinecap="round" />
      <Path d={`M${100 + eyeDx + 15} ${eyeY - 5} L${100 + headHalfWidth - 3} ${eyeY - 8}`} stroke={p.secondary} strokeWidth={3} strokeLinecap="round" />
      <Path d={`M${100 - eyeDx + 9} ${eyeY - 3} Q100 ${eyeY - 9} ${100 + eyeDx - 9} ${eyeY - 3}`} stroke={p.secondary} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      {[100 - eyeDx, 100 + eyeDx].map((x) => (
        <G key={x}>
          <Path d={heartPath(x, eyeY + 1, 15)} fill={p.primary} opacity={p.opacity ?? 0.62} />
          <Path d={heartPath(x, eyeY + 1, 15)} fill="none" stroke={p.secondary} strokeWidth={2.6} strokeLinejoin="round" />
          <Path d={`M${x - 10} ${eyeY - 6} Q${x - 7} ${eyeY - 10} ${x - 2} ${eyeY - 9}`} stroke={p.accent} strokeWidth={2.4} strokeLinecap="round" fill="none" />
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
          <Circle cx={x} cy={y} r={4.4} fill={p.primary} stroke={p.secondary} strokeWidth={1} />
          <Circle cx={x - 1.3} cy={y - 1.4} r={1.3} fill="#FFFFFF" />
        </G>,
      );
    }
    return (
      <G>
        {pearls}
        {/* Satin bow off to one side. */}
        <Path d={`M72 ${n - 2} L60 ${n - 10} L60 ${n + 6} Z`} fill={p.accent} stroke="#E07BB0" strokeWidth={1.2} strokeLinejoin="round" />
        <Path d={`M72 ${n - 2} L84 ${n - 10} L84 ${n + 6} Z`} fill={p.accent} stroke="#E07BB0" strokeWidth={1.2} strokeLinejoin="round" />
        <Circle cx={72} cy={n - 2} r={3.4} fill="#E07BB0" />
      </G>
    );
  },
  'moon-charm': charm((x, y, s, p) => (
    <G>
      <Path d={moonPath(x - 1, y, s + 1)} fill={p.primary} stroke={p.secondary} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d={starPath(x + 6, y - 5, 3.6)} fill={p.accent} />
    </G>
  )),
};

// ── Cloud Racer ──────────────────────────────────────────────────────────────

const CLOUD_RACER_ART: Record<string, Art> = {
  'racing-cap': ({ headTop: h }, p) => (
    <G>
      <Path d={`M58 ${h + 22} C58 ${h - 16} 142 ${h - 16} 142 ${h + 22} Z`} fill={p.primary} />
      {/* Racing stripe front to back. */}
      <Path d={`M94 ${h - 6} Q100 ${h - 7.5} 106 ${h - 6} L112 ${h + 22} L88 ${h + 22} Z`} fill={p.secondary} />
      <Path d={`M98.5 ${h - 7} L101.5 ${h - 7} L103 ${h + 22} L97 ${h + 22} Z`} fill={p.primary} opacity={0.9} />
      {/* Checker panel and a winged-cloud patch (original mark). */}
      <Grid x={64} y={h + 5} cols={3} rows={2} size={5} a="#2A2A33" b="#FFFFFF" />
      <Path d={`M120 ${h + 12} C120 ${h + 6} 127 ${h + 4} 130 ${h + 8} C132 ${h + 4} 138 ${h + 6} 137 ${h + 12} Z`} fill={p.secondary} />
      <Path d={`M117 ${h + 8} L112 ${h + 6} M117 ${h + 11} L111 ${h + 11}`} stroke={p.secondary} strokeWidth={1.6} strokeLinecap="round" />
      <Path d={`M44 ${h + 25} Q100 ${h + 12} 156 ${h + 25} Q100 ${h + 37} 44 ${h + 25} Z`} fill={p.accent} />
      <Path d={`M48 ${h + 25} Q100 ${h + 15} 152 ${h + 25}`} stroke={p.secondary} strokeWidth={2} fill="none" />
      <Circle cx={100} cy={h - 7} r={4} fill={p.secondary} />
    </G>
  ),
  'racer-goggles': ({ headTop: h, headHalfWidth: w }, p) => (
    <G>
      {/* Pushed up on the forehead: the eyes stay completely clear. */}
      <Path d={`M${100 - w + 4} ${h + 30} Q100 ${h + 12} ${100 + w - 4} ${h + 30}`} stroke={p.primary} strokeWidth={6} strokeLinecap="round" fill="none" />
      {[84, 116].map((x) => (
        <G key={x}>
          <Circle cx={x} cy={h + 18} r={12} fill={p.secondary} opacity={p.opacity ?? 0.7} />
          <Circle cx={x} cy={h + 18} r={12} fill="none" stroke={p.primary} strokeWidth={4} />
          <Path d={`M${x - 6} ${h + 13} Q${x - 3} ${h + 9} ${x + 2} ${h + 10}`} stroke={p.accent} strokeWidth={2.4} strokeLinecap="round" fill="none" />
        </G>
      ))}
      <Rect x={95} y={h + 15} width={10} height={5} rx={2} fill={p.primary} />
    </G>
  ),
  'aero-shades': ({ eyeY, eyeDx, headHalfWidth }, p) => {
    const L = 100 - eyeDx - 27;
    const R = 100 + eyeDx + 27;
    const lens = `M${L} ${eyeY - 6} Q100 ${eyeY - 16} ${R} ${eyeY - 6} L${R - 5} ${eyeY + 6} Q100 ${eyeY + 13} ${L + 5} ${eyeY + 6} Z`;
    return (
      <G>
        <Path d={`M${L} ${eyeY - 6} L${100 - headHalfWidth + 2} ${eyeY - 9}`} stroke={p.secondary} strokeWidth={3.5} strokeLinecap="round" />
        <Path d={`M${R} ${eyeY - 6} L${100 + headHalfWidth - 2} ${eyeY - 9}`} stroke={p.secondary} strokeWidth={3.5} strokeLinecap="round" />
        <Path d={lens} fill={p.primary} opacity={p.opacity ?? 0.66} />
        <Path d={lens} fill="none" stroke={p.secondary} strokeWidth={2.4} strokeLinejoin="round" />
        <Path d={`M${L} ${eyeY - 6} Q100 ${eyeY - 16} ${R} ${eyeY - 6}`} stroke={p.secondary} strokeWidth={3.2} fill="none" strokeLinecap="round" />
        {/* Speed stripe. */}
        <Path d={`M${L + 10} ${eyeY + 3} L${L + 24} ${eyeY - 9} L${L + 30} ${eyeY - 9} L${L + 16} ${eyeY + 4} Z`} fill={p.accent} opacity={0.85} />
      </G>
    );
  },
  'racing-scarf': ({ neckY: n }, p) => (
    <G>
      {/* Tails blowing out to the right, with checker ends. */}
      <Path d={`M108 ${n + 4} C124 ${n + 2} 140 ${n + 12} 158 ${n + 6} L160 ${n + 16} C142 ${n + 22} 126 ${n + 14} 110 ${n + 14} Z`} fill={p.primary} />
      <Path d={`M104 ${n + 8} C118 ${n + 14} 132 ${n + 26} 148 ${n + 26} L146 ${n + 35} C128 ${n + 36} 114 ${n + 22} 102 ${n + 16} Z`} fill={p.primary} opacity={0.92} />
      <Grid x={154} y={n + 5} cols={2} rows={2} size={5} a={p.accent} b={p.secondary} />
      <Grid x={142} y={n + 25} cols={2} rows={2} size={5} a={p.accent} b={p.secondary} />
      <Path d={`M60 ${n - 8} Q100 ${n + 12} 140 ${n - 8}`} stroke={p.primary} strokeWidth={13} fill="none" strokeLinecap="round" />
      <Path d={`M62 ${n - 3} Q100 ${n + 16} 138 ${n - 3}`} stroke={p.secondary} strokeWidth={2} fill="none" opacity={0.8} />
      <Circle cx={104} cy={n + 8} r={8} fill={p.primary} stroke={p.secondary} strokeWidth={1.5} />
    </G>
  ),
  'winner-rosette': charm((x, y, s, p) => (
    <G>
      <Path d={`M${x - 4} ${y + 4} L${x - 8} ${y + 16} L${x - 4} ${y + 13} L${x - 1} ${y + 17} L${x} ${y + 5} Z`} fill={p.secondary} />
      <Path d={`M${x + 4} ${y + 4} L${x + 8} ${y + 16} L${x + 4} ${y + 13} L${x + 1} ${y + 17} L${x} ${y + 5} Z`} fill={p.secondary} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <Circle key={i} cx={x + Math.cos(a) * s} cy={y + Math.sin(a) * s} r={2.8} fill={p.primary} />;
      })}
      <Circle cx={x} cy={y} r={s} fill={p.primary} />
      <Circle cx={x} cy={y} r={s * 0.62} fill={p.accent} />
      <Path d={starPath(x, y, s * 0.45)} fill={p.secondary} />
    </G>
  )),
};

export const STYLE_ART: Record<string, Art> = { ...MIDNIGHT_ARCADE_ART, ...DREAMWAVE_ART, ...CLOUD_RACER_ART };

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
  'racer-goggles': '40 66 120 38',
  'aero-shades': '46 90 108 34',
  'racing-scarf': '50 140 116 60',
  'winner-rosette': '78 148 44 44',
};
