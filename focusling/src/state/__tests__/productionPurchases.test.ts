/* eslint-disable import/first, @typescript-eslint/no-require-imports -- jest.mock() has to run before the imports it replaces */
/**
 * A production build (test purchases OFF) must not be able to buy, fake or
 * keep Premium: no test store, no tier overrides, and a test entitlement left
 * in storage is ignored.
 */
jest.mock('@/config/buildFlags', () => ({ TEST_PURCHASES_ENABLED: false, testPurchasesEnabled: () => false }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { createStoreService } from '@/services';
import { UnavailableStoreService } from '@/services/store';
import { MockStoreService } from '@/services/store/MockStoreService';
import { createEntitlementStore, devOverrideAllowed, effectiveEntitlement } from '../entitlementStore';

describe('production build', () => {
  it('web gets no store at all (nothing to buy or simulate)', () => {
    // No native StoreKit module here, so this is the web/Expo Go path.
    expect(createStoreService()).toBeInstanceOf(UnavailableStoreService);
    expect(createStoreService(false)).not.toBeInstanceOf(MockStoreService);
    expect(createStoreService(true)).toBeInstanceOf(MockStoreService); // only a test build gets the test store
  });

  it('tier overrides are refused even with Developer tools on', async () => {
    const s = createEntitlementStore(new UnavailableStoreService());
    await s.getState().init();
    expect(devOverrideAllowed()).toBe(false);
    s.getState().setDevOverride('premium', true);
    expect(s.getState().devOverride).toBeNull();
    expect(effectiveEntitlement(s.getState()).tier).toBe('free');
  });

  it('a test-store entitlement is ignored outside a test build', () => {
    expect(effectiveEntitlement({ storeEntitlement: { tier: 'premium', source: 'mock', status: 'active' }, devOverride: null }).tier).toBe('free');
    expect(effectiveEntitlement({ storeEntitlement: { tier: 'premium', source: 'mock', status: 'active' }, devOverride: 'premium' }).tier).toBe('free');
  });

  it('real store entitlements still work', () => {
    expect(effectiveEntitlement({ storeEntitlement: { tier: 'premium', source: 'storekit', status: 'active' }, devOverride: null })).toMatchObject({ tier: 'premium', source: 'storekit' });
  });
});
