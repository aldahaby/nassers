import { Platform } from 'react-native';
import { AsyncStorageSaveRepository } from './persistence/AsyncStorageSaveRepository';
import type { SaveRepository } from './persistence/SaveRepository';
import type { FocusProtectionService } from './protection/FocusProtectionService';
import { IOSProtectionService } from './protection/IOSProtectionService';
import { MockProtectionService } from './protection/MockProtectionService';
import { FocuslingProtectionNative } from './protection/nativeModule';
import { FocuslingStoreNative, MockStoreService, NativeStoreService, UnavailableStoreService, type StoreService } from './store';

/**
 * Composition root: the one place that picks concrete implementations.
 * iOS dev/production builds with the native module get real protection;
 * web, Expo Go and tests get the mock.
 */
function createProtectionService(): FocusProtectionService {
  if (Platform.OS === 'ios' && FocuslingProtectionNative) return new IOSProtectionService(FocuslingProtectionNative);
  return new MockProtectionService();
}

/**
 * Purchases: StoreKit on iOS builds with the FocuslingStore module; an
 * explicit, clearly labelled mock on web and dev builds; otherwise no store
 * (Free, purchases disabled, previews still work).
 */
function createStoreService(): StoreService {
  if (Platform.OS === 'ios' && FocuslingStoreNative) return new NativeStoreService(FocuslingStoreNative);
  if (Platform.OS === 'web' || __DEV__) return new MockStoreService();
  return new UnavailableStoreService();
}

export const services: { saveRepository: SaveRepository; protection: FocusProtectionService; store: StoreService } = {
  saveRepository: new AsyncStorageSaveRepository(),
  protection: createProtectionService(),
  store: createStoreService(),
};

export type { SaveRepository } from './persistence/SaveRepository';
export type * from './protection/FocusProtectionService';
export { MockProtectionService } from './protection/MockProtectionService';
export * from './store';
