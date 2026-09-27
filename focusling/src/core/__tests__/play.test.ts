import { MEMORY_GARDEN, PLAY_ECONOMY, TOY_TOSS } from '@/config/play';
import { adoptPet } from '../game/gameEngine';
import { debugSimulateNextDay } from '../game/debugDay';
import { chooseAppMode, setPlaySettings } from '../family/familyService';
import { addMission, debugCompleteMission, draftFromPreset } from '../missions/missionService';
import { getMissionPreset } from '@/config/missions';
import {
  completeGameRound,
  debugGrantPlayCoins,
  debugPlayCapOneLeft,
  debugResetDailyPlay,
  debugUnlockPlay,
  getPlayAccess,
  playCoinsRemaining,
} from '../play/playService';
import { createMemoryDeck, flipCard, hideMismatch, isMemoryComplete, pairsFound } from '../play/memoryGarden';
import { countCatches, judgeToss, markerPosition } from '../play/toyToss';
import { migrateSave } from '../save/migrations';
import { createNewSave } from '../save/createNewSave';
import type { GameSave } from '../models';

const T0 = new Date(2026, 8, 25, 16, 0).getTime();
const fresh = (): GameSave => {
  const s = adoptPet(createNewSave(T0), 'cloudling', 'Nimbus', T0);
  return { ...s, pet: { ...s.pet!, stats: { health: 80, happiness: 50 } } };
};
let n = 0;
const round = (gameId: 'memoryGarden' | 'toyToss', score = 0) => ({ gameId, roundId: `r${(n += 1)}`, score });

describe('Memory Garden rules', () => {
  it('deals 4 pairs and completes when every pair is found', () => {
    let state = createMemoryDeck(42);
    expect(state.cards).toHaveLength(MEMORY_GARDEN.pairs * 2);
    const byItem = new Map<string, number[]>();
    state.cards.forEach((c, i) => byItem.set(c.itemId, [...(byItem.get(c.itemId) ?? []), i]));
    // One deliberate mismatch first.
    const [firstPair, secondPair] = [...byItem.values()];
    let r = flipCard(state, firstPair![0]!);
    r = flipCard(r.state, secondPair![0]!);
    expect(r.outcome).toBe('mismatch');
    expect(flipCard(r.state, firstPair![1]!).outcome).toBe('ignored'); // two already face up
    state = hideMismatch(r.state);
    for (const pair of byItem.values()) {
      state = flipCard(state, pair[0]!).state;
      const m = flipCard(state, pair[1]!);
      expect(m.outcome).toBe('match');
      state = m.state;
    }
    expect(isMemoryComplete(state)).toBe(true);
    expect(pairsFound(state)).toBe(4);
    expect(state.moves).toBe(5);
  });

  it('shuffles deterministically per seed', () => {
    expect(createMemoryDeck(1).cards.map((c) => c.itemId)).toEqual(createMemoryDeck(1).cards.map((c) => c.itemId));
  });
});

describe('Toy Toss rules', () => {
  it('moves at a constant speed and judges catches by distance from the pet', () => {
    const cross = TOY_TOSS.markerCrossSeconds * 1000;
    expect(markerPosition(0)).toBe(0);
    expect(markerPosition(cross / 2)).toBeCloseTo(0.5);
    expect(markerPosition(cross)).toBeCloseTo(1);
    expect(markerPosition(cross * 1.5)).toBeCloseTo(0.5);
    // Same position after many laps: never speeds up.
    expect(markerPosition(cross * 40 + cross / 2)).toBeCloseTo(0.5);
    expect(judgeToss(0.52)).toBe('perfect');
    expect(judgeToss(0.65)).toBe('good');
    expect(judgeToss(0.95)).toBe('miss');
    expect(countCatches(['perfect', 'miss', 'good', 'good', 'miss'])).toBe(3);
  });
});

