import { requireOptionalNativeModule, type EventSubscription } from 'expo-modules-core';
import type { ExtractedPage } from '../documents/DocumentService';

/**
 * The StudylingNative Expo module (modules/studyling-native, iOS only):
 * on-device PDF text/OCR, the widget snapshot in the App Group, and the
 * study-session Live Activity. Absent on web, Expo Go and Android, where the
 * app falls back to mocks. UNTESTED until an EAS development build runs it.
 */
export interface LiveActivityPayload {
  title: string;
  subtitle: string;
  endsAtMs: number;
  protection: 'on' | 'off' | 'simulated';
}

export interface StudylingNativeModule {
  extractPdfText(uri: string): Promise<ExtractedPage[]>;
  writeWidgetSnapshot(json: string): Promise<void>;
  startLiveActivity(payload: LiveActivityPayload): Promise<string | null>;
  updateLiveActivity(id: string, payload: LiveActivityPayload): Promise<void>;
  endLiveActivity(id: string): Promise<void>;
  liveActivitiesEnabled(): boolean;
  addListener(event: 'onExtractionProgress', listener: (e: { done: number; total: number }) => void): EventSubscription;
}

export const StudylingNative = requireOptionalNativeModule<StudylingNativeModule>('StudylingNative');
