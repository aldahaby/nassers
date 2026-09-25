import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateSave, type GameSave } from '@/core';
import type { SaveRepository } from './SaveRepository';

const SAVE_KEY = 'focusling/save/v1';
const BACKUP_KEY = 'focusling/save/backup';

/** On-device persistence (AsyncStorage on native, localStorage on web). */
export class AsyncStorageSaveRepository implements SaveRepository {
  async load(): Promise<GameSave | null> {
    const raw = await AsyncStorage.getItem(SAVE_KEY);
    if (raw === null) return null;
    try {
      return migrateSave(JSON.parse(raw));
    } catch (error) {
      // Keep the unreadable save instead of silently overwriting it.
      await AsyncStorage.setItem(BACKUP_KEY, raw);
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
