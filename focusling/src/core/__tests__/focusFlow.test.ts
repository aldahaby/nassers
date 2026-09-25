import { debugPrimeXp, debugSetRemaining } from '../game/debugTools';
import {
  adoptPet,
  endSession,
  getActiveSessionProgress,
  previewAbandon,
  refreshSave,
  startSession,
} from '../game/gameEngine';
import { pickCelebration } from '../game/sessionSummary';
import { getProgression } from '../progression/progressionService';
import { createNewSave } from '../save/createNewSave';
import { MINUTE_MS } from '../shared/dates';
import type { GameSave, SessionReward } from '../models';

const T0 = new Date(2026, 0, 5, 9, 0).getTime();

function withPet(xp = 0): GameSave {
  const save = adoptPet(createNewSave(T0), 'cloudling', 'Nimbus', T0);
  return { ...save, pet: { ...save.pet!, lifetimeXp: xp } };
}

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

describe('active session progress', () => {
  it('derives timer and projection from timestamps', () => {
    const save = unwrap(startSession(withPet(), 30, [], T0));
    const p = getActiveSessionProgress(save, T0 + 12 * MINUTE_MS + 30_000)!;
    expect(p.remainingMs).toBe(17 * MINUTE_MS + 30_000);
    expect(p.elapsedMinutes).toBe(12);
    expect(p.progress).toBeCloseTo(12.5 / 30);
    expect(p.endsAt).toBe(T0 + 30 * MINUTE_MS);
    expect(p.projected).toMatchObject({ coins: 10, completionBonusCoins: 4, xp: 75 });
    expect(getActiveSessionProgress(withPet(), T0)).toBeNull();
  });

  it('previews the reduced reward for ending early', () => {
    const save = unwrap(startSession(withPet(), 60, [], T0));
    expect(previewAbandon(save, T0 + 20 * MINUTE_MS)).toEqual({ focusedMinutes: 20, coins: 2, xp: 20 });
    expect(previewAbandon(save, T0 + 2 * MINUTE_MS)).toEqual({ focusedMinutes: 2, coins: 0, xp: 0 });
  });
});

describe('session summary', () => {
  it('captures before/after values for the completion screen', () => {
    const save = unwrap(startSession(withPet(), 30, [], T0));
    const { summary, save: after } = unwrap(endSession(save, 'completed', T0 + 30 * MINUTE_MS));
    expect(summary).toMatchObject({
      outcome: 'completed',
      plannedMinutes: 30,
      coinsBefore: 20,
      coinsAfter: after.wallet.coins,
      xpBefore: 0,
      xpAfter: 75,
      dayStreakBefore: 0,
      dayStreakAfter: 1,
      sessionStreakAfter: 1,
      celebration: { kind: 'levelUp', level: 2 },
      completedWhileAway: false,
    });
  });

  it('flags sessions that finished while the app was closed', () => {
    const save = unwrap(startSession(withPet(), 15, [], T0));
    expect(refreshSave(save, T0 + 15 * MINUTE_MS + 5_000).completedSummary?.completedWhileAway).toBe(false);
    expect(refreshSave(save, T0 + 3 * 60 * MINUTE_MS).completedSummary?.completedWhileAway).toBe(true);
  });

  it('summarises an abandoned session neutrally, without a celebration when no milestone is crossed', () => {
    const save = unwrap(startSession(withPet(), 60, [], T0));
    const { summary } = unwrap(endSession(save, 'abandoned', T0 + 10 * MINUTE_MS));
    expect(summary).toMatchObject({ outcome: 'abandoned', celebration: null, sessionStreakAfter: 0 });
    expect(summary.reward).toMatchObject({ focusedMinutes: 10, completionBonusCoins: 0 });
  });

  it('picks the right celebration', () => {
    const reward = (r: Partial<SessionReward>) => ({ leveledUpTo: null, stageReached: null, ...r }) as SessionReward;
    expect(pickCelebration(reward({}), 0, 10)).toBeNull();
    expect(pickCelebration(reward({ leveledUpTo: 3 }), 100, 130)).toEqual({ kind: 'levelUp', level: 3 });
    expect(pickCelebration(reward({ leveledUpTo: 4, stageReached: 'young' }), 290, 320)).toEqual({
      kind: 'growth',
      from: 'baby',
      to: 'young',
      level: 4,
    });
    expect(pickCelebration(reward({ leveledUpTo: 20, stageReached: 'evolved' }), 4990, 5100)).toMatchObject({
      kind: 'evolution',
      from: 'adult',
      to: 'evolved',
    });
  });
});

describe('developer tools', () => {
  it('primes XP one short of each milestone so the next session crosses it', () => {
    const lvl = debugPrimeXp(withPet(60), 'levelUp');
    expect(lvl.pet!.lifetimeXp).toBe(124);
    const stage = debugPrimeXp(withPet(60), 'nextStage');
    expect(stage.pet!.lifetimeXp).toBe(299);
    const evo = debugPrimeXp(withPet(60), 'evolution');
    expect(evo.pet!.lifetimeXp).toBe(4999);
    expect(debugPrimeXp(withPet(6000), 'evolution').pet!.lifetimeXp).toBe(6000);

    const session = unwrap(startSession(evo, 15, [], T0));
    const { summary } = unwrap(endSession(session, 'completed', T0 + 15 * MINUTE_MS));
    expect(summary.celebration?.kind).toBe('evolution');
    expect(getProgression(summary.xpAfter).stage).toBe('evolved');
  });

  it('fast-forwards a session to nearly complete', () => {
    const save = unwrap(startSession(withPet(), 45, [], T0));
    const near = debugSetRemaining(save, 10_000, T0 + MINUTE_MS);
    const p = getActiveSessionProgress(near, T0 + MINUTE_MS)!;
    expect(p.remainingMs).toBe(10_000);
    expect(refreshSave(near, T0 + MINUTE_MS + 10_000).completedSummary?.reward.focusedMinutes).toBe(45);
  });
});
