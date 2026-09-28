import type { ReactElement } from 'react';
import { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import type { ItemPalette, MaterialFamily } from '@/core';
import { currentArtScope, useArtScope } from './artScope';

/**
 * The Focusling Materials Bible, as code. Every cosmetic is drawn in one of a
 * few material families, and each family has one rendering recipe so the same
 * material looks the same on every item (docs/ART_DIRECTION.md):
 *
 * - jelly     translucent fill, bright rim, soft specular blob, darker lower edge
 * - smoked    jelly's darker cousin (polycarbonate): tinted top-to-bottom, sharp reflection streak
 * - chrome    banded light-dark-light gradient, crisp white highlight
 * - pearl     radial white-to-tint core with a faint iridescent sheen
 * - fabric    matte flat fill, stitched inset seam, soft fold shading
 * - knit      matte fill with rib chevrons and a scalloped edge
 * - plastic   glossy: lighter top, darker base, one bold highlight arc
 * - holo      restrained multi-hue sheen over a base colour
 * - fuzzy     soft fill with a bumpy, dotted outline
 * - wood      warm fill, curved grain lines, a small varnish glint
 *
 * Gradients get deterministic ids from the family + palette, so identical ids
 * always mean identical gradients (safe when several pets share one web page).
 * Everything is flat SVG (no filters or blur), so it stays cheap on mobile.
 */

const hash = (p: ItemPalette) => `${p.primary}${p.secondary}${p.accent}`.replace(/[^0-9a-z]/gi, '');
const idIn = (scope: string, family: string, p: ItemPalette, variant = '') => `fm-${family}${variant}-${hash(p)}${scope}`;
/** Gradient id for inline `url(#…)` use inside art functions (uses the drawing's current scope). */
export const materialId = (family: string, p: ItemPalette, variant = '') => idIn(currentArtScope(), family, p, variant);

/** Gradient definitions a material needs; place once inside the item's <G>. */
export function MaterialDefs({ family, p }: { family: MaterialFamily | 'smoked'; p: ItemPalette }) {
  const id = idIn(useArtScope(), family, p);
  switch (family) {
    case 'jelly':
      return (
        <Defs>
          <RadialGradient id={id} cx="35%" cy="25%" r="85%">
            <Stop offset="0" stopColor={p.accent} stopOpacity={0.95} />
            <Stop offset="0.45" stopColor={p.primary} stopOpacity={1} />
            <Stop offset="1" stopColor={p.secondary} stopOpacity={1} />
          </RadialGradient>
        </Defs>
      );
    case 'smoked':
      return (
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={p.secondary} stopOpacity={1} />
            <Stop offset="0.55" stopColor={p.primary} stopOpacity={1} />
            <Stop offset="1" stopColor={p.accent} stopOpacity={1} />
          </LinearGradient>
        </Defs>
      );
    case 'chrome':
      return (
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="0.3" stopColor={p.primary} />
            <Stop offset="0.52" stopColor={p.secondary} />
            <Stop offset="0.62" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor={p.primary} />
          </LinearGradient>
        </Defs>
      );
    case 'pearl':
      return (
        <Defs>
          <RadialGradient id={id} cx="38%" cy="32%" r="75%">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="0.55" stopColor={p.primary} />
            <Stop offset="1" stopColor={p.secondary} />
          </RadialGradient>
          <LinearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFD1EC" stopOpacity={0.5} />
            <Stop offset="0.5" stopColor="#C9F5E8" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#C8DCFF" stopOpacity={0.5} />
          </LinearGradient>
        </Defs>
      );
    case 'plastic':
      return (
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={p.accent} stopOpacity={0.55} />
            <Stop offset="0.25" stopColor={p.primary} />
            <Stop offset="1" stopColor={p.secondary} />
          </LinearGradient>
        </Defs>
      );
    case 'holo':
      return (
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0.6">
            <Stop offset="0" stopColor={p.primary} />
            <Stop offset="0.35" stopColor="#BFF3FF" />
            <Stop offset="0.6" stopColor="#FFD1F3" />
            <Stop offset="0.85" stopColor="#FFF2B8" />
            <Stop offset="1" stopColor={p.primary} />
          </LinearGradient>
        </Defs>
      );
    default:
      // fabric, knit, fuzzy, wood are matte: no gradient needed.
      return null;
  }
}

const matte = (family: MaterialFamily | 'smoked') => family === 'fabric' || family === 'knit' || family === 'fuzzy' || family === 'wood';
export const fillFor = (family: MaterialFamily | 'smoked', p: ItemPalette) => (matte(family) ? p.primary : `url(#${materialId(family, p)})`);

/** A specular highlight: the single most important "this is glossy" cue. */
export function Specular({ x, y, rx, ry, rotate = -25, opacity = 0.85 }: { x: number; y: number; rx: number; ry: number; rotate?: number; opacity?: number }) {
  return <Ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#FFFFFF" opacity={opacity} transform={`rotate(${rotate} ${x} ${y})`} />;
}

/** A thin reflection streak across glass/chrome. */
export function Streak({ d, width = 2.4, opacity = 0.8 }: { d: string; width?: number; opacity?: number }) {
  return <Path d={d} stroke="#FFFFFF" strokeWidth={width} strokeLinecap="round" fill="none" opacity={opacity} />;
}

/** Stitched seam: the fabric cue. Drawn just inside an edge. */
export function Stitch({ d, color, width = 1.2 }: { d: string; color: string; width?: number }) {
  return <Path d={d} stroke={color} strokeWidth={width} strokeDasharray="2.6 2.2" strokeLinecap="round" fill="none" opacity={0.75} />;
}

/** Knit ribs: rows of little chevrons inside a rectangle. */
export function KnitRibs({ x, y, w, h, color, step = 5 }: { x: number; y: number; w: number; h: number; color: string; step?: number }) {
  const cols = Math.floor(w / step);
  const rows = Math.max(1, Math.floor(h / 5));
  const paths: string[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cx = x + c * step + step / 2;
      const cy = y + r * 5 + 1.5;
      paths.push(`M${cx - step * 0.35} ${cy} L${cx} ${cy + 2.4} L${cx + step * 0.35} ${cy}`);
    }
  }
  return <Path d={paths.join(' ')} stroke={color} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.7} />;
}

