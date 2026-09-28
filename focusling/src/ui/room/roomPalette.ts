import { DEFAULT_ROOM_COLOR, ROOM_PALETTE_TUNING as T } from '@/config/room';
import { hexToHsl, hslToHex, luminance, mix, shade } from '@/ui/color';

/**
 * A coherent room derived from one colour (docs/ART_DIRECTION.md, "Room
 * palette"): the wall is exactly the chosen colour; floor, trim, spotlight,
 * halo, shadow and a small accent are derived so the room looks designed, and
 * adapt for very dark, very bright and very saturated choices without ever
 * replacing the chosen colour. The app's own UI is never recoloured.
 */
export interface RoomPalette {
  base: string;
  wall: string;
  /** Window frame and skirting: a step away from the wall. */
  trim: string;
  floor: string;
  floorEdge: string;
  /** The pool of light where the pet stands. */
  spotlight: string;
  spotlightOpacity: number;
  /** Soft disc behind the pet that separates it from the wall. */
  halo: string;
  haloOpacity: number;
  shadow: string;
  shadowOpacity: number;
  /** A small accent (e.g. the window sill glint). */
  accent: string;
  /** Sky seen through the window. */
  sky: string;
  tone: 'light' | 'dark';
  /** True when the wall is very bright (white, yellow): spotlight is tinted to show. */
  bright: boolean;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The original default room, kept exactly as it was drawn. */
const DEFAULT_PALETTE: RoomPalette = {
  base: DEFAULT_ROOM_COLOR,
  wall: '#FDE9D2',
  trim: '#F4D2AE',
  floor: '#F4D2AE',
  floorEdge: '#EAC096',
  spotlight: '#FFF6E8',
  spotlightOpacity: 0.55,
  halo: '#FFF6EC',
  haloOpacity: 0.7,
  shadow: '#5A3A1A',
  shadowOpacity: 0.1,
  accent: '#FFD166',
  sky: '#CFE8FF',
  tone: 'light',
  bright: false,
};

export function roomPalette(color: string | null | undefined): RoomPalette {
  if (!color || color.toUpperCase() === DEFAULT_ROOM_COLOR) return DEFAULT_PALETTE;
  const base = color.toUpperCase();
  const { h, s, l } = hexToHsl(base);
  const lum = luminance(base);
  const dark = lum < T.darkLuminance;
  const bright = lum > T.brightLuminance;
  const saturated = s > T.saturatedAbove;

  const floor = hslToHex({ h, s: s * T.floorSaturation, l: clamp(l + (dark ? T.floorShift.dark : T.floorShift.light), 6, 90) });
  const floorEdge = shade(floor, dark ? 6 : -7);
  const trim = shade(base, dark ? 12 : -11);
  // The halo is the pet's own light: toward white on light walls, lifted on dark ones.
  const haloBase = saturated ? hslToHex({ h, s: s * 0.45, l }) : base;
  const halo = dark ? mix(haloBase, '#FFFFFF', T.haloMix.dark) : mix(haloBase, '#FFFFFF', T.haloMix.light);
  // On a white or pale-yellow wall a white spotlight disappears: tint it warm instead.
  const spotlight = bright ? mix(base, '#FFD9A8', 0.35) : dark ? mix(base, '#FFFFFF', 0.3) : mix(base, '#FFFFFF', 0.62);

  return {
    base,
    wall: base,
    trim,
    floor,
    floorEdge,
    spotlight,
    spotlightOpacity: dark ? 0.35 : bright ? 0.5 : 0.55,
    halo: bright ? mix(base, '#FFE7C4', 0.4) : halo,
    haloOpacity: dark ? 0.55 : 0.7,
    shadow: dark ? '#000000' : shade(hslToHex({ h, s: s * 0.5, l }), -45),
    shadowOpacity: dark ? T.shadowOpacity.dark : T.shadowOpacity.light,
    accent: hslToHex({ h: (h + 35) % 360, s: clamp(s, 35, 65), l: dark ? 72 : 48 }),
    sky: dark ? mix('#243060', base, 0.35) : mix('#CFE8FF', base, 0.15),
    tone: dark ? 'dark' : 'light',
    bright,
  };
}
