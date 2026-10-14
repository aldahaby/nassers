import type { EntitlementState } from '@/core';

/** One honest line for the current Premium state (Settings, Premium screen). */
export function describeEntitlement(e: EntitlementState, storeAvailable: boolean): string {
  if (e.source === 'devOverride') return e.tier === 'free' ? 'Free (developer override)' : 'Premium (developer override, this session only)';
  switch (e.status) {
    case 'active': {
      const until = e.expiresAt ? new Date(e.expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
      if (e.period === 'trial') return until ? `Premium trial · ends ${until}` : 'Premium trial is active';
      if (!until) return 'Premium is active';
      return e.willAutoRenew === false ? `Premium until ${until} (won’t renew)` : `Premium is active · renews ${until}`;
    }
    case 'pending':
      return 'Purchase waiting for approval';
    case 'expired':
      return e.period === 'trial' ? 'Free · your Premium trial has ended' : 'Free · your Premium subscription has ended';
    case 'revoked':
      return 'Free · Premium was refunded or revoked';
    default:
      return storeAvailable ? 'Free' : 'Free · the App Store isn’t available here';
  }
}
