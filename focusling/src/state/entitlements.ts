import { useMemo } from 'react';
import { appClock, services } from '@/services';
import { capabilitiesFor, type Capabilities } from '@/core';
import { createEntitlementStore, effectiveEntitlement } from './entitlementStore';
import { setCapabilitiesProvider } from './gameStore';

/** The app's entitlement store, backed by the composition root's store service. */
export const useEntitlementStore = createEntitlementStore(services.store);

// Store actions (equip, themes) read capabilities at call time from here.
setCapabilitiesProvider(() => {
  const e = useEntitlementStore.getState();
  return capabilitiesFor(effectiveEntitlement(e), { storeAvailable: e.storeAvailable, now: appClock.now() });
});

/** Capabilities for the current student. Screens ask this, never `isPremium`. */
export function useCapabilities(): Capabilities {
  const storeEntitlement = useEntitlementStore((s) => s.storeEntitlement);
  const devOverride = useEntitlementStore((s) => s.devOverride);
  const storeAvailable = useEntitlementStore((s) => s.storeAvailable);
  return useMemo(() => capabilitiesFor(effectiveEntitlement({ storeEntitlement, devOverride }), { storeAvailable, now: appClock.now() }), [storeEntitlement, devOverride, storeAvailable]);
}

export function useEntitlement() {
  const storeEntitlement = useEntitlementStore((s) => s.storeEntitlement);
  const devOverride = useEntitlementStore((s) => s.devOverride);
  return effectiveEntitlement({ storeEntitlement, devOverride });
}
