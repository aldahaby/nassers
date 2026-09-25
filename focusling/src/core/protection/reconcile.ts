import type { ProtectionMode, ProtectionStatus } from '../models';

export type ReconcileAction =
  /** Native is protecting a session the game doesn't have: stop it. */
  | { kind: 'stop-native'; sessionId: string | null; reason: 'no-game-session' | 'session-mismatch' }
  /** Shields are up with nothing running: clear them. */
  | { kind: 'clear-stale-shields' };

export type ReconcileNotice =
  /** The game session expects selective protection but capture isn't running. */
  | 'reels-protection-stopped'
  /** The game session expects whole-app protection but no session shield is applied. */
  | 'app-protection-stopped'
  /** Screen Time permission was revoked mid-session. */
  | 'authorization-lost'
  | null;

export interface ReconcileInput {
  gameSessionId: string | null;
  /** The protection mode the game session was started with (null if none). */
  gameProtectionMode: ProtectionMode | null;
  native: ProtectionStatus;
}

/**
 * Compare the game's view with the native truth after launch/foreground.
 * Never mutates game rewards: protection problems only produce notices.
 */
export function reconcileProtection({ gameSessionId, gameProtectionMode, native }: ReconcileInput): {
  actions: ReconcileAction[];
  notice: ReconcileNotice;
} {
  const actions: ReconcileAction[] = [];
  const nativeBusy = native.currentSessionId !== null || native.captureStatus === 'running' || native.monitoringStatus === 'active';

  if (!gameSessionId) {
    if (nativeBusy) actions.push({ kind: 'stop-native', sessionId: native.currentSessionId, reason: 'no-game-session' });
    else if (native.shieldStatus !== 'none') actions.push({ kind: 'clear-stale-shields' });
    return { actions, notice: null };
  }

  if (native.currentSessionId && native.currentSessionId !== gameSessionId) {
    actions.push({ kind: 'stop-native', sessionId: native.currentSessionId, reason: 'session-mismatch' });
  }

  const expected = gameProtectionMode ?? 'none';
  if (expected === 'none') return { actions, notice: null };
  if (native.authorization !== 'approved') return { actions, notice: 'authorization-lost' };

  const matches = native.currentSessionId === gameSessionId;
  if (expected === 'selective' && !(matches && native.captureStatus === 'running')) {
    return { actions, notice: 'reels-protection-stopped' };
  }
  if (expected === 'wholeApp' && !(matches && native.shieldStatus === 'session')) {
    return { actions, notice: 'app-protection-stopped' };
  }
  return { actions, notice: null };
}
