import { requireOptionalNativeModule } from 'expo-modules-core';
import type { AuthorizationState, ProtectionStatus } from '@/core';

/** Shape of the Swift `FocuslingProtection` Expo module (modules/focusling-protection). */
export interface FocuslingProtectionNativeModule {
  getStatus(): Promise<ProtectionStatus>;
  requestAuthorization(): Promise<AuthorizationState>;
  presentAppPicker(): Promise<number>;
  /** Resolves after native has confirmed the protection is running, or rejects with a coded error. */
  startProtection(request: {
    sessionId: string;
    mode: 'selective' | 'wholeApp';
    surfaces: string[];
    endsAtMs: number;
    policy: Record<string, number>;
    samplesPerSecond: number;
    analysisMaxDimension: number;
    interventionShieldTimeoutMs: number;
    petName: string;
  }): Promise<ProtectionStatus>;
  endProtection(sessionId: string | null, reason: string): Promise<void>;
  emergencyCleanup(): Promise<void>;
  debugTriggerFakeDetection(): Promise<void>;
  debugClearShields(): Promise<void>;
  debugStopCapture(): Promise<void>;
  debugRestartCapture(): Promise<void>;
  /** Debug builds only (native rejects in release). `null` stops collection. */
  debugSetSampleCollection(label: string | null): Promise<void>;
  debugSampleCounts(): Promise<Record<string, number>>;
  debugExportSamples(): Promise<void>;
  debugDeleteSamples(): Promise<void>;
  addListener(event: string, listener: (payload: Record<string, unknown>) => void): { remove(): void };
}

/** Null on web, in Expo Go, and in builds without the native module. */
export const FocuslingProtectionNative = requireOptionalNativeModule<FocuslingProtectionNativeModule>('FocuslingProtection');