/** Soft, bumpy outline: a dotted round stroke reads as fuzz without any blur. */
export function FuzzEdge({ d, color, width = 4.2 }: { d: string; color: string; width?: number }) {
  return <Path d={d} stroke={color} strokeWidth={width} strokeDasharray="0.1 3.6" strokeLinecap="round" fill="none" />;
}

/** Wood grain: a few curved lines. */
export function Grain({ lines, color }: { lines: string[]; color: string }) {
  return <Path d={lines.join(' ')} stroke={color} strokeWidth={0.9} strokeLinecap="round" fill="none" opacity={0.55} />;
}

/**
 * Draw a filled shape in a material, with its rim. Highlights and seams are
 * added by the item, because they depend on the object's shape.
 */
export function MaterialShape({
  family,
  d,
  p,
  rim = true,
  rimWidth = 2.4,
  opacity,
}: {
  family: MaterialFamily | 'smoked';
  d: string;
  p: ItemPalette;
  rim?: boolean;
  rimWidth?: number;
  opacity?: number;
}): ReactElement {
  const scope = useArtScope();
  const translucent = family === 'jelly' || family === 'smoked';
  const alpha = opacity ?? (translucent ? (p.opacity ?? 0.7) : 1);
  return (
    <G>
      <MaterialDefs family={family} p={p} />
      <Path d={d} fill={matte(family) ? p.primary : `url(#${idIn(scope, family, p)})`} opacity={alpha} />
      {family === 'pearl' && <Path d={d} fill={`url(#${idIn(scope, 'pearl', p)}-sheen)`} />}
      {rim && <Path d={d} fill="none" stroke={family === 'jelly' ? p.secondary : family === 'chrome' ? '#5B6270' : p.secondary} strokeWidth={rimWidth} strokeLinejoin="round" />}
    </G>
  );
}
