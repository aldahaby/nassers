import { create } from 'zustand';
import { PREMIUM_PRODUCT_IDS } from '@/config/premium';
import { FREE_ENTITLEMENT, type AccessTier, type EntitlementState, type StudentOfferState } from '@/core';
import type { PurchaseOutcome, StoreProduct, StoreService } from '@/services/store/StoreService';

export interface EntitlementStore {
  /** What the store reports (StoreKit or the mock). Never persisted. */
  storeEntitlement: EntitlementState;
  products: StoreProduct[];
  storeKind: StoreService['kind'];
  storeAvailable: boolean;
  /** Developer tools only (QA): forces a tier. Memory only; gone on reload. */
  devOverride: AccessTier | null;
  /** Developer tools only: demonstrates how an eligible student offer would look. */
  studentOffer: StudentOfferState;
  busy: boolean;
  message: string | null;
  init(): Promise<void>;
  refreshProducts(): Promise<void>;
  purchase(productId: string): Promise<PurchaseOutcome>;
  restore(): Promise<void>;
  manageSubscription(): Promise<void>;
  setDevOverride(tier: AccessTier | null, devToolsEnabled: boolean): void;
  setStudentOffer(state: StudentOfferState, devToolsEnabled: boolean): void;
  clearMessage(): void;
}

/** The entitlement the app acts on: a dev override (QA) wins, otherwise the store. */
export function effectiveEntitlement(s: Pick<EntitlementStore, 'storeEntitlement' | 'devOverride'>): EntitlementState {
  if (s.devOverride) return s.devOverride === 'free' ? { tier: 'free', source: 'devOverride', status: 'inactive' } : { tier: s.devOverride, source: 'devOverride', status: 'active' };
  return s.storeEntitlement;
}

/**
 * Runtime product access. Lives beside the game store, never inside the save:
 * a save file can't grant Premium. The store service is the authority.
 */
export function createEntitlementStore(store: StoreService) {
  return create<EntitlementStore>()((set, get) => ({
    storeEntitlement: FREE_ENTITLEMENT,
    products: [],
    storeKind: store.kind,
    storeAvailable: false,
    devOverride: null,
    studentOffer: 'none',
    busy: false,
    message: null,

    async init() {
      const available = await store.isAvailable();
      set({ storeAvailable: available, storeEntitlement: await store.currentEntitlement() });
      store.onEntitlementChange((e) => set({ storeEntitlement: e }));
      if (available) await get().refreshProducts();
    },

    async refreshProducts() {
      set({ products: await store.getProducts(PREMIUM_PRODUCT_IDS) });
    },

    async purchase(productId) {
      set({ busy: true, message: null });
      const outcome = await store.purchase(productId);
      if (outcome.status === 'success') set({ storeEntitlement: outcome.entitlement, message: 'Welcome to Premium. Enjoy the extra wardrobe.' });
      else if (outcome.status === 'pending') set({ message: 'Your purchase is waiting for approval. Premium unlocks as soon as it’s approved.' });
      else if (outcome.status === 'cancelled') set({ message: null });
      else set({ message: outcome.message });
      set({ busy: false });
      return outcome;
    },

    async restore() {
      set({ busy: true, message: null });
      try {
        const e = await store.restore();
        set({ storeEntitlement: e, message: e.status === 'active' ? 'Premium restored.' : 'No active Premium subscription was found for this Apple Account.' });
      } catch {
        set({ message: 'Couldn’t reach the App Store. Try again in a moment.' });
      }
      set({ busy: false });
    },

    async manageSubscription() {
      const shown = await store.showManageSubscriptions();
      if (!shown) set({ message: 'Manage your subscription in Settings › Apple Account › Subscriptions.' });
    },

    setDevOverride(tier, devToolsEnabled) {
      if (!devToolsEnabled) return; // store-refused unless Developer tools are on
      set({ devOverride: tier });
    },

    setStudentOffer(state, devToolsEnabled) {
      if (!devToolsEnabled) return;
      set({ studentOffer: state });
    },

    clearMessage() {
      set({ message: null });
    },
  }));
}
