import { useMemo } from 'react';
import { services } from '@/services';
import { capabilitiesFor, type Capabilities } from '@/core';
import { createEntitlementStore, effectiveEntitlement } from './entitlementStore';
import { setCapabilitiesProvider, useGameStore } from './gameStore';

/** The app's entitlement store, backed by the composition root's store service. */
export const useEntitlementStore = createEntitlementStore(services.store);

// Store actions (equip, themes) read capabilities at call time from here.
setCapabilitiesProvider(() => {
  const e = useEntitlementStore.getState();
  const g = useGameStore.getState();
  return capabilitiesFor(effectiveEntitlement(e), { childView: g.save?.mode === 'family' && g.familyView === 'child', storeAvailable: e.storeAvailable });
});

/** Capabilities for the current person and view. Screens ask this, never `isPremium`. */
export function useCapabilities(): Capabilities {
  const storeEntitlement = useEntitlementStore((s) => s.storeEntitlement);
  const devOverride = useEntitlementStore((s) => s.devOverride);
  const storeAvailable = useEntitlementStore((s) => s.storeAvailable);
  const childView = useGameStore((s) => s.save?.mode === 'family' && s.familyView === 'child');
  return useMemo(() => capabilitiesFor(effectiveEntitlement({ storeEntitlement, devOverride }), { childView, storeAvailable }), [storeEntitlement, devOverride, storeAvailable, childView]);
}

export function useEntitlement() {
  const storeEntitlement = useEntitlementStore((s) => s.storeEntitlement);
  const devOverride = useEntitlementStore((s) => s.devOverride);
  return effectiveEntitlement({ storeEntitlement, devOverride });
}
