import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateSave, type GameSave } from '@/core';
import type { SaveRepository } from './SaveRepository';

const SAVE_KEY = 'focusling/save/v1';
const BACKUP_KEY = 'focusling/save/backup';

/** On-device persistence (AsyncStorage on native, localStorage on web). */
export class AsyncStorageSaveRepository implements SaveRepository {
  async load(): Promise<GameSave | null> {
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(SAVE_KEY);
    } catch (error) {
      // Storage unavailable (private browsing, blocked site data): start a fresh,
      // unsaved game rather than refusing to open. Writes fail softly in the store.
      console.warn('[focusling] storage unavailable, starting without saved data', error);
      return null;
    }
    if (raw === null) return null;
    try {
      return migrateSave(JSON.parse(raw));
    } catch (error) {
      // Keep the unreadable save instead of silently overwriting it.
      await AsyncStorage.setItem(BACKUP_KEY, raw).catch(() => undefined);
      throw error;
    }
  }

  async save(save: GameSave): Promise<void> {
    await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(SAVE_KEY);
  }
}
