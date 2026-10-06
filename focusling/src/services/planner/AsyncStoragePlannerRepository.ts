import AsyncStorage from '@react-native-async-storage/async-storage';
import { migratePlanner, serializePlannerState, type PlannerState } from '@/core';
import type { PlannerRepository } from './PlannerRepository';

export const PLANNER_KEY = 'studyling/planner/v1';
const BACKUP_KEY = 'studyling/planner/backup';

export class AsyncStoragePlannerRepository implements PlannerRepository {
  async load(now: number, timezone: string) {
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(PLANNER_KEY);
    } catch {
      return null;
    }
    if (raw === null) return null;
    try {
      return migratePlanner(JSON.parse(raw), now, timezone);
    } catch (error) {
      await AsyncStorage.setItem(BACKUP_KEY, raw).catch(() => undefined);
      throw error;
    }
  }
  async save(state: PlannerState) {
    await AsyncStorage.setItem(PLANNER_KEY, serializePlannerState(state));
  }
  async clear() {
    await AsyncStorage.removeItem(PLANNER_KEY);
  }
}
