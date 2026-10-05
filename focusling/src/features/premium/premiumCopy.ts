import type { EntitlementState } from '@/core';

/** One honest line for the current Premium state (Settings, Parent settings, Premium screen). */
export function describeEntitlement(e: EntitlementState, storeAvailable: boolean): string {
  if (e.source === 'devOverride') return e.tier === 'free' ? 'Free (developer override)' : 'Premium (developer override, this session only)';
  switch (e.status) {
    case 'active': {
      const until = e.expiresAt ? new Date(e.expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
      if (!until) return 'Premium is active';
      return e.willAutoRenew === false ? `Premium until ${until} (won’t renew)` : `Premium is active · renews ${until}`;
    }
    case 'pending':
      return 'Purchase waiting for approval';
    case 'expired':
      return 'Free · your Premium subscription has ended';
    case 'revoked':
      return 'Free · Premium was refunded or revoked';
    default:
      return storeAvailable ? 'Free' : 'Free · the App Store isn’t available here';
  }
}
