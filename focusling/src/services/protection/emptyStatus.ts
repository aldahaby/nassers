import type { ProtectionStatus } from '@/core';

export function emptyProtectionStatus(platform: ProtectionStatus['platform']): ProtectionStatus {
  return {
    platform,
    authorization: 'notDetermined',
    screenRecognition: 'unknown',
    captureStatus: 'idle',
    monitoringStatus: 'idle',
    shieldStatus: 'none',
    selectedTargetCount: 0,
    currentSessionId: null,
    activeMode: 'none',
    detection: { latest: null, votes: 0, window: 0, lastInterventionAt: null },
    lastError: null,
  };
}
