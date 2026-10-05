import { capabilitiesFor, FREE_ENTITLEMENT, type Capabilities } from '@/core';
import { MemorySaveRepository } from '@/services/persistence/MemorySaveRepository';
import { MockProtectionService } from '@/services/protection/MockProtectionService';
import { MockStoreService, UnavailableStoreService, toEntitlement } from '@/services/store';
import { createGameStore } from '../createGameStore';
import { createEntitlementStore, effectiveEntitlement } from '../entitlementStore';

const ctx = { childView: false, storeAvailable: true };
const PREMIUM: Capabilities = capabilitiesFor({ tier: 'premium', source: 'mock', status: 'active' }, ctx);
const FREE: Capabilities = capabilitiesFor(FREE_ENTITLEMENT, ctx);

async function ready(store = new MockStoreService()) {
  const s = createEntitlementStore(store);
  await s.getState().init();
  return { s, store };
}

describe('entitlement store (mock StoreKit)', () => {
  it('starts Free with labelled demo products and never unlocks from a local flag', async () => {
    const { s } = await ready();
    expect(effectiveEntitlement(s.getState()).tier).toBe('free');
    expect(s.getState().products.length).toBeGreaterThan(0);
    for (const p of s.getState().products) expect(p.displayPrice).toMatch(/demo/i);
  });

  it('refuses demo purchases unless Developer tools allow them', async () => {
    const { s, store } = await ready();
    const id = s.getState().products[0]!.id;
    expect((await s.getState().purchase(id)).status).toBe('unavailable');
    expect(effectiveEntitlement(s.getState()).tier).toBe('free');
    store.allowPurchases = true;
    expect((await s.getState().purchase(id)).status).toBe('success');
    expect(effectiveEntitlement(s.getState())).toMatchObject({ tier: 'premium', status: 'active', source: 'mock' });
  });

  it('handles pending, cancelled and failed purchases without unlocking', async () => {
    const { s, store } = await ready();
    store.allowPurchases = true;
    const id = s.getState().products[0]!.id;
    for (const outcome of ['pending', 'cancelled', 'failed'] as const) {
      store.nextOutcome = outcome;
      expect((await s.getState().purchase(id)).status).toBe(outcome);
      expect(effectiveEntitlement(s.getState()).tier).toBe('free');
    }
    expect(s.getState().busy).toBe(false);
  });

  it('follows store events: expiry and refunds return to Free', async () => {
    const { s, store } = await ready();
    store.allowPurchases = true;
    await s.getState().purchase(s.getState().products[0]!.id);
    store.simulate('expired');
    expect(effectiveEntitlement(s.getState())).toMatchObject({ tier: 'free', status: 'expired' });
    store.simulate('revoked');
    expect(effectiveEntitlement(s.getState()).status).toBe('revoked');
  });

  it('restore re-reads the store and reports honestly', async () => {
    const { s, store } = await ready();
    await s.getState().restore();
    expect(s.getState().message).toMatch(/No active Premium/);
    store.allowPurchases = true;
    await s.getState().purchase(s.getState().products[0]!.id);
    await s.getState().restore();
    expect(s.getState().message).toBe('Premium restored.');
  });

  it('dev override is refused unless Developer tools are on', async () => {
    const { s } = await ready();
    s.getState().setDevOverride('premium', false);
    expect(s.getState().devOverride).toBeNull();
    s.getState().setDevOverride('premium', true);
    expect(effectiveEntitlement(s.getState())).toMatchObject({ tier: 'premium', source: 'devOverride' });
    s.getState().setDevOverride('free', true);
    expect(effectiveEntitlement(s.getState()).tier).toBe('free');
    s.getState().setStudentOffer('eligible-mock', false);
    expect(s.getState().studentOffer).toBe('none');
  });

  it('with no store: Free, no products, purchases fail gracefully', async () => {
    const { s } = await ready(new UnavailableStoreService() as unknown as MockStoreService);
    expect(s.getState().storeAvailable).toBe(false);
    expect(s.getState().products).toEqual([]);
    expect(capabilitiesFor(effectiveEntitlement(s.getState()), { childView: false, storeAvailable: false }).canPurchase).toBe(false);
    expect((await s.getState().purchase('x')).status).toBe('unavailable');
  });

  it('maps native StoreKit entitlements (verified, expired, revoked)', () => {
    expect(toEntitlement({ active: true, productId: 'm', expiresAtMs: 1, willAutoRenew: true, expired: false, revoked: false })).toMatchObject({ tier: 'premium', status: 'active', source: 'storekit' });
    expect(toEntitlement({ active: false, productId: 'm', expired: true, revoked: false }).status).toBe('expired');
    expect(toEntitlement({ active: false, productId: 'm', expired: false, revoked: true }).status).toBe('revoked');
  });
});

describe('game store with capabilities', () => {
  function setup(caps: () => Capabilities) {
    let clock = new Date(2026, 8, 28, 10, 0).getTime();
    const store = createGameStore({ saveRepository: new MemorySaveRepository(), protection: new MockProtectionService(), now: () => clock, capabilities: caps });
    return { store, advance: (ms: number) => (clock += ms) };
  }

  it('focus rewards are identical for Free and Premium', async () => {
    const results = [];
    for (const caps of [FREE, PREMIUM]) {
      const { store, advance } = setup(() => caps);
      await store.getState().hydrate();
      store.getState().adoptPet('cloudling', 'Nimbus');
      await store.getState().startFocus(25);
      advance(26 * 60_000);
      const r = store.getState().endFocus('completed');
      expect(r.ok).toBe(true);
      results.push(r.ok ? { coins: r.value.coins, xp: r.value.xp } : null);
    }
    expect(results[0]).toEqual(results[1]);
  });

  it('Premium pieces and themes follow the current capabilities', async () => {
    let caps = FREE;
    const { store } = setup(() => caps);
    await store.getState().hydrate();
    store.getState().adoptPet('cloudling', 'Nimbus');
    expect(store.getState().equip('ng-headband').ok).toBe(false);
    store.getState().setRoomTheme('dreamwave-night');
    expect(store.getState().save!.room.theme).toBeNull();
    caps = PREMIUM;
    expect(store.getState().equip('ng-headband').ok).toBe(true);
    store.getState().setRoomTheme('dreamwave-night');
    expect(store.getState().save!.room.theme).toBe('dreamwave-night');
    // Room colour is free either way.
    caps = FREE;
    store.getState().setRoomColor('#223344');
    expect(store.getState().save!.room.color).toBe('#223344');
    expect(store.getState().save!.inventory.items['ng-headband']).toBeUndefined();
  });
});
