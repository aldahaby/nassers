import { getMissionPreset } from '@/config/missions';
import { PLAY_ECONOMY } from '@/config/play';
import { draftFromPreset } from '@/core';
import { MemorySaveRepository } from '@/services/persistence/MemorySaveRepository';
import { MockProtectionService } from '@/services/protection/MockProtectionService';
import { createGameStore } from '../createGameStore';

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(repo = new MemorySaveRepository(), start = new Date(2026, 0, 5, 16, 0).getTime()) {
  let clock = start;
  const store = createGameStore({ saveRepository: repo, protection: new MockProtectionService(), now: () => clock });
  return { store, repo, advance: (ms: number) => (clock += ms), now: () => clock };
}

/** A fresh store over the same repository: an app restart. */
async function reload(repo: MemorySaveRepository, now: number) {
  await flush();
  const next = setup(repo, now);
  await next.store.getState().hydrate();
  return next;
}

async function familySetup() {
  const ctx = setup();
  await ctx.store.getState().hydrate();
  const s = ctx.store.getState();
  s.chooseMode('family');
  expect(s.setParentPin('2468').ok).toBe(true);
  s.setChildNickname('Sunny');
  s.adoptPet('cloudling', 'Nimbus');
  return ctx;
}

describe('onboarding branch', () => {
  it('self onboarding completes at adoption and stays self after reload', async () => {
    const { store, repo, now } = setup();
    await store.getState().hydrate();
    store.getState().chooseMode('self');
    store.getState().adoptPet('sproutling', 'Basil');
    expect(store.getState().save?.profile.onboardingCompletedAt).not.toBeNull();
    const again = await reload(repo, now());
    expect(again.store.getState().save).toMatchObject({ mode: 'self', family: null });
  });

  it('family setup waits for the first mission, then persists mode, nickname and mission', async () => {
    const { store, repo, now } = await familySetup();
    expect(store.getState().save?.profile.onboardingCompletedAt).toBeNull();
    expect(store.getState().addMission(draftFromPreset(getMissionPreset('homework-buddy')!)).ok).toBe(true);
    store.getState().finishFamilySetup();
    expect(store.getState().familyView).toBe('child');

    const again = await reload(repo, now());
    const save = again.store.getState().save!;
    expect(save.mode).toBe('family');
    expect(save.family?.child.nickname).toBe('Sunny');
    expect(save.profile.onboardingCompletedAt).not.toBeNull();
    expect(save.missions.items.map((m) => m.title)).toEqual(['Homework Buddy']);
    // The PIN is never stored as the digits.
    expect(JSON.stringify(save)).not.toContain('2468');
    // A restart always lands in Child View.
    expect(again.store.getState().familyView).toBe('child');
  });
});

describe('parent gate', () => {
  it('opens Parent View only with the right PIN and persists throttling', async () => {
    const { store, repo, now } = await familySetup();
    store.getState().finishFamilySetup();
    expect(store.getState().unlockParentView('1111')).toMatchObject({ ok: false, reason: 'wrong' });
    expect(store.getState().familyView).toBe('child');
    for (let i = 0; i < 4; i += 1) store.getState().unlockParentView('1111');
    expect(store.getState().unlockParentView('2468')).toMatchObject({ ok: false, reason: 'locked' });

    // Restarting doesn't clear the pause.
    const again = await reload(repo, now());
    expect(again.store.getState().unlockParentView('2468')).toMatchObject({ ok: false, reason: 'locked' });
    again.advance(60_000);
    expect(again.store.getState().unlockParentView('2468')).toEqual({ ok: true });
    expect(again.store.getState().familyView).toBe('parent');
    again.store.getState().enterChildView();
    expect(again.store.getState().familyView).toBe('child');
  });

  it('developer shortcuts do nothing while developer tools are off', async () => {
    const { store } = await familySetup();
    store.getState().finishFamilySetup();
    expect(store.getState().debugEnterParentView()).toBe(false);
    expect(store.getState().familyView).toBe('child');
    store.getState().debugResetParentPin();
    expect(store.getState().save?.family?.gate).not.toBeNull();
    const coins = store.getState().save!.wallet.coins;
    store.getState().debugGrantPlayCoins(5);
    store.getState().debugUnlockPlay();
    expect(store.getState().save!.wallet.coins).toBe(coins);
    expect(store.getState().save!.play.debugUnlockedDate).toBeNull();

    store.getState().updateSettings({ debugToolsEnabled: true });
    expect(store.getState().debugEnterParentView()).toBe(true);
    expect(store.getState().familyView).toBe('parent');
  });
});

describe('missions and play through the store', () => {
  it('a completed session completes the mission once and pays into the wallet', async () => {
    const { store, repo, now, advance } = await familySetup();
    store.getState().addMission({ ...draftFromPreset(getMissionPreset('homework-buddy')!), target: 30 });
    store.getState().finishFamilySetup();
    const before = store.getState().save!.wallet.coins;

    await store.getState().startFocus(30);
    advance(30 * 60_000);
    const ended = store.getState().endFocus('completed');
    expect(ended.ok).toBe(true);
    const summary = store.getState().lastSummary!;
    expect(summary.missionCompletions.map((m) => m.title)).toEqual(['Homework Buddy']);
    const afterSession = store.getState().save!.wallet.coins;
    expect(afterSession - before).toBe(summary.reward.coins + summary.missionCompletions[0]!.coins);

    // A reload and another session the same day don't pay the mission again.
    const again = await reload(repo, now());
    await again.store.getState().startFocus(30);
    again.advance(30 * 60_000);
    again.store.getState().endFocus('completed');
    expect(again.store.getState().lastSummary?.missionCompletions).toEqual([]);
    expect(again.store.getState().save!.daily[Object.keys(again.store.getState().save!.daily).at(-1)!]?.missionsCompleted).toBe(1);
  });

  it('pays a game round once, respects the daily cap and survives reloads', async () => {
    const { store, repo, now } = setup();
    await store.getState().hydrate();
    store.getState().adoptPet('cloudling', 'Nimbus');
    const round = store.getState().startGameRound('toyToss');
    const first = store.getState().completeGameRound({ gameId: 'toyToss', roundId: round, score: 5 });
    expect(first.coins).toBe(3);
    expect(store.getState().completeGameRound({ gameId: 'toyToss', roundId: round, score: 5 })).toMatchObject({ coins: 0, duplicate: true });

    const again = await reload(repo, now());
    expect(again.store.getState().completeGameRound({ gameId: 'toyToss', roundId: round, score: 5 }).duplicate).toBe(true);
    let total = 3;
    for (let i = 0; i < 6; i += 1) {
      total += again.store.getState().completeGameRound({ gameId: 'toyToss', roundId: again.store.getState().startGameRound('toyToss'), score: 5 }).coins;
    }
    expect(total).toBe(PLAY_ECONOMY.dailyCoinCap);
    expect(again.store.getState().save!.play.coinsEarned).toBe(PLAY_ECONOMY.dailyCoinCap);
  });

  it('mission-gated Play stays locked until a mission is done', async () => {
    const { store } = await familySetup();
    store.getState().addMission(draftFromPreset(getMissionPreset('homework-buddy')!));
    store.getState().finishFamilySetup();
    store.getState().updatePlaySettings({ access: 'afterMission' });
    const locked = store.getState().completeGameRound({ gameId: 'memoryGarden', roundId: 'r1', score: 4 });
    expect(locked).toMatchObject({ coins: 0, locked: true });
    expect(store.getState().save!.play.coinsEarned).toBe(0);
  });
});
