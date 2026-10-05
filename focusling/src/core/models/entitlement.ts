/**
 * Product access (docs/PREMIUM.md). Entitlement is NOT part of the game save:
 * paid access comes from the App Store (StoreKit) at runtime. A save can never
 * grant Premium by itself.
 */

/** What the person has access to. */
export type AccessTier = 'free' | 'premium' | 'premiumStudentPromo';

/** Where the current tier came from. */
export type EntitlementSource = 'none' | 'storekit' | 'mock' | 'devOverride';

/**
 * - unknown: not checked yet (treated as Free);
 * - unavailable: no store on this device/build (Free; purchases disabled);
 * - pending: e.g. Ask to Buy waiting for approval (Free until approved);
 * - active / expired / revoked: as reported by the store.
 */
export type EntitlementStatus = 'unknown' | 'unavailable' | 'inactive' | 'pending' | 'active' | 'expired' | 'revoked';

export interface EntitlementState {
  tier: AccessTier;
  source: EntitlementSource;
  status: EntitlementStatus;
  productId?: string;
  /** ms since epoch, when the store reports one. */
  expiresAt?: number;
  willAutoRenew?: boolean;
}

/** Capability questions the UI asks. Add new ones here, never `if (isPremium)` in screens. */
export interface Capabilities {
  /** Wear and save Premium collection pieces. */
  canUsePremiumCollections: boolean;
  /** Wear curated Premium Looks. */
  canUsePremiumLooks: boolean;
  /** Apply Premium room themes (basic room colour is always free). */
  canUsePremiumRoomThemes: boolean;
  /** Premium ambient effects (e.g. Premium auras). */
  canUsePremiumEffects: boolean;
  /** Umbrella for future advanced customisation. */
  canUseAdvancedCustomization: boolean;
  /** Show purchase controls (never in Child View; never without a store). */
  canPurchase: boolean;
  /** Premium content can always be previewed on the pet. */
  canPreviewPremium: boolean;
}

/** Content access tier for catalog items, collections and room themes. */
export type ContentAccess = 'free' | 'premium';

/**
 * Student promotion eligibility from a future third-party verifier. Separate
 * from App Store entitlement; never stored in the save. See
 * docs/FUTURE_FRIENDS_AND_PROMO.md.
 */
export type StudentOfferState = 'none' | 'eligible-mock';
