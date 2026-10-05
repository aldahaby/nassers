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
 * - MockStoreService: web/dev demo provider (purchases only with Developer tools);
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
