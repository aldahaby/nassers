import type { GameSave } from '@/core';
import type { SaveRepository } from './SaveRepository';

/** In-memory repository for tests and previews. */
export class MemorySaveRepository implements SaveRepository {
  private data: string | null = null;

  async load(): Promise<GameSave | null> {
    return this.data ? (JSON.parse(this.data) as GameSave) : null;
  }

  async save(save: GameSave): Promise<void> {
    this.data = JSON.stringify(save);
  }

  async clear(): Promise<void> {
    this.data = null;
  }
}
