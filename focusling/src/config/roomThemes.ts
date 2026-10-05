import type { ContentAccess } from '@/core/models';

/**
 * Room themes: whole-room treatments (walls, floor material, atmosphere), not
 * just a colour. Basic room colour stays free for everyone in Room Studio;
 * themes are Premium depth on top. All artwork is original, drawn in
 * `ui/room/roomThemes.tsx` from the collection art language.
 */
export type ThemePattern = 'stars' | 'scanlines' | 'checker' | 'leaves';
export type ThemeFloor = 'plush' | 'grid' | 'tile' | 'planks';

export interface RoomTheme {
  id: string;
  name: string;
  description: string;
  access: ContentAccess;
  /** The collection whose art language it borrows. */
  collection: string;
  /** Base wall colour; the derived room palette is built from it. */
  base: string;
  pattern: ThemePattern;
  floor: ThemeFloor;
  /** Accent tones used by the theme art. */
  accents: readonly [string, string];
}

export const ROOM_THEMES: readonly RoomTheme[] = [
  { id: 'dreamwave-night', name: 'Dreamwave Night', description: 'Lavender dusk, drifting stars and a plush moon rug.', access: 'premium', collection: 'dreamwave', base: '#4B3C8C', pattern: 'stars', floor: 'plush', accents: ['#FFE38A', '#FFC4E1'] },
  { id: 'arcade-after-dark', name: 'Arcade After Dark', description: 'Soft scanlines, glowing pixels and a neon grid floor.', access: 'premium', collection: 'midnight-arcade', base: '#1C2143', pattern: 'scanlines', floor: 'grid', accents: ['#5CF0FF', '#FF4FD8'] },
  { id: 'cloud-racer-pit', name: 'Cloud Racer Pit', description: 'A cream garage wall, a checker band and tiled floor.', access: 'premium', collection: 'cloud-racer', base: '#FFF3DC', pattern: 'checker', floor: 'tile', accents: ['#E5402B', '#2E5BD6'] },
  { id: 'moss-grove', name: 'Moss Grove', description: 'Forest green, falling leaves, fireflies and warm wood planks.', access: 'premium', collection: 'moss-club', base: '#3E5A3A', pattern: 'leaves', floor: 'planks', accents: ['#9CC46E', '#E9F27A'] },
];

const BY_ID = new Map(ROOM_THEMES.map((t) => [t.id, t]));
export function getRoomTheme(id: string | null | undefined): RoomTheme | undefined {
  return id ? BY_ID.get(id) : undefined;
}
