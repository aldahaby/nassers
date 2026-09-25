import { MemorySaveRepository, } from '@/services/persistence/MemorySaveRepository';
import { MockScreenTimeService } from '@/services/screenTime/MockScreenTimeService';
import { createGameStore } from '../createGameStore';

function setup() {
  let clock = new Date(2026, 0, 5, 9, 0).getTime();
  const repo = new MemorySaveRepository();
  const screenTime = new MockScreenTimeService();
  const store = createGameStore({ saveRepository: repo, screenTime, now: () => clock });
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
    expect(store.getState().startFocus(15, []).ok).toBe(true);
    await flush();
    expect(screenTime.activeRequest).not.toBeNull();

    advance(16 * 60_000);
    store.getState().refresh();
    expect(store.getState().save?.focus.active).toBeNull();
    expect(store.getState().lastReward?.outcome).toBe('completed');
    await flush();
    expect(screenTime.activeRequest).toBeNull();
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
