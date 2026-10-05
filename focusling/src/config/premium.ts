/**
 * Focusling Premium configuration (docs/PREMIUM.md). The ONE place for store
 * identifiers and Premium copy.
 *
 * ⚠️ PLACEHOLDER PRODUCT IDS. These are proposed identifiers, not real App Store
 * Connect products. Before release: create the auto-renewable subscriptions in
 * App Store Connect (one subscription group), then replace these values. Prices
 * and periods always come from StoreKit at runtime; nothing here hardcodes a price.
 */
export const PREMIUM_PRODUCTS = {
  /** Proposed subscription group reference name (App Store Connect). */
  subscriptionGroup: 'Focusling Premium',
  monthly: 'com.focusling.app.premium.monthly',
  yearly: 'com.focusling.app.premium.yearly',
} as const;

export const PREMIUM_PRODUCT_IDS: readonly string[] = [PREMIUM_PRODUCTS.monthly, PREMIUM_PRODUCTS.yearly];

/** What Premium adds (shown on the Premium screen; all expression, no focus advantage). */
export const PREMIUM_INCLUDES: readonly { title: string; body: string }[] = [
  { title: 'Extra collections', body: 'Complete Premium collections, starting with Nightglow.' },
  { title: 'Premium Looks', body: 'Curated outfits built from Premium pieces.' },
  { title: 'Room themes', body: 'Whole-room treatments with their own walls, floors and atmosphere.' },
  { title: 'Ambient effects', body: 'Special auras like Aurora Veil.' },
];

/** What stays free for everyone. Shown on the Premium screen so nobody feels short-changed. */
export const ALWAYS_FREE: readonly string[] = [
  'Every focus session, reward, coin and bit of XP',
  'Growth all the way to Evolved, streaks and missions',
  'Five collections, the shop, Looks and reactions',
  'Any room colour you like',
  'Play, sounds and focus protection',
];

/** Mock store (web and developer builds only): clearly labelled demo products. */
export const MOCK_PRODUCTS = [
  { id: PREMIUM_PRODUCTS.monthly, title: 'Focusling Premium (monthly)', displayPrice: 'Demo price', period: 'month' as const },
  { id: PREMIUM_PRODUCTS.yearly, title: 'Focusling Premium (yearly)', displayPrice: 'Demo price', period: 'year' as const },
];
