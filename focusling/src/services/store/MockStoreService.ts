import { MOCK_PRODUCTS } from '@/config/premium';
import type { EntitlementState } from '@/core';
import type { PurchaseOutcome, StoreProduct, StoreService } from './StoreService';

const FREE: EntitlementState = { tier: 'free', source: 'mock', status: 'inactive' };

/**
 * Web/dev demo provider. Products are clearly labelled demo items. A "purchase"
 * only succeeds when Developer tools are on (`allowPurchases`), and lives only
 * in memory: reload and it's gone. It is never used on an iOS build that has
 * the StoreKit module.
 */
export class MockStoreService implements StoreService {
  readonly kind = 'mock' as const;
  private entitlement: EntitlementState = FREE;
  private listeners = new Set<(e: EntitlementState) => void>();
  /** Set by the app from the Developer tools switch. */
  allowPurchases = false;
  /** Dev QA: make the next purchase come back as pending or cancelled. */
  nextOutcome: 'success' | 'pending' | 'cancelled' | 'failed' = 'success';

  async isAvailable() {
    return true;
  }

  async getProducts(ids: readonly string[]): Promise<StoreProduct[]> {
    return MOCK_PRODUCTS.filter((p) => ids.includes(p.id)).map((p) => ({ ...p }));
  }

  async purchase(productId: string): Promise<PurchaseOutcome> {
    if (!this.allowPurchases) return { status: 'unavailable', message: 'Purchases aren’t available in this preview.' };
    const outcome = this.nextOutcome;
    this.nextOutcome = 'success';
    if (outcome === 'pending') return { status: 'pending' };
    if (outcome === 'cancelled') return { status: 'cancelled' };
    if (outcome === 'failed') return { status: 'failed', message: 'The demo store reported an error.' };
    this.set({ tier: 'premium', source: 'mock', status: 'active', productId, willAutoRenew: true });
    return { status: 'success', entitlement: this.entitlement };
  }

  async currentEntitlement() {
    return this.entitlement;
  }

  async restore() {
    return this.entitlement;
  }

  async showManageSubscriptions() {
    return false;
  }

  onEntitlementChange(listener: (e: EntitlementState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Dev QA: simulate the store reporting expiry or a refund. */
  simulate(status: 'expired' | 'revoked' | 'inactive') {
    this.set({ tier: 'free', source: 'mock', status });
  }

  private set(e: EntitlementState) {
    this.entitlement = e;
    this.listeners.forEach((l) => l(e));
  }
}

/** No store at all: Free, purchases disabled, previews still work. */
export class UnavailableStoreService implements StoreService {
  readonly kind = 'unavailable' as const;
  async isAvailable() {
    return false;
  }
  async getProducts() {
    return [];
  }
  async purchase(): Promise<PurchaseOutcome> {
    return { status: 'unavailable', message: 'The App Store isn’t available right now.' };
  }
  async currentEntitlement(): Promise<EntitlementState> {
    return { tier: 'free', source: 'none', status: 'unavailable' };
  }
  async restore() {
    return this.currentEntitlement();
  }
  async showManageSubscriptions() {
    return false;
  }
  onEntitlementChange() {
    return () => {};
  }
}
