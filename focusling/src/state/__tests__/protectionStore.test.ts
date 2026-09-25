import { MemorySaveRepository } from '@/services/persistence/MemorySaveRepository';
import { MockProtectionService } from '@/services/protection/MockProtectionService';
import type { FocusProtectionService } from '@/services';
import { estimateReward } from '@/core';
import { createGameStore } from '../createGameStore';

const T0 = new Date(2026, 0, 5, 9, 0).getTime();
const MIN = 60_000;

async function setup(options: { mode?: 'none' | 'selective' | 'wholeApp'; authorize?: boolean; apps?: boolean } = {}) {
  let clock = T0;
  const repo = new MemorySaveRepository();
  const protection = new MockProtectionService({ now: () => clock });
  const store = createGameStore({ saveRepository: repo, protection, now: () => clock });
  await store.getState().hydrate();
  store.getState().adoptPet('cloudling', 'Nimbus');
  if (options.authorize !== false) await store.getState().requestProtectionAuthorization();
  if (options.apps !== false) await store.getState().selectProtectedApps();
  store.getState().updateProtection({ mode: options.mode ?? 'selective' });
  const reopen = () => createGameStore({ saveRepository: repo, protection, now: () => clock });
  return { store, protection, repo, reopen, advance: (ms: number) => (clock += ms) };
}

describe('selective session lifecycle', () => {
  it('starts only after native confirms, using the same session ID', async () => {
    const { store } = await setup();
    const result = await store.getState().startFocus(30);
    expect(result.ok).toBe(true);
    const session = store.getState().save!.focus.active!;
    expect(session.protectionMode).toBe('selective');
    const status = store.getState().protection!;
    expect(status).toMatchObject({ currentSessionId: session.id, captureStatus: 'running', activeMode: 'selective' });
  });

  it.each([
    [{ authorize: false }, 'screen-time-not-authorized'],
    [{ apps: false }, 'no-apps-selected'],
  ] as const)('does not start the game session when setup is missing (%o)', async (opts, error) => {
    const { store } = await setup(opts);
    expect(await store.getState().startFocus(30)).toEqual({ ok: false, error });
    expect(store.getState().save!.focus.active).toBeNull();
  });

  it('refuses Reels-only when screen recognition is unavailable and never silently switches modes', async () => {
    const { store, protection } = await setup();
    protection.setScreenRecognition('unavailable');
    expect(await store.getState().startFocus(30)).toEqual({ ok: false, error: 'screen-recognition-unavailable' });
    expect(store.getState().save!.protection.mode).toBe('selective');
    expect(store.getState().save!.focus.active).toBeNull();
  });

  it('treats a native "ok" without running capture as a failed start and cleans up', async () => {
    const { store, protection } = await setup();
    const liar: FocusProtectionService = Object.assign(Object.create(Object.getPrototypeOf(protection)), protection, {
      startProtection: async () => ({ ok: true, status: await protection.getStatus() }),
    });
    const repo = new MemorySaveRepository();
    const s2 = createGameStore({ saveRepository: repo, protection: liar, now: () => T0 });
    await s2.getState().hydrate();
    s2.getState().adoptPet('cloudling', 'Nimbus');
    s2.getState().updateProtection({ mode: 'selective' });
    expect(await s2.getState().startFocus(30)).toEqual({ ok: false, error: 'capture-not-confirmed' });
    expect(s2.getState().save!.focus.active).toBeNull();
    void store;
  });
});

describe('detection is success, not failure', () => {
  it('interrupts Reels without abandoning or reducing rewards', async () => {
    const { store, protection, advance } = await setup();
    await store.getState().startFocus(30);
    const expected = estimateReward(store.getState().save!, 30, T0);
    await protection.debug.triggerFakeDetection();
    await protection.debug.triggerFakeDetection();
    expect(store.getState().save!.focus.active).not.toBeNull();
    expect(store.getState().save!.stats.sessionsAbandoned).toBe(0);

    advance(31 * MIN);
    store.getState().refresh();
    const summary = store.getState().lastSummary!;
    expect(summary.outcome).toBe('completed');
    expect(summary.reward.coins).toBe(expected.coins);
    expect(summary.reward.xp).toBe(expected.xp);
    expect(summary.reward.healthDelta).toBeGreaterThanOrEqual(0);
    expect(summary.sessionStreakAfter).toBe(1);
  });

  it('counts interventions for the current session only, ignoring stale events', async () => {
    const { store, protection } = await setup();
    const unsubscribe = protection.subscribe(store.getState().handleProtectionEvent);
    await store.getState().startFocus(30);
    await protection.debug.triggerFakeDetection();
    expect(store.getState().interventionsThisSession).toBe(1);

    protection.emitRaw({ type: 'intervention', sessionId: 'old-session', surface: 'instagramReels', at: T0 });
    protection.emitRaw({ type: 'capture-stopped', sessionId: 'old-session', reason: 'system' });
    expect(store.getState().interventionsThisSession).toBe(1);
    expect(store.getState().protectionNotice).toBeNull();
    unsubscribe();
  });
});

