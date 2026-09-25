import { DETECTION_POLICY } from '@/config/protection';
import vectors from '@/config/protectionVectors.json';
import { createDetectionState, recordSample } from '../protection/detectionPolicy';
import { isCurrentSessionEvent, isProtectionActiveFor, protectionPreflight } from '../protection/preflight';
import { reconcileProtection } from '../protection/reconcile';
import type { ProtectionStatus, SurfaceClassification } from '../models';

const status = (patch: Partial<ProtectionStatus> = {}): ProtectionStatus => ({
  platform: 'ios',
  authorization: 'approved',
  screenRecognition: 'available',
  captureStatus: 'idle',
  monitoringStatus: 'idle',
  shieldStatus: 'none',
  selectedTargetCount: 1,
  currentSessionId: null,
  activeMode: 'none',
  detection: { latest: null, votes: 0, window: 5, lastInterventionAt: null },
  lastError: null,
  ...patch,
});

describe('DetectionPolicy (shared vectors)', () => {
  it('uses the same policy as the app config', () => {
    expect(vectors.policy).toEqual({ ...DETECTION_POLICY });
  });

  for (const testCase of vectors.cases) {
    it(testCase.name, () => {
      let state = createDetectionState();
      const interventions: number[] = [];
      for (const sample of testCase.samples) {
        const c: SurfaceClassification = {
          app: 'instagram',
          surface: sample.surface === 'reels' ? 'instagramReels' : 'other',
          confidence: sample.confidence,
        };
        const result = recordSample(state, c, sample.at, 'instagramReels', vectors.policy);
        state = result.state;
        if (result.decision.intervene) interventions.push(sample.at);
      }
      expect(interventions).toEqual(testCase.expectInterventionsAt);
    });
  }

  it('a single suspicious frame never shields, even at full confidence', () => {
    const r = recordSample(createDetectionState(), { app: 'instagram', surface: 'instagramReels', confidence: 1 }, 0, 'instagramReels', DETECTION_POLICY);
    expect(r.decision.intervene).toBe(false);
  });
});

describe('protection preflight', () => {
  it('needs nothing when protection is off', () => {
    expect(protectionPreflight('none', status({ authorization: 'denied', selectedTargetCount: 0 }))).toBeNull();
  });
  it('requires Screen Time access and an app for both modes', () => {
    expect(protectionPreflight('wholeApp', status({ authorization: 'notDetermined' }))).toBe('screen-time-not-authorized');
    expect(protectionPreflight('selective', status({ selectedTargetCount: 0 }))).toBe('no-apps-selected');
  });
  it('requires screen recognition only for Reels-only mode', () => {
    expect(protectionPreflight('selective', status({ screenRecognition: 'unavailable' }))).toBe('screen-recognition-unavailable');
    expect(protectionPreflight('wholeApp', status({ screenRecognition: 'unavailable' }))).toBeNull();
  });
});

describe('native state is authoritative', () => {
  it('only reports active for the matching session and a running mechanism', () => {
    expect(isProtectionActiveFor(status({ currentSessionId: 's1', activeMode: 'selective', captureStatus: 'running' }), 's1')).toBe(true);
    expect(isProtectionActiveFor(status({ currentSessionId: 's1', activeMode: 'selective', captureStatus: 'stopped' }), 's1')).toBe(false);
    expect(isProtectionActiveFor(status({ currentSessionId: 's0', activeMode: 'selective', captureStatus: 'running' }), 's1')).toBe(false);
    expect(isProtectionActiveFor(status({ currentSessionId: 's1', activeMode: 'wholeApp', shieldStatus: 'session' }), 's1')).toBe(true);
    expect(isProtectionActiveFor(null, 's1')).toBe(false);
  });
  it('ignores stale events', () => {
    expect(isCurrentSessionEvent('old', 'new')).toBe(false);
    expect(isCurrentSessionEvent('new', 'new')).toBe(true);
    expect(isCurrentSessionEvent('x', null)).toBe(false);
  });
});

describe('JS/native reconciliation', () => {
  it('continues when both agree', () => {
    const native = status({ currentSessionId: 's1', activeMode: 'selective', captureStatus: 'running', monitoringStatus: 'active' });
    expect(reconcileProtection({ gameSessionId: 's1', gameProtectionMode: 'selective', native })).toEqual({ actions: [], notice: null });
  });
  it('reports stopped capture without touching the session', () => {
    const native = status({ currentSessionId: 's1', activeMode: 'selective', captureStatus: 'stopped', monitoringStatus: 'active' });
    expect(reconcileProtection({ gameSessionId: 's1', gameProtectionMode: 'selective', native }).notice).toBe('reels-protection-stopped');
  });
  it('stops native work when no game session exists', () => {
    const native = status({ currentSessionId: 'ghost', activeMode: 'selective', captureStatus: 'running' });
    expect(reconcileProtection({ gameSessionId: null, gameProtectionMode: null, native }).actions).toEqual([
      { kind: 'stop-native', sessionId: 'ghost', reason: 'no-game-session' },
    ]);
  });
  it('clears stale shields', () => {
    const native = status({ shieldStatus: 'intervention' });
    expect(reconcileProtection({ gameSessionId: null, gameProtectionMode: null, native }).actions).toEqual([{ kind: 'clear-stale-shields' }]);
  });
  it('stops a mismatched native session and flags missing protection', () => {
    const native = status({ currentSessionId: 'old', activeMode: 'wholeApp', shieldStatus: 'session', monitoringStatus: 'active' });
    const r = reconcileProtection({ gameSessionId: 'new', gameProtectionMode: 'wholeApp', native });
    expect(r.actions).toEqual([{ kind: 'stop-native', sessionId: 'old', reason: 'session-mismatch' }]);
    expect(r.notice).toBe('app-protection-stopped');
  });
  it('flags revoked authorization', () => {
    const native = status({ authorization: 'denied', currentSessionId: 's1' });
    expect(reconcileProtection({ gameSessionId: 's1', gameProtectionMode: 'selective', native }).notice).toBe('authorization-lost');
  });
});
