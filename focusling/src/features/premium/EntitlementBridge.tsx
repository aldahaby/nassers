import { useEffect } from 'react';
import { useEntitlementStore, useGameStore } from '@/state';

/**
 * Starts the store connection once (StoreKit, or the test store in test
 * builds). Nothing here writes the save.
 */
export function EntitlementBridge() {
  const debug = useGameStore((s) => s.save?.profile.settings.debugToolsEnabled ?? false);
  useEffect(() => {
    void useEntitlementStore.getState().init();
  }, []);
  useEffect(() => {
    // Turning Developer tools off clears any QA override.
    if (!debug) useEntitlementStore.setState({ devOverride: null, studentOffer: 'none' });
  }, [debug]);
  return null;
}
