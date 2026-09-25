import { getShopItem } from '@/config/shopCatalog';
import { MemorySaveRepository } from '@/services/persistence/MemorySaveRepository';
import { MockProtectionService } from '@/services/protection/MockProtectionService';
import { createGameStore } from '../createGameStore';

const flush = () => new Promise((r) => setTimeout(r, 0));
const T0 = new Date(2026, 0, 5, 9, 0).getTime();

async function setup() {
  let clock = T0;
  const repo = new MemorySaveRepository();
  const screenTime = new MockProtectionService();
  const make = () => createGameStore({ saveRepository: repo, protection: screenTime, now: () => clock });
  const store = make();
  await store.getState().hydrate();
  store.getState().adoptPet('cloudling', 'Nimbus');
  store.getState().debugGrant({ coins: 500 });
  const reopen = async () => {
    await flush();
    const next = make();
    await next.getState().hydrate();
    return next;
  };
  return { store, repo, reopen, advance: (ms: number) => (clock += ms) };
}

describe('shop through the store', () => {
  it('deducts coins exactly once per purchase and persists items and equipment across a reload', async () => {
    const { store, reopen } = await setup();
    const coins = store.getState().save!.wallet.coins;
    const result = store.getState().purchase('acc-cap');
    expect(result).toEqual({ ok: true, value: { firstPurchase: true, happinessGained: expect.any(Number) } });
    expect(store.getState().save!.wallet.coins).toBe(coins - getShopItem('acc-cap')!.price);
    expect(store.getState().purchase('acc-cap')).toEqual({ ok: false, error: 'already-owned' });
    expect(store.getState().save!.wallet.coins).toBe(coins - getShopItem('acc-cap')!.price);

    store.getState().equip('acc-cap');
    store.getState().purchase('decor-cozy-rug');
    store.getState().equip('decor-cozy-rug');

    const reopened = await reopen();
    const save = reopened.getState().save!;
    expect(save.wallet.coins).toBe(coins - getShopItem('acc-cap')!.price - getShopItem('decor-cozy-rug')!.price);
    expect(save.inventory.equipped).toEqual({ head: 'acc-cap', floorCenter: 'decor-cozy-rug' });
    expect(save.stats.itemsPurchased).toBe(2);
    // The next purchase after reload is not a "first".
    expect(reopened.getState().purchase('food-cookie')).toMatchObject({ ok: true, value: { firstPurchase: false } });
  });

  it('queues a pet reaction for toys, food and shown-off items', async () => {
    const { store } = await setup();
    store.getState().purchase('toy-plush-bear');
    const played = store.getState().play('toy-plush-bear');
    expect(played).toMatchObject({ ok: true, value: { kind: 'toy', itemId: 'toy-plush-bear', rewarded: true } });
    expect(store.getState().petReaction?.kind).toBe('toy');
    store.getState().consumePetReaction();
    expect(store.getState().petReaction).toBeNull();

    // Cooldown: still plays (reaction queued) but no reward.
    expect(store.getState().play('toy-plush-bear')).toMatchObject({ ok: true, value: { rewarded: false, happinessGained: 0 } });

    store.getState().purchase('food-honey-cake');
    expect(store.getState().feed('food-honey-cake')).toMatchObject({ ok: true, value: { kind: 'food' } });
    expect(store.getState().save!.inventory.items['food-honey-cake']).toBeUndefined();

    store.getState().purchase('acc-sunglasses');
    store.getState().equip('acc-sunglasses');
    expect(store.getState().petReaction?.kind).toBe('food'); // plain equip does not queue
    store.getState().unequipItem('acc-sunglasses');
    store.getState().equip('acc-sunglasses', { showOnPet: true });
    expect(store.getState().petReaction).toMatchObject({ kind: 'equip', itemId: 'acc-sunglasses' });
  });

  it('runs inventory debug actions and persists them', async () => {
    const { store, reopen } = await setup();
    store.getState().debugUnlockAll();
    store.getState().debugDressUp();
    expect(Object.keys(store.getState().save!.inventory.equipped)).toHaveLength(7);
    store.getState().debugResetEquipped();
    expect(store.getState().save!.inventory.equipped).toEqual({});
    let reopened = await reopen();
    expect(reopened.getState().save!.inventory.equipped).toEqual({});
    reopened.getState().debugClearInventory();
    reopened = await reopen();
    expect(reopened.getState().save!.inventory).toEqual({ items: {}, equipped: {} });
  });
});

describe('developer mode', () => {
  it('is off by default outside development and the setting survives a reload', async () => {
    const { store, reopen } = await setup();
    expect(store.getState().save!.profile.settings.debugToolsEnabled).toBe(false);
    store.getState().updateSettings({ debugToolsEnabled: true });
    let reopened = await reopen();
    expect(reopened.getState().save!.profile.settings.debugToolsEnabled).toBe(true);
    reopened.getState().updateSettings({ debugToolsEnabled: false });
    reopened = await reopen();
    expect(reopened.getState().save!.profile.settings.debugToolsEnabled).toBe(false);
  });

  it('shows a level-up exactly once, and a reload neither repeats it nor loses the level', async () => {
    const { store, reopen } = await setup();
    store.getState().debugPrimeXp('levelUp');
    const levelBefore = store.getState().save!.pet!.lifetimeXp;
    await store.getState().startFocus(15);
    store.getState().debugSetRemaining(5_000);
    const ended = store.getState().endFocus('completed');
    expect(ended.ok).toBe(true);
    expect(store.getState().lastSummary?.celebration?.kind).toBe('levelUp');
    store.getState().dismissSummary();

    const reopened = await reopen();
    expect(reopened.getState().lastSummary).toBeNull();
    expect(reopened.getState().save!.pet!.lifetimeXp).toBeGreaterThan(levelBefore);
    expect(reopened.getState().save!.focus.active).toBeNull();
  });

  it('keeps the developer setting through "reset progress"', async () => {
    const { store, reopen } = await setup();
    store.getState().updateSettings({ debugToolsEnabled: true });
    await store.getState().resetProgress();
    expect(store.getState().save!.pet).toBeNull();
    expect(store.getState().save!.profile.settings.debugToolsEnabled).toBe(true);
    const reopened = await reopen();
    expect(reopened.getState().save!.pet).toBeNull();
  });
});
