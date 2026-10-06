import { Platform } from 'react-native';
import { AsyncStorageSaveRepository } from './persistence/AsyncStorageSaveRepository';
import type { SaveRepository } from './persistence/SaveRepository';
import type { FocusProtectionService } from './protection/FocusProtectionService';
import { IOSProtectionService } from './protection/IOSProtectionService';
import { MockProtectionService } from './protection/MockProtectionService';
import { FocuslingProtectionNative } from './protection/nativeModule';
import { FocuslingStoreNative, MockStoreService, NativeStoreService, UnavailableStoreService, type StoreService } from './store';
import { LocalOnlySyncProvider, type SyncProvider } from '@/core';
import type { DocumentService } from './documents/DocumentService';
import { NativeDocumentService } from './documents/NativeDocumentService';
import { WebDocumentService } from './documents/WebDocumentService';
import { StudylingNative } from './native/studylingNative';
import { MockNotificationService } from './notifications/MockNotificationService';
import type { NotificationService } from './notifications/NotificationService';
import { AsyncStoragePlannerRepository } from './planner/AsyncStoragePlannerRepository';
import type { PlannerRepository } from './planner/PlannerRepository';
import { MockStudyWidgetBridge, NativeStudyWidgetBridge, type StudyWidgetBridge } from './widgets/StudyWidgetBridge';

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

/**
 * Planner reminders: local notifications on device builds; an in-memory mock on
 * web (and in tests) that Planner QA can fire.
 */
function createNotificationService(): NotificationService {
  if (Platform.OS === 'web' || (typeof process !== 'undefined' && process.env?.JEST_WORKER_ID)) return new MockNotificationService();
  try {
    // Required lazily so web bundles and tests never load the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ExpoNotificationService } = require('./notifications/ExpoNotificationService') as typeof import('./notifications/ExpoNotificationService');
    return new ExpoNotificationService();
  } catch {
    return new MockNotificationService();
  }
}

export const services: {
  saveRepository: SaveRepository;
  protection: FocusProtectionService;
  store: StoreService;
  plannerRepository: PlannerRepository;
  notifications: NotificationService;
  documents: DocumentService;
  widgets: StudyWidgetBridge;
  /** Local-only: nothing leaves the device (docs/PLANNER_PRIVACY.md). */
  sync: SyncProvider;
} = {
  saveRepository: new AsyncStorageSaveRepository(),
  protection: createProtectionService(),
  store: createStoreService(),
  plannerRepository: new AsyncStoragePlannerRepository(),
  notifications: createNotificationService(),
  documents: Platform.OS === 'web' ? new WebDocumentService() : new NativeDocumentService(),
  widgets: Platform.OS === 'ios' && StudylingNative ? new NativeStudyWidgetBridge() : new MockStudyWidgetBridge(),
  sync: new LocalOnlySyncProvider(),
};

export type { SaveRepository } from './persistence/SaveRepository';
export type * from './protection/FocusProtectionService';
export { MockProtectionService } from './protection/MockProtectionService';
export * from './store';
export { MockNotificationService } from './notifications/MockNotificationService';
export type * from './notifications/NotificationService';
export type { DocumentService, PickedDocument, ExtractedPage, ExtractionResult, ExtractionError } from './documents/DocumentService';
export { joinPages } from './documents/DocumentService';
export { MockStudyWidgetBridge } from './widgets/StudyWidgetBridge';
export type { StudyWidgetBridge } from './widgets/StudyWidgetBridge';
export { MemoryPlannerRepository } from './planner/PlannerRepository';
export type { PlannerRepository } from './planner/PlannerRepository';
export { appClock } from './clock';
