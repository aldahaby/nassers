/**
 * Room Studio: free room colours (docs/ART_DIRECTION.md, "Room palette").
 * Presets are shortcuts; any colour can be picked. None of this costs coins,
 * XP or milestones, and none of it needs the parent PIN.
 */

export interface RoomPreset {
  id: string;
  name: string;
  color: string;
}

/** The default Focusling room wall (matches the original room art). */
export const DEFAULT_ROOM_COLOR = '#FDE9D2';

export const ROOM_PRESETS: readonly RoomPreset[] = [
  { id: 'cream', name: 'Cream', color: '#FDE9D2' },
  { id: 'cloud-blue', name: 'Cloud Blue', color: '#CFE4FA' },
  { id: 'lavender', name: 'Lavender', color: '#E3DAFF' },
  { id: 'blush', name: 'Blush', color: '#FBD9E3' },
  { id: 'sage', name: 'Sage', color: '#D5E3C8' },
  { id: 'mint', name: 'Mint', color: '#CDF2E1' },
  { id: 'peach', name: 'Peach', color: '#FFD8BF' },
  { id: 'butter', name: 'Butter', color: '#FFF1B8' },
  { id: 'deep-plum', name: 'Deep Plum', color: '#4A2D5C' },
  { id: 'midnight', name: 'Midnight', color: '#1E2447' },
  { id: 'charcoal', name: 'Charcoal', color: '#3A3A42' },
];

/**
 * How supporting tones are derived from the chosen colour. The wall is always
 * exactly the chosen colour; everything else adapts around it.
 */
export const ROOM_PALETTE_TUNING = {
  /** Below this luminance a room counts as dark (lighter floor, stronger shadows, brighter halo). */
  darkLuminance: 0.16,
  /** Above this luminance a room counts as very bright (tinted spotlight so it still shows). */
  brightLuminance: 0.82,
  /** Floor lightness shift from the wall (points), and saturation kept. */
  floorShift: { light: -13, dark: 9 },
  floorSaturation: 0.7,
  /** Halo behind the pet: how far toward white (light rooms) or up in lightness (dark rooms). */
  haloMix: { light: 0.55, dark: 0.2 },
  /** Contact-shadow strength. */
  shadowOpacity: { light: 0.1, dark: 0.34 },
  /** Very saturated walls get a softer, less saturated halo so the pet separates. */
  saturatedAbove: 70,
} as const;
