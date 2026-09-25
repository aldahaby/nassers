import { Platform } from 'react-native';
import { AsyncStorageSaveRepository } from './persistence/AsyncStorageSaveRepository';
import type { SaveRepository } from './persistence/SaveRepository';
import type { FocusProtectionService } from './protection/FocusProtectionService';
import { IOSProtectionService } from './protection/IOSProtectionService';
import { MockProtectionService } from './protection/MockProtectionService';
import { FocuslingProtectionNative } from './protection/nativeModule';

/**
 * Composition root: the one place that picks concrete implementations.
 * iOS dev/production builds with the native module get real protection;
 * web, Expo Go and tests get the mock.
 */
function createProtectionService(): FocusProtectionService {
  if (Platform.OS === 'ios' && FocuslingProtectionNative) return new IOSProtectionService(FocuslingProtectionNative);
  return new MockProtectionService();
}

export const services: { saveRepository: SaveRepository; protection: FocusProtectionService } = {
  saveRepository: new AsyncStorageSaveRepository(),
  protection: createProtectionService(),
};

export type { SaveRepository } from './persistence/SaveRepository';
export type * from './protection/FocusProtectionService';
export { MockProtectionService } from './protection/MockProtectionService';
