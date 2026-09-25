import type {
  AuthorizationState,
  ContentSurface,
  ProtectionMode,
  ProtectionStartError,
  ProtectionStatus,
  Timestamp,
} from '@/core';
import type { DetectionPolicyConfig } from '@/config/protection';

export interface ProtectionStartRequest {
  sessionId: string;
  mode: Exclude<ProtectionMode, 'none'>;
  surfaces: ContentSurface[];
  endsAt: Timestamp;
  policy: DetectionPolicyConfig;
  /** Used only for the shield text ("Nimbus is focusing with you."). */
  petName: string;
}

export type ProtectionStartResult = { ok: true; status: ProtectionStatus } | { ok: false; error: ProtectionStartError; message?: string };

export type ProtectionEndReason =
  | 'completed'
  | 'ended-early'
  | 'reset'
  | 'reconcile'
  | 'error-recovery'
  | 'authorization-lost'
  | 'debug';

export type ProtectionEvent =
  | { type: 'status'; status: ProtectionStatus }
  /** A distraction was caught and interrupted. Never ends or penalises the session. */
  | { type: 'intervention'; sessionId: string; surface: ContentSurface; at: Timestamp }
  /** Selective capture stopped on its own (person stopped recording, system stopped it, error). */
  | { type: 'capture-stopped'; sessionId: string; reason: 'user-stopped' | 'system' | 'error' }
  | { type: 'authorization-lost' };

/**
 * Boundary between the game and OS-level focus protection (Screen Time shields,
 * DeviceActivity, on-device screen recognition). Screens never talk to the OS directly.
 * Native status is authoritative: callers show "protection active" only when
 * the returned/emitted status says so for the current session ID.
 */
export interface FocusProtectionService {
  readonly platform: 'mock' | 'ios';
  getStatus(): Promise<ProtectionStatus>;
  requestAuthorization(): Promise<AuthorizationState>;
  /** Shows the system app picker (FamilyActivityPicker on iOS). Resolves with the number of selected apps. */
  selectApps(): Promise<number>;
  /** Starts native protection and resolves only after native confirms it is running. */
  startProtection(request: ProtectionStartRequest): Promise<ProtectionStartResult>;
  /** The single cleanup path: stops capture, detection, shields and monitoring for the session. */
  endProtection(sessionId: string | null, reason: ProtectionEndReason): Promise<void>;
  /** Clears everything native regardless of session (Developer Mode safety valve). */
  emergencyCleanup(): Promise<void>;
  subscribe(listener: (event: ProtectionEvent) => void): () => void;
  readonly debug: ProtectionDebugControls;
}

export interface ProtectionDebugControls {
  triggerFakeDetection(): Promise<void>;
  clearShields(): Promise<void>;
  stopCapture(): Promise<void>;
  restartCapture(): Promise<void>;
}
