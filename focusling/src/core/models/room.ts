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
  /**
   * Chosen Premium room theme id (schema 8), or null. It is a preference, not
   * ownership: it renders only while Premium is active; otherwise the room
   * colour shows. Nothing is lost if Premium lapses.
   */
  theme: string | null;
}
