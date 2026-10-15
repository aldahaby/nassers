import type { EntitlementState } from '@/core';

/** A subscription product as the store reports it (localized by the store, never hardcoded). */
export interface StoreProduct {
  id: string;
  title: string;
  /** Localized price string from the store, e.g. "$4.99". */
  displayPrice: string;
  period: 'week' | 'month' | 'year' | 'unknown';
  /** True when the store says this person can get an introductory offer. */
  introOfferEligible?: boolean;
  /** Localized description of an intro offer, if any (e.g. "1 week free"). */
  introOfferText?: string;
}

export type PurchaseOutcome =
  | { status: 'success'; entitlement: EntitlementState }
  | { status: 'pending' }
  | { status: 'cancelled' }
  | { status: 'unavailable'; message: string }
  | { status: 'failed'; message: string };

/**
 * The purchase boundary (docs/PREMIUM.md). The app never decides Premium on its
 * own: it asks the store. Implementations:
 * - NativeStoreService: StoreKit 2 via the `FocuslingStore` Expo module (iOS);
 * - MockStoreService: the TEST store (simulated purchases), only in test builds;
 * - UnavailableStoreService: no store (everything stays Free, previews still work).
 */
export interface StoreService {
  readonly kind: 'storekit' | 'mock' | 'unavailable';
  /** Can products be bought here right now? */
  isAvailable(): Promise<boolean>;
  getProducts(ids: readonly string[]): Promise<StoreProduct[]>;
  purchase(productId: string): Promise<PurchaseOutcome>;
  /** The current entitlement from the store's verified transactions. */
  currentEntitlement(): Promise<EntitlementState>;
  /** Restore = ask the store to resync, then re-read the entitlement. */
  restore(): Promise<EntitlementState>;
  /** Apple's manage-subscriptions sheet (or a fallback). Resolves false if it can't be shown. */
  showManageSubscriptions(): Promise<boolean>;
  /** Transactions changed outside the app (renewal, refund, Ask to Buy approval, other device). */
  onEntitlementChange(listener: (e: EntitlementState) => void): () => void;
}

/** How the next simulated purchase ends (test store only). */
export type TestOutcome = 'success' | 'failed' | 'cancelled' | 'pending';

/** Controls only the test store has. Test builds only; production bundles don't contain that store. */
export interface TestStoreControls {
  setNextOutcome(outcome: TestOutcome): void;
  simulate(status: 'expired' | 'revoked' | 'inactive'): Promise<void>;
  prepareRestore(productId: string): Promise<void>;
  reset(): Promise<void>;
}

/** The test store's controls, or null for any real/unavailable store. */
export function testStoreControls(store: StoreService): (StoreService & TestStoreControls) | null {
  return store.kind === 'mock' ? (store as StoreService & TestStoreControls) : null;
}
