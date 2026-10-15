import type { EntitlementState } from '@/core';
import type { PurchaseOutcome, StoreService } from './StoreService';

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
    return { status: 'unavailable', message: 'Purchases aren’t available in this version yet.' };
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
