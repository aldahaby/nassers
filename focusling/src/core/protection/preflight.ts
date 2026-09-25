import type { ProtectionMode, ProtectionStatus } from '../models';

export type ProtectionStartError =
  | 'screen-time-not-authorized'
  | 'no-apps-selected'
  | 'screen-recognition-unavailable'
  | 'capture-not-confirmed'
  | 'native-error';

/**
 * What's missing before protection in `mode` can start. Checked before the
 * native start call; native confirmation is still required afterwards.
 */
export function protectionPreflight(mode: ProtectionMode, status: ProtectionStatus): ProtectionStartError | null {
  if (mode === 'none') return null;
  if (status.authorization !== 'approved') return 'screen-time-not-authorized';
  if (status.selectedTargetCount === 0) return 'no-apps-selected';
  if (mode === 'selective' && status.screenRecognition === 'unavailable') return 'screen-recognition-unavailable';
  return null;
}

/** Only native state decides whether protection is actually running for this session. */
export function isProtectionActiveFor(status: ProtectionStatus | null, sessionId: string | null | undefined): boolean {
  if (!status || !sessionId || status.currentSessionId !== sessionId) return false;
  if (status.activeMode === 'selective') return status.captureStatus === 'running';
  if (status.activeMode === 'wholeApp') return status.shieldStatus === 'session';
  return false;
}

/** Events from native carry the session they belong to; anything else is stale. */
export function isCurrentSessionEvent(eventSessionId: string | null | undefined, activeSessionId: string | null | undefined): boolean {
  return Boolean(eventSessionId) && eventSessionId === activeSessionId;
}
