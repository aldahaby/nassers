import type { GameSave } from '@/core';

/**
 * Where the game save lives. The app only talks to this interface, so a cloud
 * implementation (or a local-first repo that syncs in the background) can be
 * dropped in without touching game logic or UI.
 */
export interface SaveRepository {
  /** Returns null when there is no save yet (first launch). Throws on corrupt data. */
  load(): Promise<GameSave | null>;
  save(save: GameSave): Promise<void>;
  clear(): Promise<void>;
}
