import { services } from '@/services';
import { createGameStore } from './createGameStore';

/** The app-wide store instance. */
export const useGameStore = createGameStore({
  saveRepository: services.saveRepository,
  protection: services.protection,
  debugDefault: typeof __DEV__ !== 'undefined' ? __DEV__ : false,
});