describe('play rewards', () => {
  it('pays a finished Memory Garden round once', () => {
    const r1 = round('memoryGarden');
    const a = completeGameRound(fresh(), r1, T0);
    expect(a.result).toMatchObject({ coins: MEMORY_GARDEN.coins, happiness: 1, duplicate: false });
    const b = completeGameRound(a.save, r1, T0);
    expect(b.result).toMatchObject({ coins: 0, happiness: 0, duplicate: true });
    expect(b.save.wallet.coins).toBe(a.save.wallet.coins);
  });

  it('pays Toy Toss by catches, with small differences', () => {
    expect(completeGameRound(fresh(), round('toyToss', 0), T0).result.coins).toBe(1);
    expect(completeGameRound(fresh(), round('toyToss', 3), T0).result.coins).toBe(2);
    expect(completeGameRound(fresh(), round('toyToss', 5), T0).result.coins).toBe(3);
  });

  it('an aborted round pays nothing because it is never completed', () => {
    const save = fresh();
    expect(save.play.coinsEarned).toBe(0); // starting a round alone changes nothing
  });

  it('accumulates toward the daily cap and never pays above it', () => {
    let save = fresh();
    const start = save.wallet.coins;
    for (let i = 0; i < 10; i += 1) save = completeGameRound(save, round('toyToss', 5), T0).save;
    expect(save.play.coinsEarned).toBe(PLAY_ECONOMY.dailyCoinCap);
    expect(save.wallet.coins - start).toBe(PLAY_ECONOMY.dailyCoinCap);
    const after = completeGameRound(save, round('memoryGarden'), T0);
    expect(after.result).toMatchObject({ coins: 0, capReached: true, duplicate: false });
    expect(after.save.play.completions.memoryGarden).toBe(1); // still playable and counted
  });

  it('pays only the remaining coin when one is left', () => {
    const save = debugPlayCapOneLeft(fresh(), T0);
    expect(playCoinsRemaining(save, T0)).toBe(1);
    const r = completeGameRound(save, round('toyToss', 5), T0);
    expect(r.result).toMatchObject({ coins: 1, capReached: true });
    expect(r.save.play.coinsEarned).toBe(PLAY_ECONOMY.dailyCoinCap);
  });

  it('caps happiness from play each day', () => {
    let save = fresh();
    for (let i = 0; i < 10; i += 1) save = completeGameRound(save, round('memoryGarden'), T0).save;
    expect(save.pet!.stats.happiness).toBe(50 + PLAY_ECONOMY.dailyHappinessCap);
  });

  it('a new day resets the cap; reloading does not duplicate rewards', () => {
    let save = fresh();
    for (let i = 0; i < 5; i += 1) save = completeGameRound(save, round('toyToss', 5), T0).save;
    const r = round('memoryGarden');
    save = completeGameRound(save, r, T0).save;
    const reloaded = migrateSave(JSON.parse(JSON.stringify(save)));
    expect(completeGameRound(reloaded, r, T0).result.duplicate).toBe(true);
    const tomorrow = T0 + 24 * 3600 * 1000;
    expect(playCoinsRemaining(reloaded, tomorrow)).toBe(PLAY_ECONOMY.dailyCoinCap);
    expect(completeGameRound(reloaded, round('memoryGarden'), tomorrow).result.coins).toBe(MEMORY_GARDEN.coins);
    expect(completeGameRound(reloaded, r, tomorrow).result.duplicate).toBe(true); // IDs survive the day change
  });

  it('developer helpers respect the cap and reset cleanly', () => {
    let save = debugGrantPlayCoins(fresh(), 50, T0);
    expect(save.play.coinsEarned).toBe(PLAY_ECONOMY.dailyCoinCap);
    save = debugResetDailyPlay(save, T0);
    expect(playCoinsRemaining(save, T0)).toBe(PLAY_ECONOMY.dailyCoinCap);
    expect(debugSimulateNextDay(save).play.date).not.toBe(save.play.date);
  });
});

describe('play access', () => {
  it('is always open in self mode', () => {
    expect(getPlayAccess(fresh(), T0)).toEqual({ open: true });
  });

  it('in family mode can wait for a finished mission, and a completed mission unlocks it for the day', () => {
    let save = setPlaySettings(chooseAppMode(fresh(), 'family'), { access: 'afterMission' });
    const added = addMission(save, draftFromPreset(getMissionPreset('homework-buddy')!), 'm1', T0);
    if (!added.ok) throw new Error(added.error);
    save = added.value;
    expect(getPlayAccess(save, T0)).toEqual({ open: false, reason: 'finish-mission' });
    save = debugCompleteMission(save, 'm1', T0).save;
    expect(getPlayAccess(save, T0)).toEqual({ open: true });
    expect(getPlayAccess(save, T0 + 24 * 3600 * 1000)).toEqual({ open: false, reason: 'finish-mission' });
  });

  it('the developer unlock only lasts today', () => {
    const save = debugUnlockPlay(setPlaySettings(chooseAppMode(fresh(), 'family'), { access: 'afterMission' }), T0);
    expect(getPlayAccess(save, T0).open).toBe(true);
    expect(getPlayAccess(save, T0 + 24 * 3600 * 1000).open).toBe(false);
  });

  it('a locked (mission-gated) Play pays nothing and leaves the save untouched', () => {
    const save = setPlaySettings(chooseAppMode(fresh(), 'family'), { access: 'afterMission' });
    const { save: after, result } = completeGameRound(save, { gameId: 'memoryGarden', roundId: 'r-locked', score: 4 }, T0);
    expect(result).toMatchObject({ coins: 0, locked: true });
    expect(after).toBe(save);
  });
});
