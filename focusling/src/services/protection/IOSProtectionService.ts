import { CAPTURE_CONFIG } from '@/config/protection';
import type { ContentSurface, ProtectionStartError, ProtectionStatus } from '@/core';
import type {
  FocusProtectionService,
  ProtectionEndReason,
  ProtectionEvent,
  ProtectionStartRequest,
  ProtectionStartResult,
} from './FocusProtectionService';
import type { FocuslingProtectionNativeModule } from './nativeModule';

const START_ERRORS: readonly ProtectionStartError[] = [
  'screen-time-not-authorized',
  'no-apps-selected',
  'screen-recognition-unavailable',
  'capture-not-confirmed',
];

/** Native error codes are thrown as `ERR_<code>`; map them back to typed start errors. */
function toStartError(error: unknown): { error: ProtectionStartError; message?: string } {
  const code = String((error as { code?: string })?.code ?? '').replace(/^ERR_/, '').toLowerCase().replace(/_/g, '-');
  const match = START_ERRORS.find((e) => e === code);
  return { error: match ?? 'native-error', message: (error as Error)?.message };
}

/** Real iOS implementation backed by the Swift module (Family Controls, ManagedSettings, DeviceActivity, ScreenCaptureKit). */
export class IOSProtectionService implements FocusProtectionService {
  readonly platform = 'ios' as const;

  constructor(private readonly native: FocuslingProtectionNativeModule) {}

  getStatus() {
    return this.native.getStatus();
  }

  requestAuthorization() {
    return this.native.requestAuthorization();
  }

  selectApps() {
    return this.native.presentAppPicker();
  }

  async startProtection(request: ProtectionStartRequest): Promise<ProtectionStartResult> {
    try {
      const status = await this.native.startProtection({
        sessionId: request.sessionId,
        mode: request.mode,
        surfaces: request.surfaces,
        endsAtMs: request.endsAt,
        policy: { ...request.policy },
        samplesPerSecond: CAPTURE_CONFIG.samplesPerSecond,
        analysisMaxDimension: CAPTURE_CONFIG.analysisMaxDimension,
        interventionShieldTimeoutMs: CAPTURE_CONFIG.interventionShieldTimeoutMs,
        petName: request.petName,
      });
      return { ok: true, status };
    } catch (error) {
      return { ok: false, ...toStartError(error) };
    }
  }

  endProtection(sessionId: string | null, reason: ProtectionEndReason) {
    return this.native.endProtection(sessionId, reason);
  }

  emergencyCleanup() {
    return this.native.emergencyCleanup();
  }

  subscribe(listener: (event: ProtectionEvent) => void) {
    const subs = [
      this.native.addListener('onStatus', (p) => listener({ type: 'status', status: p as unknown as ProtectionStatus })),
      this.native.addListener('onIntervention', (p) =>
        listener({ type: 'intervention', sessionId: String(p.sessionId), surface: p.surface as ContentSurface, at: Number(p.at) }),
      ),
      this.native.addListener('onCaptureStopped', (p) =>
        listener({
          type: 'capture-stopped',
          sessionId: String(p.sessionId),
          reason: (p.reason as 'user-stopped' | 'system' | 'error') ?? 'system',
        }),
      ),
      this.native.addListener('onAuthorizationLost', () => listener({ type: 'authorization-lost' })),
    ];
    return () => subs.forEach((s) => s.remove());
  }

  readonly debug = {
    triggerFakeDetection: () => this.native.debugTriggerFakeDetection(),
    clearShields: () => this.native.debugClearShields(),
    stopCapture: () => this.native.debugStopCapture(),
    restartCapture: () => this.native.debugRestartCapture(),
  };
}
