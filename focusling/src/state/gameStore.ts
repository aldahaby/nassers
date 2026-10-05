import type { Capabilities } from '@/core';
import { capabilitiesFor, FREE_ENTITLEMENT } from '@/core';
import { services } from '@/services';
import { createGameStore } from './createGameStore';

/** Late-bound so the entitlement store (which reads this store) can plug in without an import cycle. */
let capabilitiesProvider: () => Capabilities = () => capabilitiesFor(FREE_ENTITLEMENT, { childView: false, storeAvailable: false });
export function setCapabilitiesProvider(provider: () => Capabilities) {
  capabilitiesProvider = provider;
}

/** The app-wide store instance. */
export const useGameStore = createGameStore({
  saveRepository: services.saveRepository,
  protection: services.protection,
  debugDefault: typeof __DEV__ !== 'undefined' ? __DEV__ : false,
  capabilities: () => capabilitiesProvider(),
});
