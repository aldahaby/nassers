import type { ProtectionDisplayState } from '@/core';

/** Parent-facing protection wording. Never claims blocking without native confirmation. */
export const PROTECTION_STATE_COPY: Record<ProtectionDisplayState, { label: string; body: string; tone: 'neutral' | 'good' | 'warn' }> = {
  off: { label: 'Off', body: 'No app protection during focus sessions. Sessions still work on the honor system.', tone: 'neutral' },
  configured: { label: 'Configured', body: 'Set up and waiting. It turns on when a focus session starts and iOS confirms it.', tone: 'neutral' },
  simulated: { label: 'Simulated', body: "This device can't block apps. Protection is only simulated here: nothing is actually blocked.", tone: 'warn' },
  active: { label: 'Active now', body: 'iOS confirmed protection for the current focus session.', tone: 'good' },
  unavailable: { label: 'Unavailable', body: "The chosen protection isn't available on this device right now.", tone: 'warn' },
};
