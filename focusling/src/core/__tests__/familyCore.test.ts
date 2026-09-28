import { PARENT_GATE } from '@/config/family';
import { createParentGate, hashPin, isValidPin, lockoutFor, verifyParentPin } from '../family/parentGate';
import { chooseAppMode, completeFamilySetup, isFamilySetupReady, setChildNickname, setParentGate } from '../family/familyService';
import { adoptPet } from '../game/gameEngine';
import { purchaseItem, equipItem } from '../inventory/inventoryService';
import { createNewSave } from '../save/createNewSave';
import { migrateSave } from '../save/migrations';
import { sha256Hex } from '../shared/sha256';
import { describeProtection } from '../protection/describe';
import type { GameSave, ProtectionStatus } from '../models';

const T0 = new Date(2026, 8, 25, 16, 0).getTime();

describe('sha256', () => {
  it('matches known test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('The quick brown fox jumps over the lazy dog')).toBe('d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
  });
});

describe('parent gate', () => {
  const gate = createParentGate('4821', 'salt-1');

  it('accepts only 4-digit PINs', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
    expect(() => createParentGate('12', 's')).toThrow();
  });

  it('never stores the PIN in readable form', () => {
    const json = JSON.stringify(gate);
    expect(json).not.toContain('4821');
    expect(gate.hash).toBe(hashPin('4821', 'salt-1', PARENT_GATE.hashIterations));
    expect(createParentGate('4821', 'salt-2').hash).not.toBe(gate.hash); // salted
  });

  it('verifies the correct PIN and resets the counter', () => {
    const wrong = verifyParentPin(gate, '0000', T0);
    expect(wrong).toMatchObject({ ok: false, reason: 'wrong', attemptsBeforePause: PARENT_GATE.freeAttempts - 1 });
    const right = verifyParentPin(wrong.gate, '4821', T0);
    expect(right.ok).toBe(true);
    expect(right.gate.failedAttempts).toBe(0);
  });

  it('pauses after repeated wrong attempts, even for the right PIN, then allows retry', () => {
    let g = gate;
    for (let i = 0; i < PARENT_GATE.freeAttempts; i += 1) g = verifyParentPin(g, '1111', T0).gate;
    expect(g.lockedUntil).toBe(T0 + PARENT_GATE.lockoutMs);
    expect(verifyParentPin(g, '4821', T0 + 1000)).toMatchObject({ ok: false, reason: 'locked' });
    expect(verifyParentPin(g, '4821', T0 + PARENT_GATE.lockoutMs).ok).toBe(true);
  });

  it('lengthens the pause for further mistakes, up to a maximum', () => {
    expect(lockoutFor(PARENT_GATE.freeAttempts - 1)).toBe(0);
    expect(lockoutFor(PARENT_GATE.freeAttempts)).toBe(PARENT_GATE.lockoutMs);
    expect(lockoutFor(PARENT_GATE.freeAttempts + 1)).toBe(PARENT_GATE.lockoutMs * 2);
    expect(lockoutFor(PARENT_GATE.freeAttempts + 30)).toBe(PARENT_GATE.maxLockoutMs);
  });
});

describe('family setup', () => {
  it('needs a PIN, a nickname and a pet', () => {
    let save = chooseAppMode(createNewSave(T0), 'family');
    expect(save.mode).toBe('family');
    expect(isFamilySetupReady(save)).toBe(false);
    save = setParentGate(save, createParentGate('1234', 's'));
    save = setChildNickname(save, '  Mia the Great and Powerful ');
    expect(save.family!.child.nickname).toBe('Mia the Great an'); // trimmed + max length
    save = adoptPet(save, 'sproutling', 'Basil', T0, { completeOnboarding: false });
    expect(save.profile.onboardingCompletedAt).toBeNull();
    expect(isFamilySetupReady(save)).toBe(true);
    save = completeFamilySetup(save, T0);
    expect(save.profile.onboardingCompletedAt).toBe(T0);
    expect(save.family!.setupCompletedAt).toBe(T0);
  });

  it('self onboarding keeps family data empty', () => {
    const save = adoptPet(chooseAppMode(createNewSave(T0), 'self'), 'cloudling', 'Nimbus', T0);
    expect(save).toMatchObject({ mode: 'self', family: null });
    expect(save.profile.onboardingCompletedAt).toBe(T0);
  });
});

