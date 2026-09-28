/**
 * The pet's room. Basic room colour is free creative expression: any colour,
 * no coins, XP, milestones or parent PIN. `color` null = the default
 * Focusling room.
 *
 * Future (not built): earnable room *treatments* (wallpapers, floors, lighting
 * moods, window scenes, collection room sets) would add optional fields here,
 * earned by visible focus milestones. Normal colours are never locked.
 */
export interface RoomState {
  /** Base room colour as #RRGGBB, or null for the default room. */
  color: string | null;
}
