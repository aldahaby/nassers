import { MOCK_PRODUCTS } from '@/config/premium';
import type { EntitlementState } from '@/core';
import type { PurchaseOutcome, StoreProduct, StoreService, TestOutcome, TestStoreControls } from './StoreService';

const FREE: EntitlementState = { tier: 'free', source: 'mock', status: 'inactive' };
export const TEST_STORE_KEY = 'studyling/test-store/v1';

/** Tiny persistence boundary (AsyncStorage/localStorage in the app, memory in tests). */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}


/**
 * TEST STORE (simulated Premium). Exists only in builds where test purchases
 * are enabled (config/buildFlags.ts); production builds never create it.
 * - No payment details are collected and no receipt is produced.
 * - Entitlements are marked `source: 'mock'`; the app ignores them in any
 *   build without test purchases, so one can never become a real entitlement.
 * - The state persists in this browser/device so a refresh keeps it.
 */
export class MockStoreService implements StoreService, TestStoreControls {
  readonly kind = 'mock' as const;
  private entitlement: EntitlementState = FREE;
  /** What "Restore purchases" will find (test control). */
  private restorable: EntitlementState | null = null;
  private listeners = new Set<(e: EntitlementState) => void>();
  private loaded: Promise<void> | null = null;
  /** Test control: how the next purchase ends. Resets to success after use. */
  nextOutcome: TestOutcome = 'success';

  constructor(private readonly storage: KeyValueStore | null = null) {}

  /** Test control: choose how the next purchase ends. */
  setNextOutcome(outcome: TestOutcome) {
    this.nextOutcome = outcome;
  }

  private load() {
    if (!this.loaded) {
      this.loaded = (async () => {
        if (!this.storage) return;
        try {
          const raw = await this.storage.getItem(TEST_STORE_KEY);
          if (!raw) return;
          const parsed = JSON.parse(raw) as { entitlement?: EntitlementState; restorable?: EntitlementState | null };
          if (parsed.entitlement?.source === 'mock') this.entitlement = parsed.entitlement;
          if (parsed.restorable?.source === 'mock') this.restorable = parsed.restorable;
        } catch {
          // Unreadable test state: start Free.
        }
      })();
    }
    return this.loaded;
  }

  async isAvailable() {
    return true;
  }

  async getProducts(ids: readonly string[]): Promise<StoreProduct[]> {
    return MOCK_PRODUCTS.filter((p) => ids.includes(p.id)).map((p) => ({ ...p }));
  }

  async purchase(productId: string): Promise<PurchaseOutcome> {
    await this.load();
    const outcome = this.nextOutcome;
    this.nextOutcome = 'success';
    if (outcome === 'pending') return { status: 'pending' };
    if (outcome === 'cancelled') return { status: 'cancelled' };
    if (outcome === 'failed') return { status: 'failed', message: 'Test purchase failed (simulated). Nothing was charged and Premium stays off.' };
    const active: EntitlementState = { tier: 'premium', source: 'mock', status: 'active', period: 'paid', productId, willAutoRenew: true };
    this.restorable = active;
    await this.set(active);
    return { status: 'success', entitlement: active };
  }

  async currentEntitlement() {
    await this.load();
    return this.entitlement;
  }

  async restore() {
    await this.load();
    if (this.restorable && this.restorable.status === 'active') await this.set(this.restorable);
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

  /** Test control: the store reports the subscription ended (or was refunded). */
  async simulate(status: 'expired' | 'revoked' | 'inactive') {
    await this.load();
    await this.set({ tier: 'free', source: 'mock', status, period: 'paid' });
  }

  /** Test control: make "Restore purchases" find an active subscription. */
  async prepareRestore(productId: string) {
    await this.load();
    this.restorable = { tier: 'premium', source: 'mock', status: 'active', period: 'paid', productId, willAutoRenew: true };
    await this.persist();
  }

  /** Test control: forget every simulated purchase and return to Free. */
  async reset() {
    await this.load();
    this.restorable = null;
    this.nextOutcome = 'success';
    this.entitlement = FREE;
    try {
      await this.storage?.removeItem(TEST_STORE_KEY);
    } catch {
      // ignore
    }
    this.listeners.forEach((l) => l(FREE));
  }

  private async persist() {
    try {
      await this.storage?.setItem(TEST_STORE_KEY, JSON.stringify({ entitlement: this.entitlement, restorable: this.restorable }));
    } catch {
      // Storage blocked (private browsing): works for this session only.
    }
  }

  private async set(e: EntitlementState) {
    this.entitlement = e;
    await this.persist();
    this.listeners.forEach((l) => l(e));
  }
}