describe('v3 → v4 migration', () => {
  it('turns an existing save into a self-mode save without changing anything else', () => {
    let current: GameSave = adoptPet(createNewSave(T0), 'emberling', 'Toast', T0);
    current = { ...current, wallet: { coins: 500 }, pet: { ...current.pet!, lifetimeXp: 1234 } };
    const bought = purchaseItem(current, 'acc-cap', T0);
    if (!bought.ok) throw new Error(bought.error);
    const equipped = equipItem(bought.value.save, 'acc-cap');
    if (!equipped.ok) throw new Error(equipped.error);
    current = { ...equipped.value, protection: { ...equipped.value.protection, mode: 'wholeApp' } };
    current = { ...current, daily: { '2026-09-25': { date: '2026-09-25', focusMinutes: 30, sessionsCompleted: 1, sessionsAbandoned: 0, coinsEarned: 10, xpEarned: 75, missionsCompleted: 0, missionCoinsEarned: 0 } } };

    const v3 = JSON.parse(JSON.stringify(current));
    v3.schemaVersion = 3;
    for (const k of ['mode', 'family', 'missions', 'play']) delete v3[k];
    delete v3.daily['2026-09-25'].missionsCompleted;
    delete v3.daily['2026-09-25'].missionCoinsEarned;

    const migrated = migrateSave(v3);
    expect(migrated).toMatchObject({ schemaVersion: 7, mode: 'self', family: null, missions: { items: [], progress: {} } });
    expect(migrated.pet).toEqual(current.pet);
    expect(migrated.wallet).toEqual(current.wallet);
    expect(migrated.inventory).toEqual(current.inventory);
    expect(migrated.stats).toEqual(current.stats);
    expect(migrated.profile).toEqual(current.profile);
    expect(migrated.protection).toEqual(current.protection);
    expect(migrated.focus).toEqual(current.focus);
    expect(migrated.daily['2026-09-25']).toEqual(current.daily['2026-09-25']);
    expect(migrated.profile.onboardingCompletedAt).toBe(T0); // existing users never see onboarding again
  });
});

describe('protection honesty', () => {
  const status = (p: Partial<ProtectionStatus>): ProtectionStatus => ({
    platform: 'ios', authorization: 'approved', screenRecognition: 'available', captureStatus: 'idle', monitoringStatus: 'idle',
    shieldStatus: 'none', selectedTargetCount: 1, currentSessionId: null, activeMode: 'none',
    detection: { latest: null, votes: 0, window: 5, lastInterventionAt: null }, lastError: null, ...p,
  });
  const settings = (mode: 'none' | 'selective' | 'wholeApp') => ({ mode, surfaces: ['instagramReels' as const], fallbackBehavior: 'askUser' as const });
  const session = { id: 's1', protectionMode: 'selective' } as never;

  it('distinguishes off, simulated, configured, active and unavailable', () => {
    expect(describeProtection(settings('none'), status({}), null)).toBe('off');
    expect(describeProtection(settings('selective'), status({ platform: 'mock', captureStatus: 'running', currentSessionId: 's1', activeMode: 'selective' }), session)).toBe('simulated');
    expect(describeProtection(settings('selective'), status({}), null)).toBe('configured');
    expect(describeProtection(settings('selective'), status({ currentSessionId: 's1', activeMode: 'selective', captureStatus: 'running' }), session)).toBe('active');
    expect(describeProtection(settings('selective'), status({ screenRecognition: 'unavailable' }), null)).toBe('unavailable');
  });
});
