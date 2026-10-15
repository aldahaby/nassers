import { accessStateFor, adEligibility, capabilitiesFor, FREE_ENTITLEMENT, type AdContext, type AdPlacement, type Capabilities } from '@/core';
import { MemorySaveRepository } from '@/services/persistence/MemorySaveRepository';
import { MockProtectionService } from '@/services/protection/MockProtectionService';
import { UnavailableStoreService, toEntitlement } from '@/services/store';
import { MockStoreService } from '@/services/store/MockStoreService';
import { createGameStore } from '../createGameStore';
import { createEntitlementStore, effectiveEntitlement } from '../entitlementStore';

const ctx = { storeAvailable: true };
const PREMIUM: Capabilities = capabilitiesFor({ tier: 'premium', source: 'mock', status: 'active' }, ctx);
const FREE: Capabilities = capabilitiesFor(FREE_ENTITLEMENT, ctx);

async function ready(store = new MockStoreService()) {
  const s = createEntitlementStore(store);
  await s.getState().init();
  return { s, store };
}

class MemoryKV {
  data = new Map<string, string>();
  async getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  async setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  async removeItem(k: string) {
    this.data.delete(k);
  }
}

describe('entitlement store (test store: simulated Premium)', () => {
  it('starts Free with clearly labelled test products', async () => {
    const { s } = await ready();
    expect(effectiveEntitlement(s.getState()).tier).toBe('free');
    expect(s.getState().products.length).toBeGreaterThan(0);
    for (const p of s.getState().products) expect(p.displayPrice).toMatch(/test price \(no charge\)/i);
  });

  it('a simulated purchase activates Premium immediately and unlocks capabilities', async () => {
    const { s } = await ready();
    const id = s.getState().products[0]!.id;
    expect((await s.getState().purchase(id)).status).toBe('success');
    const e = effectiveEntitlement(s.getState());
    expect(e).toMatchObject({ tier: 'premium', status: 'active', source: 'mock' });
    const caps = capabilitiesFor(e, { storeAvailable: true });
    expect(caps).toMatchObject({ canUsePremiumCollections: true, canUsePremiumLooks: true, canUsePremiumRoomThemes: true, canUsePremiumEffects: true, canUseExtendedStats: true, canPurchase: false });
    expect(s.getState().message).toMatch(/No payment was taken/);
  });

  it('failed, cancelled and pending purchases never unlock Premium', async () => {
    const { s, store } = await ready();
    const id = s.getState().products[0]!.id;
    for (const outcome of ['pending', 'cancelled', 'failed'] as const) {
      store.setNextOutcome(outcome);
      expect((await s.getState().purchase(id)).status).toBe(outcome);
      expect(effectiveEntitlement(s.getState()).tier).toBe('free');
    }
    expect(s.getState().busy).toBe(false);
  });

  it('the test entitlement survives a refresh (a new app instance reading the same storage)', async () => {
    const kv = new MemoryKV();
    const first = await ready(new MockStoreService(kv));
    await first.s.getState().purchase(first.s.getState().products[0]!.id);
    const second = await ready(new MockStoreService(kv));
    expect(effectiveEntitlement(second.s.getState())).toMatchObject({ tier: 'premium', status: 'active', source: 'mock' });
  });

  it('expiry returns to Free; restore finds an active purchase; reset forgets everything', async () => {
    const kv = new MemoryKV();
    const { s, store } = await ready(new MockStoreService(kv));
    const id = s.getState().products[0]!.id;
    await s.getState().purchase(id);
    await store.simulate('expired');
    expect(effectiveEntitlement(s.getState())).toMatchObject({ tier: 'free', status: 'expired' });
    expect(capabilitiesFor(effectiveEntitlement(s.getState()), ctx).canUseExtendedStats).toBe(false);
    await store.prepareRestore(id);
    await s.getState().restore();
    expect(s.getState().message).toBe('Premium restored.');
    expect(effectiveEntitlement(s.getState()).status).toBe('active');
    await store.reset();
    expect(effectiveEntitlement(s.getState())).toMatchObject({ tier: 'free', status: 'inactive' });
    expect(kv.data.size).toBe(0);
    const again = await ready(new MockStoreService(kv));
    expect(effectiveEntitlement(again.s.getState()).tier).toBe('free');
    await again.s.getState().restore();
    expect(again.s.getState().message).toMatch(/No active test purchase/);
  });

  it('test Premium suppresses ads; Reset to Free makes the student ad-eligible again (rules only)', async () => {
    const kv = new MemoryKV();
    const { s, store } = await ready(new MockStoreService(kv));
    const placement: Record<string, AdPlacement> = { feed: { id: 'feed', surface: 'courseSpaceFeed', format: 'sponsorCard', approved: true, label: 'Sponsored' } };
    const ctx = (): AdContext => ({ access: accessStateFor(effectiveEntitlement(s.getState()), Date.now()), placementId: 'feed', surface: 'courseSpaceFeed', adConsent: true, ageRequirementMet: true, ageStatus: 'adult', personalized: false, focusSessionActive: false, sensitiveAcademicContentVisible: false });
    expect(adEligibility(ctx(), placement).eligible).toBe(true);
    await s.getState().purchase(s.getState().products[0]!.id);
    expect(adEligibility(ctx(), placement)).toEqual({ eligible: false, reason: 'notFree' });
    await store.reset();
    expect(adEligibility(ctx(), placement).eligible).toBe(true);
  });

  it('a forged non-test entitlement in test storage is ignored', async () => {
    const kv = new MemoryKV();
    await kv.setItem('studyling/test-store/v1', JSON.stringify({ entitlement: { tier: 'premium', source: 'storekit', status: 'active' } }));
    const { s } = await ready(new MockStoreService(kv));
    expect(effectiveEntitlement(s.getState()).tier).toBe('free');
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
    expect(capabilitiesFor(effectiveEntitlement(s.getState()), { storeAvailable: false }).canPurchase).toBe(false);
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
