import type { GameSave } from '../models';

const HEX6 = /^#[0-9a-f]{6}$/i;

/** A valid stored room colour (uppercase #RRGGBB), or null. */
export function normalizeRoomColor(value: unknown): string | null {
  return typeof value === 'string' && HEX6.test(value) ? value.toUpperCase() : null;
}

/**
 * Set the room colour (null resets to the default room). Always allowed: in
 * Self Mode and Child View alike, with no cost and no gate. Invalid colours are
 * ignored so a bad value can never break the room.
 */
export function setRoomColor(save: GameSave, color: string | null): GameSave {
  const next = color === null ? null : normalizeRoomColor(color);
  if (color !== null && next === null) return save;
  if (save.room.color === next) return save;
  return { ...save, room: { ...save.room, color: next } };
}

/**
 * Choose a room theme (null clears it). Premium themes need `entitled` at the
 * time of choosing; free themes (none yet) always work. Unknown ids are ignored.
 */
export function setRoomTheme(save: GameSave, themeId: string | null, opts: { known: (id: string) => boolean; premium: (id: string) => boolean; entitled: boolean }): GameSave {
  if (themeId !== null && (!opts.known(themeId) || (opts.premium(themeId) && !opts.entitled))) return save;
  if (save.room.theme === themeId) return save;
  return { ...save, room: { ...save.room, theme: themeId } };
}
