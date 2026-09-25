import { adoptPet, endSession, estimateReward, refreshSave, startSession, petPet } from '../game/gameEngine';
import { applyDecay } from '../pet/petCareService';
import { createNewSave } from '../save/createNewSave';
import { migrateSave } from '../save/migrations';
import { HOUR_MS, MINUTE_MS } from '../shared/dates';
import type { GameSave } from '../models';

const T0 = new Date(2026, 0, 5, 9, 0).getTime();

function newGame(): GameSave {
  return adoptPet(createNewSave(T0), 'sproutling', '  Basil ', T0);
}

function started(save: GameSave, minutes: number): GameSave {
  const r = startSession(save, minutes, [], T0);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

describe('gameEngine', () => {
  it('adopts a pet and completes onboarding', () => {
    const save = newGame();
    expect(save.pet?.name).toBe('Basil');
    expect(save.profile.onboardingCompletedAt).toBe(T0);
    expect(save.wallet.coins).toBe(20);
  });

  it('rejects invalid or overlapping sessions', () => {
    expect(startSession(newGame(), 2, [], T0)).toEqual({ ok: false, error: 'invalid-duration' });
    expect(startSession(started(newGame(), 30), 30, [], T0)).toEqual({ ok: false, error: 'session-already-active' });
    expect(startSession(createNewSave(T0), 30, [], T0)).toEqual({ ok: false, error: 'no-pet' });
  });

  it('pays out a completed session and updates every tracker', () => {
    const save = started(newGame(), 60);
    const estimate = estimateReward(save, 60, T0);
    const r = endSession(save, 'completed', T0 + 60 * MINUTE_MS);
    if (!r.ok) throw new Error(r.error);
    const { save: after, reward } = r.value;

    expect(reward.coins).toBe(estimate.coins);
    expect(reward.xp).toBe(180);
    expect(reward.leveledUpTo).toBe(3);
    expect(after.wallet.coins).toBe(20 + reward.coins);
    expect(after.pet?.lifetimeXp).toBe(180);
    expect(after.pet!.stats.happiness).toBeGreaterThan(save.pet!.stats.happiness - 1);
    expect(after.focus.active).toBeNull();
    expect(after.focus.history[0]?.status).toBe('completed');
    expect(after.stats).toMatchObject({ sessionsCompleted: 1, totalFocusMinutes: 60, longestSessionMinutes: 60 });
    expect(after.streak.currentDays).toBe(1);
    expect(Object.values(after.daily)[0]).toMatchObject({ focusMinutes: 60, sessionsCompleted: 1 });
  });

  it('pays partial credit for an abandoned session without harming health', () => {
    const save = started(newGame(), 60);
    const r = endSession(save, 'abandoned', T0 + 20 * MINUTE_MS);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.reward).toMatchObject({ focusedMinutes: 20, coins: 2, xp: 20, completionBonusCoins: 0 });
    expect(r.value.reward.healthDelta).toBe(0);
    expect(r.value.save.streak.currentSessionStreak).toBe(0);
    expect(r.value.save.stats.sessionsAbandoned).toBe(1);
  });

  it('auto-completes a session whose timer ran out while the app was closed', () => {
    const save = started(newGame(), 30);
    const early = refreshSave(save, T0 + 10 * MINUTE_MS);
    expect(early.completedSummary).toBeNull();
    expect(early.save.focus.active).not.toBeNull();

    const late = refreshSave(save, T0 + 45 * MINUTE_MS);
    expect(late.completedSummary?.outcome).toBe('completed');
    expect(late.completedSummary?.completedWhileAway).toBe(true);
    expect(late.save.focus.active).toBeNull();
  });

  it('decays stats gently and never below the floors', () => {
    const pet = newGame().pet!;
    const week = applyDecay(pet, T0 + 7 * 24 * HOUR_MS);
    expect(week.stats.happiness).toBe(35);
    expect(week.stats.health).toBe(50);
  });

  it('petting grants happiness only off cooldown', () => {
    const first = petPet(newGame(), T0);
    expect(first.happinessGained).toBe(1);
    expect(petPet(first.save, T0 + MINUTE_MS).happinessGained).toBe(0);
    expect(petPet(first.save, T0 + 6 * MINUTE_MS).happinessGained).toBe(1);
  });

  it('round-trips a save through JSON and migration', () => {
    const save = newGame();
    expect(migrateSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
    expect(() => migrateSave({ schemaVersion: 999 })).toThrow();
    expect(() => migrateSave(null)).toThrow();
  });
});
