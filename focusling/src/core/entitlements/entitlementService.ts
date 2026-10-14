import type { AccessState, Capabilities, ContentAccess, EntitlementState, GameSave, ShopItem, Timestamp } from '../models';

export const FREE_ENTITLEMENT: EntitlementState = { tier: 'free', source: 'none', status: 'unknown' };

export interface AccessContext {
  /** A real or mock store is present and can sell. */
  storeAvailable: boolean;
  /** When given, an `expiresAt` in the past ends access even before the store says so. */
  now?: Timestamp;
}

export function isPremiumTier(e: EntitlementState): boolean {
  return (e.tier === 'premium' || e.tier === 'premiumStudentPromo') && (e.status === 'active' || e.source === 'devOverride');
}

/**
 * Derive the access state. Deterministic: entitlement + time in, state out.
 * - devOverride (QA only; the store refuses it outside development builds) acts as paid.
 * - A reported expiry in the past ends access, whatever the status says.
 * - Free/unknown/inactive with no period is plain Free.
 */
export function accessStateFor(e: EntitlementState, now?: Timestamp): AccessState {
  if (e.source === 'devOverride') return e.tier === 'free' ? 'free' : 'paidActive';
  if (e.status === 'unavailable') return 'unavailable';
  if (e.status === 'pending') return 'pending';
  const expiredState: AccessState = e.period === 'trial' ? 'trialExpired' : 'paidExpired';
  if (e.status === 'expired' || e.status === 'revoked') return expiredState;
  if (e.status === 'active' && e.tier !== 'free') {
    if (e.expiresAt != null && now != null && e.expiresAt <= now) return expiredState;
    return e.period === 'trial' ? 'trialActive' : 'paidActive';
  }
  return 'free';
}

export const isPremiumAccess = (state: AccessState): boolean => state === 'trialActive' || state === 'paidActive';

/**
 * The single source of truth for "what can this person use?". Pure, so it is
 * tested directly. Focus mechanics never appear here: focusing, rewards, coins,
 * XP, growth, streaks, missions, Play, protection and the free catalog are the
 * same for everyone.
 */
export function capabilitiesFor(e: EntitlementState, ctx: AccessContext): Capabilities {
  const premium = isPremiumAccess(accessStateFor(e, ctx.now));
  return {
    canUsePremiumCollections: premium,
    canUsePremiumLooks: premium,
    canUsePremiumRoomThemes: premium,
    canUsePremiumEffects: premium,
    canUseAdvancedCustomization: premium,
    canPurchase: ctx.storeAvailable && !premium,
    canPreviewPremium: true,
    canUseExtendedStats: premium,
  };
}

export const itemAccess = (item: Pick<ShopItem, 'access'>): ContentAccess => item.access ?? 'free';

/**
 * Can this item be worn right now?
 * - Free items: when owned (bought, earned or starter), exactly as before.
 * - Premium items: while Premium is active. They are never added to inventory,
 *   so losing Premium simply hides them; resubscribing brings them back.
 * - Legacy rule: anything already owned in inventory stays usable forever,
 *   even if its catalog classification later changes.
 */
export function canWear(save: GameSave, item: ShopItem, caps: Capabilities): boolean {
  if ((save.inventory.items[item.id]?.quantity ?? 0) > 0) return true;
  if (itemAccess(item) === 'premium') return item.equipSlot === 'aura' ? caps.canUsePremiumEffects : caps.canUsePremiumCollections;
  return false;
}

/**
 * Studyling planner capabilities. The effectiveness core is free for every
 * tier and never depends on entitlement. Future Premium candidates
 * (continuous LMS sync, encrypted multi-device sync, advanced analytics) are
 * not built, so they are off for everyone, not "locked".
 */
export interface PlannerCapabilities {
  manualEntry: true;
  syllabusImport: true;
  planner: true;
  localReminders: true;
  reminderFading: true;
  startAndLock: true;
  basicRetrieval: true;
  basicWidget: true;
  continuousLmsSync: false;
  encryptedSync: false;
  advancedAnalytics: false;
}

export function plannerCapabilitiesFor(_entitlement: EntitlementState): PlannerCapabilities {
  return {
    manualEntry: true,
    syllabusImport: true,
    planner: true,
    localReminders: true,
    reminderFading: true,
    startAndLock: true,
    basicRetrieval: true,
    basicWidget: true,
    continuousLmsSync: false,
    encryptedSync: false,
    advancedAnalytics: false,
  };
}
