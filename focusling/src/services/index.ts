import { AsyncStorageSaveRepository } from './persistence/AsyncStorageSaveRepository';
import type { SaveRepository } from './persistence/SaveRepository';
import { MockScreenTimeService } from './screenTime/MockScreenTimeService';
import type { ScreenTimeService } from './screenTime/ScreenTimeService';

/**
 * Composition root: the one place that picks concrete implementations.
 * Swap `MockScreenTimeService` for a native one here (e.g. by Platform.OS) when
 * the iOS/Android modules exist.
 */
export const services: { saveRepository: SaveRepository; screenTime: ScreenTimeService } = {
  saveRepository: new AsyncStorageSaveRepository(),
  screenTime: new MockScreenTimeService(),
};

export type { SaveRepository } from './persistence/SaveRepository';
export type * from './screenTime/ScreenTimeService';
export { MockScreenTimeService } from './screenTime/MockScreenTimeService';
