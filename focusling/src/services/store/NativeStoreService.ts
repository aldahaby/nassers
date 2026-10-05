import { requireOptionalNativeModule } from 'expo-modules-core';
import { PREMIUM_PRODUCT_IDS } from '@/config/premium';
import type { EntitlementState } from '@/core';
import type { PurchaseOutcome, StoreProduct, StoreService } from './StoreService';

/** What the Swift `FocuslingStore` module (modules/focusling-store) returns for an entitlement. */
interface NativeEntitlement {
  active: boolean;
  productId?: string;
  expiresAtMs?: number;
  revoked?: boolean;
  expired?: boolean;
  willAutoRenew?: boolean;
  /** Set when the App Store offer that started it was a promotional/offer-code offer. */
  offerType?: string;
}

export interface FocuslingStoreNativeModule {
  canMakePayments(): Promise<boolean>;
  getProducts(ids: string[]): Promise<StoreProduct[]>;
  /** Resolves with { status: 'success'|'pending'|'cancelled'|'failed', entitlement?, message? }. */
  purchase(productId: string): Promise<{ status: string; entitlement?: NativeEntitlement; message?: string }>;
  currentEntitlement(productIds: string[]): Promise<NativeEntitlement>;
  sync(productIds: string[]): Promise<NativeEntitlement>;
  showManageSubscriptions(): Promise<boolean>;
  addListener(event: 'onEntitlementChange', listener: (payload: NativeEntitlement) => void): { remove(): void };
}

/** Null on web, Expo Go and builds without the module. */
export const FocuslingStoreNative = requireOptionalNativeModule<FocuslingStoreNativeModule>('FocuslingStore');

/** Map the native verified-transaction summary to app entitlement state. */
export function toEntitlement(n: NativeEntitlement): EntitlementState {
  if (n.active) return { tier: 'premium', source: 'storekit', status: 'active', productId: n.productId, expiresAt: n.expiresAtMs, willAutoRenew: n.willAutoRenew };
  return { tier: 'free', source: 'storekit', status: n.revoked ? 'revoked' : n.expired ? 'expired' : 'inactive', productId: n.productId };
}

/**
 * StoreKit 2 (iOS 15+): products(for:), purchase(options:), verified
 * Transaction.currentEntitlements, Transaction.updates, AppStore.sync() and
 * AppStore.showManageSubscriptions(in:). UNTESTED until run on a device with
 * App Store Connect products or a StoreKit configuration file.
 */
export class NativeStoreService implements StoreService {
  readonly kind = 'storekit' as const;
  constructor(private native: FocuslingStoreNativeModule) {}

  async isAvailable() {
    try {
      return await this.native.canMakePayments();
    } catch {
      return false;
    }
  }

  async getProducts(ids: readonly string[]) {
    try {
      return await this.native.getProducts([...ids]);
    } catch {
      return [];
    }
  }

  async purchase(productId: string): Promise<PurchaseOutcome> {
    try {
      const r = await this.native.purchase(productId);
      if (r.status === 'success' && r.entitlement) return { status: 'success', entitlement: toEntitlement(r.entitlement) };
      if (r.status === 'pending') return { status: 'pending' };
      if (r.status === 'cancelled') return { status: 'cancelled' };
      return { status: 'failed', message: r.message ?? 'The purchase didn’t go through.' };
    } catch (e) {
      return { status: 'failed', message: e instanceof Error ? e.message : 'The purchase didn’t go through.' };
    }
  }

  async currentEntitlement() {
    try {
      return toEntitlement(await this.native.currentEntitlement([...PREMIUM_PRODUCT_IDS]));
    } catch {
      return { tier: 'free', source: 'storekit', status: 'unknown' } as EntitlementState;
    }
  }

  async restore() {
    return toEntitlement(await this.native.sync([...PREMIUM_PRODUCT_IDS]));
  }

  async showManageSubscriptions() {
    try {
      return await this.native.showManageSubscriptions();
    } catch {
      return false;
    }
  }

  onEntitlementChange(listener: (e: EntitlementState) => void) {
    const sub = this.native.addListener('onEntitlementChange', (n) => listener(toEntitlement(n)));
    return () => sub.remove();
  }
}
