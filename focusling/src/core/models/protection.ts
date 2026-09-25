import type { Timestamp } from './common';

/** How a focus session protects the user's chosen apps. */
export type ProtectionMode = 'none' | 'selective' | 'wholeApp';

/** Addictive surfaces inside apps. Only `instagramReels` is wired to detection this milestone. */
export type ContentSurface = 'instagramReels' | 'instagramStories' | 'instagramExplore' | 'youtubeShorts';

/** Persisted user preference (the app selection itself lives natively as opaque tokens). */
export interface ProtectionSettings {
  mode: ProtectionMode;
  surfaces: ContentSurface[];
  /** Selective protection never silently becomes whole-app; the user is asked. */
  fallbackBehavior: 'askUser';
}

export type AuthorizationState = 'notDetermined' | 'denied' | 'approved' | 'unsupported';
export type ScreenRecognitionAvailability = 'unknown' | 'available' | 'unavailable';
export type CaptureState = 'unsupported' | 'idle' | 'awaitingPicker' | 'running' | 'stopped' | 'failed';

export interface SurfaceClassification {
  app: 'instagram' | 'unknown';
  surface: ContentSurface | 'other';
  confidence: number;
}

export interface DetectionDiagnostics {
  latest: SurfaceClassification | null;
  /** Positive votes in the current rolling window, and the window size. */
  votes: number;
  window: number;
  lastInterventionAt: Timestamp | null;
}

/** Authoritative protection state as reported by the platform service. */
export interface ProtectionStatus {
  platform: 'mock' | 'ios';
  authorization: AuthorizationState;
  screenRecognition: ScreenRecognitionAvailability;
  captureStatus: CaptureState;
  monitoringStatus: 'idle' | 'active';
  shieldStatus: 'none' | 'session' | 'intervention';
  selectedTargetCount: number;
  currentSessionId: string | null;
  activeMode: ProtectionMode;
  detection: DetectionDiagnostics;
  lastError: string | null;
}
