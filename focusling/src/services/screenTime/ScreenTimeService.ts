import type { BlockTarget, Timestamp } from '@/core';

export type ScreenTimeAuthorization = 'notDetermined' | 'denied' | 'approved' | 'unsupported';

export interface BlockRequest {
  sessionId: string;
  targets: BlockTarget[];
  endsAt: Timestamp;
}

export type ScreenTimeEvent =
  /** The user opened (or tried to open) a blocked target during a session. */
  | { type: 'violation'; sessionId: string; targetId: string; at: Timestamp }
  /** The user turned blocking off outside the app (e.g. revoked permission). */
  | { type: 'blockingRevoked'; sessionId: string; at: Timestamp };

export type ScreenTimeListener = (event: ScreenTimeEvent) => void;

/**
 * Boundary between the game and the operating system's app-restriction APIs.
 *
 * The game only ever asks: "block these targets until T" and "tell me if the
 * user broke the block". Everything platform-specific (iOS FamilyControls /
 * ManagedSettings / DeviceActivity, Android UsageStats / Accessibility /
 * overlays) lives behind this interface, so the economy and progression code
 * never change when a real implementation replaces the mock.
 */
export interface ScreenTimeService {
  readonly kind: 'mock' | 'ios' | 'android';
  getAuthorization(): Promise<ScreenTimeAuthorization>;
  requestAuthorization(): Promise<ScreenTimeAuthorization>;
  /** Let the user pick what to block (system picker on iOS, app list on Android). */
  selectTargets(current: BlockTarget[]): Promise<BlockTarget[]>;
  startBlocking(request: BlockRequest): Promise<void>;
  stopBlocking(sessionId: string): Promise<void>;
  subscribe(listener: ScreenTimeListener): () => void;
}
