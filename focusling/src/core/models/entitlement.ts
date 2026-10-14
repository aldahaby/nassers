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
  /** Trial or paid period, when the authority reports one (a trial is never granted by the client). */
  period?: EntitlementPeriod;
  /** Which trial this is (student 30 days or standard 14 days; config/trials.ts). */
  trialKind?: TrialKind;
}

export type EntitlementPeriod = 'trial' | 'paid';
export type TrialKind = 'student' | 'standard';

/**
 * The one derived answer to "where does this person stand?", from the
 * authoritative entitlement and the current time (accessStateFor). Only
 * trialActive and paidActive unlock Premium capabilities. "unavailable" means
 * the authority can't be reached or isn't present: Free capabilities, nothing
 * deleted, and a student's own records stay fully available.
 */
export type AccessState = 'free' | 'trialActive' | 'paidActive' | 'trialExpired' | 'paidExpired' | 'pending' | 'unavailable';

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
  /** Show purchase controls (never without a store, never while Premium is active). */
  canPurchase: boolean;
  /** Premium content can always be previewed on the pet. */
  canPreviewPremium: boolean;
  /**
   * Longer-range Stats views (e.g. 12-week trend). Never gates a student's own
   * records: today/week, the weekly chart, history, courses and Journey are Free.
   */
  canUseExtendedStats: boolean;
}

/** Content access tier for catalog items, collections and room themes. */
export type ContentAccess = 'free' | 'premium';

/**
 * Student promotion eligibility from a future third-party verifier. Separate
 * from App Store entitlement; never stored in the save. See
 * docs/FUTURE_FRIENDS_AND_PROMO.md.
 */
export type StudentOfferState = 'none' | 'eligible-mock';
