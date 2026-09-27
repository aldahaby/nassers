import type { FocusSession, ProtectionSettings, ProtectionStatus } from '../models';
import { isProtectionActiveFor } from './preflight';

export type ProtectionDisplayState = 'off' | 'configured' | 'simulated' | 'active' | 'unavailable';

/**
 * Honest one-word state for dashboards. "Active" only when native status
 * confirms it for the running session; the web build always says "simulated".
 */
export function describeProtection(
  settings: ProtectionSettings,
  status: ProtectionStatus | null,
  activeSession: FocusSession | null,
): ProtectionDisplayState {
  if (settings.mode === 'none') return 'off';
  if (!status || status.platform === 'mock') return 'simulated';
  if (settings.mode === 'selective' && status.screenRecognition === 'unavailable') return 'unavailable';
  if (activeSession && activeSession.protectionMode !== 'none' && isProtectionActiveFor(status, activeSession.id)) return 'active';
  return 'configured';
}