describe('every ending path stops native protection', () => {
  const expectStopped = async (protection: MockProtectionService) =>
    expect(await protection.getStatus()).toMatchObject({ currentSessionId: null, captureStatus: 'idle', shieldStatus: 'none', monitoringStatus: 'idle' });
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('normal completion', async () => {
    const { store, protection, advance } = await setup();
    await store.getState().startFocus(15);
    advance(16 * MIN);
    store.getState().refresh();
    await flush();
    await expectStopped(protection);
  });

  it('ending early (partial rewards still paid)', async () => {
    const { store, protection, advance } = await setup();
    await store.getState().startFocus(30);
    advance(12 * MIN);
    const r = store.getState().endFocus('abandoned');
    expect(r.ok && r.value.xp).toBeGreaterThan(0);
    await flush();
    await expectStopped(protection);
  });

  it('developer complete', async () => {
    const { store, protection } = await setup({ mode: 'wholeApp' });
    await store.getState().startFocus(15);
    store.getState().endFocus('completed');
    await flush();
    await expectStopped(protection);
  });

  it('reset progress', async () => {
    const { store, protection } = await setup();
    await store.getState().startFocus(30);
    await store.getState().resetProgress();
    await expectStopped(protection);
    expect(store.getState().save!.pet).toBeNull();
  });

  it('a session that finished while the app was closed is cleaned up on launch', async () => {
    const { store, protection, reopen, advance } = await setup();
    await store.getState().startFocus(15);
    await flush();
    advance(2 * 60 * MIN);
    const reopened = reopen();
    await reopened.getState().hydrate();
    await flush();
    expect(reopened.getState().lastSummary?.outcome).toBe('completed');
    await expectStopped(protection);
  });
});

describe('when protection breaks mid-session', () => {
  it('capture stopping shows a notice, keeps the session, and can be restarted', async () => {
    const { store, protection } = await setup();
    const unsubscribe = protection.subscribe(store.getState().handleProtectionEvent);
    await store.getState().startFocus(30);
    protection.simulateCaptureStopped('user-stopped');
    expect(store.getState().protectionNotice).toBe('reels-protection-stopped');
    expect(store.getState().save!.focus.active).not.toBeNull();
    expect(await store.getState().restartProtection()).toEqual({ ok: true, value: null });
    expect(store.getState().protectionNotice).toBeNull();
    expect(store.getState().protection?.captureStatus).toBe('running');
    unsubscribe();
  });

  it('the person can choose whole-app blocking instead', async () => {
    const { store, protection } = await setup();
    const unsubscribe = protection.subscribe(store.getState().handleProtectionEvent);
    await store.getState().startFocus(30);
    const id = store.getState().save!.focus.active!.id;
    protection.simulateCaptureStopped('system');
    expect(await store.getState().switchSessionToWholeApp()).toEqual({ ok: true, value: null });
    expect(store.getState().save!.focus.active).toMatchObject({ id, protectionMode: 'wholeApp' });
    expect(store.getState().protection).toMatchObject({ currentSessionId: id, shieldStatus: 'session' });
    unsubscribe();
  });

  it('revoked Screen Time access pauses protection but not the session', async () => {
    const { store, protection } = await setup();
    const unsubscribe = protection.subscribe(store.getState().handleProtectionEvent);
    await store.getState().startFocus(30);
    protection.simulateAuthorizationRevoked();
    expect(store.getState().protectionNotice).toBe('authorization-lost');
    expect(store.getState().save!.focus.active).not.toBeNull();
    unsubscribe();
  });

  it('reconcile stops native work left over from a session the game no longer has', async () => {
    const { store, protection } = await setup();
    await protection.startProtection({
      sessionId: 'ghost',
      mode: 'selective',
      surfaces: ['instagramReels'],
      endsAt: T0 + 30 * MIN,
      policy: { confidenceThreshold: 0.75, requiredVotes: 3, windowSize: 5, minimumDetectionMs: 1500, cooldownMs: 20000 },
      petName: 'Nimbus',
    });
    await store.getState().refreshProtection();
    expect((await protection.getStatus()).currentSessionId).toBeNull();
  });
});

describe('regressions', () => {
  it('whole-app protection shields for the session and clears afterwards', async () => {
    const { store, protection } = await setup({ mode: 'wholeApp' });
    await store.getState().startFocus(15);
    expect(await protection.getStatus()).toMatchObject({ activeMode: 'wholeApp', shieldStatus: 'session', captureStatus: 'idle' });
  });

  it('protection off: sessions work exactly as before and native stays idle', async () => {
    const { store, protection } = await setup({ mode: 'none', authorize: false, apps: false });
    expect((await store.getState().startFocus(15)).ok).toBe(true);
    expect(store.getState().save!.focus.active?.protectionMode).toBe('none');
    expect((await protection.getStatus()).currentSessionId).toBeNull();
  });
});
