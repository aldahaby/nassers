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

async function withPet(debug = true) {
  const ctx = setup();
  await ctx.store.getState().hydrate();
  ctx.store.getState().adoptPet('cloudling', 'Nimbus');
  if (debug) ctx.store.getState().updateSettings({ debugToolsEnabled: true });
  return ctx;
}

describe('style system through the store', () => {
  it('style developer shortcuts do nothing while developer tools are off', async () => {
    const { store } = await withPet(false);
    store.getState().debugUnlockCollection('midnight-arcade');
    store.getState().debugUnlockReactions();
    store.getState().debugSetSpecies('emberling');
    store.getState().debugTriggerCollectionComplete('dreamwave');
    const save = store.getState().save!;
    expect(save.inventory.items['ma-beanie']).toBeUndefined();
    expect(save.cosmetics.reactions.unlocked).not.toContain('pixel-pop');
    expect(save.pet?.speciesId).toBe('cloudling');
    expect(store.getState().styleCelebration).toBeNull();
  });

  it('unlocking a whole collection records completion once and survives reload', async () => {
    const { store, repo, now } = await withPet();
    store.getState().debugUnlockCollection('midnight-arcade');
    expect(store.getState().styleCelebration).toEqual({ kind: 'collection', collectionId: 'midnight-arcade' });
    expect(store.getState().save!.cosmetics.completedCollections).toEqual(['midnight-arcade']);
    const again = await reload(repo, now());
    expect(again.store.getState().save!.cosmetics.completedCollections).toEqual(['midnight-arcade']);
    expect(again.store.getState().save!.cosmetics.reactions.unlocked.filter((r) => r === 'pixel-pop')).toHaveLength(1);
    expect(again.store.getState().styleCelebration).toBeNull();
  });

  it('buying the final coin piece celebrates the collection', async () => {
    const { store } = await withPet();
    store.getState().debugCollectionAlmostDone('dreamwave');
    store.getState().debugGrant({ coins: 500 });
    const missing = ['dw-pearls', 'dw-shades-blue'].find((id) => !store.getState().save!.inventory.items[id])!;
    expect(store.getState().purchase(missing).ok).toBe(true);
    expect(store.getState().styleCelebration).toEqual({ kind: 'collection', collectionId: 'dreamwave' });
    expect(store.getState().save!.cosmetics.reactions.unlocked).toContain('dream-float');
  });

  it('favourite reaction and personal looks persist; locked reactions are refused', async () => {
    const { store, repo, now } = await withPet();
    expect(store.getState().equipReaction('victory-lap')).toEqual({ ok: false, error: 'locked' });
    expect(store.getState().equipReaction('cool-pose').ok).toBe(true);
    store.getState().debugWearCollectionLook('cloud-racer');
    store.getState().saveLook(0, 'Race day');
    store.getState().debugClearOutfit();
    const again = await reload(repo, now());
    const s = again.store.getState();
    expect(s.save!.cosmetics.reactions.equipped).toBe('cool-pose');
    expect(s.save!.cosmetics.looks[0]?.name).toBe('Race day');
    s.applyLook(0);
    expect(again.store.getState().save!.inventory.equipped).toMatchObject({ head: 'cr-cap', face: 'cr-shades', neck: 'cr-scarf', aura: 'cr-aura' });
  });

  it('wearing a collection Look does not use a personal Look slot', async () => {
    const { store } = await withPet();
    store.getState().debugUnlockCollection('dreamwave');
    store.getState().wearCollectionLook('dreamwave');
    expect(store.getState().save!.cosmetics.looks).toEqual([null, null, null]);
    expect(store.getState().save!.inventory.equipped).toMatchObject({ head: 'dw-headband', face: 'dw-shades', charm: 'dw-charm', aura: 'dw-aura' });
  });

  it('fit QA helpers change stage and species, and stage unlocks still apply', async () => {
    const { store } = await withPet();
    store.getState().debugSetStage('adult');
    store.getState().debugSetSpecies('sproutling');
    const save = store.getState().save!;
    expect(save.pet).toMatchObject({ speciesId: 'sproutling', lifetimeXp: 1500 });
    expect(save.inventory.items['dw-beret']?.quantity).toBe(1); // "grown up" piece
  });
});
