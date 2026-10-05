import { useEffect } from 'react';
import { services } from '@/services';
import { MockStoreService } from '@/services/store';
import { useEntitlementStore, useGameStore } from '@/state';

/**
 * Starts the store connection once (StoreKit or the mock), and lets the web/dev
 * mock "sell" only while Developer tools are on. Nothing here writes the save.
 */
export function EntitlementBridge() {
  const debug = useGameStore((s) => s.save?.profile.settings.debugToolsEnabled ?? false);
  useEffect(() => {
    void useEntitlementStore.getState().init();
  }, []);
  useEffect(() => {
    if (services.store instanceof MockStoreService) services.store.allowPurchases = debug;
    // Turning Developer tools off clears any QA override.
    if (!debug) useEntitlementStore.setState({ devOverride: null, studentOffer: 'none' });
  }, [debug]);
  return null;
}
