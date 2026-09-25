import { MemorySaveRepository } from '@/services/persistence/MemorySaveRepository';
import { MockProtectionService } from '@/services/protection/MockProtectionService';
import { createGameStore } from '../createGameStore';

function setup() {
  let clock = new Date(2026, 0, 5, 9, 0).getTime();
  const repo = new MemorySaveRepository();
  const screenTime = new MockProtectionService();
  const store = createGameStore({ saveRepository: repo, protection: screenTime, now: () => clock });
  return { store, repo, screenTime, advance: (ms: number) => (clock += ms) };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('game store', () => {
  it('hydrates a new save, adopts, and persists', async () => {
    const { store, repo } = setup();
    await store.getState().hydrate();
    expect(store.getState().status).toBe('ready');
    store.getState().adoptPet('cloudling', 'Nimbus');
    await flush();
    const persisted = await repo.load();
    expect(persisted?.pet?.name).toBe('Nimbus');
  });

  it('runs a focus session through the screen-time service', async () => {
    const { store, screenTime, advance } = setup();
    await store.getState().hydrate();
    store.getState().adoptPet('cloudling', 'Nimbus');
    expect((await store.getState().startFocus(15)).ok).toBe(true);
    await flush();
    expect(store.getState().save?.focus.active?.protectionMode).toBe('none');
    expect((await screenTime.getStatus()).currentSessionId).toBeNull();

    advance(16 * 60_000);
    store.getState().refresh();
    expect(store.getState().save?.focus.active).toBeNull();
    expect(store.getState().lastSummary?.outcome).toBe('completed');
  });

  it('surfaces load errors instead of overwriting data', async () => {
    const { store, repo } = setup();
    repo.load = async () => {
      throw new Error('corrupt');
    };
    await store.getState().hydrate();
    expect(store.getState()).toMatchObject({ status: 'error', error: 'corrupt', save: null });
  });
});

describe('game store focus flow', () => {
  it('publishes a summary on completion and clears it on dismiss', async () => {
    const { store } = setup();
    await store.getState().hydrate();
    store.getState().adoptPet('sproutling', 'Basil');
    store.getState().debugPrimeXp('levelUp');
    await store.getState().startFocus(15);
    const result = store.getState().endFocus('completed');
    expect(result.ok).toBe(true);
    expect(store.getState().lastSummary?.celebration).toEqual({ kind: 'levelUp', level: 2 });
    store.getState().dismissSummary();
    expect(store.getState().lastSummary).toBeNull();
    // The pet screen greets the player once, then clears the flag.
    expect(store.getState().pendingWelcome).toBe('completed');
    store.getState().consumeWelcome();
    expect(store.getState().pendingWelcome).toBeNull();
  });

  it('completes a session that ran out while the app was closed, on the next launch', async () => {
    const { store, repo, screenTime, advance } = setup();
    await store.getState().hydrate();
    store.getState().adoptPet('sproutling', 'Basil');
    await store.getState().startFocus(30);
    await flush();

    // "Close" the app: build a fresh store over the same repository, hours later.
    const later = advance(3 * 60 * 60_000);
    const reopened = createGameStore({ saveRepository: repo, protection: screenTime, now: () => later });
    await reopened.getState().hydrate();
    expect(reopened.getState().save?.focus.active).toBeNull();
    expect(reopened.getState().lastSummary).toMatchObject({ outcome: 'completed', completedWhileAway: true });
  });

  it('keeps an unfinished session across a reload', async () => {
    const { store, repo, screenTime } = setup();
    await store.getState().hydrate();
    store.getState().adoptPet('sproutling', 'Basil');
    await store.getState().startFocus(30);
    await flush();
    const startedAt = (await repo.load())!.focus.active!.startedAt;

    const reopened = createGameStore({ saveRepository: repo, protection: screenTime, now: () => startedAt + 10 * 60_000 });
    await reopened.getState().hydrate();
    expect(reopened.getState().save?.focus.active?.startedAt).toBe(startedAt);
    expect(reopened.getState().lastSummary).toBeNull();
  });
});
