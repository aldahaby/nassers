import { DETECTION_POLICY, type DetectionPolicyConfig } from '@/config/protection';
import { createDetectionState, recordSample, type ProtectionStatus } from '@/core';
import { emptyProtectionStatus } from './emptyStatus';
import type {
  FocusProtectionService,
  ProtectionEndReason,
  ProtectionEvent,
  ProtectionStartRequest,
  ProtectionStartResult,
} from './FocusProtectionService';

/**
 * Web / prototype implementation. Nothing is blocked. It models the native
 * state machine closely enough to exercise every UI path, and runs fake
 * detections through the real DetectionPolicy.
 */
export class MockProtectionService implements FocusProtectionService {
  readonly platform = 'mock' as const;
  private status: ProtectionStatus = emptyProtectionStatus('mock');
  private listeners = new Set<(event: ProtectionEvent) => void>();
  private policy: DetectionPolicyConfig = { ...DETECTION_POLICY };
  private detection = createDetectionState();
  private clock: () => number;

  constructor(options: { now?: () => number; screenRecognition?: ProtectionStatus['screenRecognition'] } = {}) {
    this.clock = options.now ?? Date.now;
    this.status.screenRecognition = options.screenRecognition ?? 'available';
  }

  async getStatus() {
    return this.snapshot();
  }

  async requestAuthorization() {
    this.update({ authorization: 'approved' });
    return this.status.authorization;
  }

  async selectApps() {
    // The mock "selects" one app (Instagram).
    this.update({ selectedTargetCount: 1 });
    return 1;
  }

  async startProtection(request: ProtectionStartRequest): Promise<ProtectionStartResult> {
    if (this.status.authorization !== 'approved') return { ok: false, error: 'screen-time-not-authorized' };
    if (this.status.selectedTargetCount === 0) return { ok: false, error: 'no-apps-selected' };
    if (request.mode === 'selective' && this.status.screenRecognition !== 'available') {
      return { ok: false, error: 'screen-recognition-unavailable' };
    }
    this.policy = { ...request.policy };
    this.detection = createDetectionState();
    this.update({
      currentSessionId: request.sessionId,
      activeMode: request.mode,
      captureStatus: request.mode === 'selective' ? 'running' : 'idle',
      monitoringStatus: 'active',
      shieldStatus: request.mode === 'wholeApp' ? 'session' : 'none',
      lastError: null,
      detection: { latest: null, votes: 0, window: this.policy.windowSize, lastInterventionAt: null },
    });
    return { ok: true, status: this.snapshot() };
  }

  async endProtection(sessionId: string | null, _reason: ProtectionEndReason) {
    if (sessionId !== null && this.status.currentSessionId !== null && sessionId !== this.status.currentSessionId) return;
    this.reset();
  }

  async emergencyCleanup() {
    this.reset();
  }

  subscribe(listener: (event: ProtectionEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  readonly debug = {
    /** Feeds a burst of confident Reels samples through the real voting policy. */
    triggerFakeDetection: async () => {
      const sessionId = this.status.currentSessionId;
      if (!sessionId || this.status.activeMode !== 'selective') return;
      const start = this.clock();
      for (let i = 0; i < this.policy.windowSize; i += 1) {
        const at = start + i * 600;
        const classification = { app: 'instagram' as const, surface: 'instagramReels' as const, confidence: 0.95 };
        const { state, decision } = recordSample(this.detection, classification, at, 'instagramReels', this.policy);
        this.detection = state;
        this.update({ detection: { ...this.status.detection, latest: classification, votes: decision.votes } });
        if (decision.intervene) {
          this.update({
            shieldStatus: 'intervention',
            detection: { ...this.status.detection, votes: decision.votes, lastInterventionAt: at },
          });
          this.emit({ type: 'intervention', sessionId, surface: 'instagramReels', at });
          // The mock "person" taps Back to focus straight away.
          this.update({ shieldStatus: 'none' });
          return;
        }
      }
    },
    clearShields: async () => this.update({ shieldStatus: 'none' }),
    stopCapture: async () => this.simulateCaptureStopped('user-stopped'),
    restartCapture: async () => {
      if (this.status.currentSessionId && this.status.activeMode === 'selective') this.update({ captureStatus: 'running', lastError: null });
    },
  };

  // ── Test hooks ────────────────────────────────────────────────────────────
  simulateCaptureStopped(reason: 'user-stopped' | 'system' | 'error') {
    const sessionId = this.status.currentSessionId;
    if (!sessionId) return;
    this.update({ captureStatus: 'stopped' });
    this.emit({ type: 'capture-stopped', sessionId, reason });
  }

  simulateAuthorizationRevoked() {
    this.update({ authorization: 'denied', shieldStatus: 'none', captureStatus: 'stopped' });
    this.emit({ type: 'authorization-lost' });
  }

  setScreenRecognition(value: ProtectionStatus['screenRecognition']) {
    this.update({ screenRecognition: value });
  }

  /** Emits an event as if it came from native (for stale-event tests). */
  emitRaw(event: ProtectionEvent) {
    this.emit(event);
  }

  private reset() {
    this.detection = createDetectionState();
    this.update({
      currentSessionId: null,
      activeMode: 'none',
      captureStatus: 'idle',
      monitoringStatus: 'idle',
      shieldStatus: 'none',
      detection: { latest: null, votes: 0, window: 0, lastInterventionAt: null },
    });
  }

  private snapshot(): ProtectionStatus {
    return { ...this.status, detection: { ...this.status.detection } };
  }

  private update(patch: Partial<ProtectionStatus>) {
    this.status = { ...this.status, ...patch };
    this.emit({ type: 'status', status: this.snapshot() });
  }

  private emit(event: ProtectionEvent) {
    this.listeners.forEach((listener) => listener(event));
  }
}
