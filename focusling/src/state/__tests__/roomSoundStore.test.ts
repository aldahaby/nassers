import { MemorySaveRepository } from '@/services/persistence/MemorySaveRepository';
import { MockProtectionService } from '@/services/protection/MockProtectionService';
import { createGameStore } from '../createGameStore';

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(repo = new MemorySaveRepository(), start = new Date(2026, 8, 28, 10, 0).getTime()) {
  let clock = start;
  const store = createGameStore({ saveRepository: repo, protection: new MockProtectionService(), now: () => clock });
  return { store, repo, advance: (ms: number) => (clock += ms), now: () => clock };
}

async function reload(repo: MemorySaveRepository, now: number) {
  await flush();
  const next = setup(repo, now);
  await next.store.getState().hydrate();
  return next;
}

describe('room colour through the store', () => {
  it('persists across reload, focus sessions and resets to the default', async () => {
    const { store, repo, now } = setup();
    await store.getState().hydrate();
    store.getState().adoptPet('sproutling', 'Basil');
    store.getState().setRoomColor('#1e2447');
    expect(store.getState().save!.room.color).toBe('#1E2447');
    let again = await reload(repo, now());
    expect(again.store.getState().save!.room.color).toBe('#1E2447');
    // A focus session doesn't change the room.
    await again.store.getState().startFocus(25);
    expect(again.store.getState().save!.room.color).toBe('#1E2447');
    again.store.getState().setRoomColor(null);
    again = await reload(repo, now());
    expect(again.store.getState().save!.room.color).toBeNull();
  });

  it('works in Child View without the parent PIN, and survives reload there', async () => {
    const { store, repo, now } = setup();
    await store.getState().hydrate();
    const s = store.getState();
    s.chooseMode('family');
    expect(s.setParentPin('2468').ok).toBe(true);
    s.setChildNickname('Sunny');
    s.adoptPet('cloudling', 'Nimbus');
    s.enterChildView();
    store.getState().setRoomColor('#FBD9E3');
    expect(store.getState().save!.room.color).toBe('#FBD9E3');
    const again = await reload(repo, now());
    expect(again.store.getState().save!.room.color).toBe('#FBD9E3');
  });

  it('trying on a collection Look never changes the room', async () => {
    const { store } = setup();
    await store.getState().hydrate();
    store.getState().adoptPet('emberling', 'Cinder');
    store.getState().setRoomColor('#D5E3C8');
    store.getState().wearCollectionLook('moss-club');
    expect(store.getState().save!.room.color).toBe('#D5E3C8');
  });
});

describe('sound preference through the store', () => {
  it('Sound Effects defaults on, turns off immediately and persists across reload', async () => {
    const { store, repo, now } = setup();
    await store.getState().hydrate();
    store.getState().adoptPet('cloudling', 'Nimbus');
    expect(store.getState().save!.profile.settings.soundEnabled).toBe(true);
    store.getState().updateSettings({ soundEnabled: false });
    expect(store.getState().save!.profile.settings.soundEnabled).toBe(false);
    const again = await reload(repo, now());
    expect(again.store.getState().save!.profile.settings.soundEnabled).toBe(false);
  });
});
