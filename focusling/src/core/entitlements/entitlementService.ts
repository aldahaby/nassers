import type { Capabilities, ContentAccess, EntitlementState, GameSave, ShopItem } from '../models';

export const FREE_ENTITLEMENT: EntitlementState = { tier: 'free', source: 'none', status: 'unknown' };

export interface AccessContext {
  /** Child View (Family Mode): never show purchase controls. */
  childView: boolean;
  /** A real or mock store is present and can sell. */
  storeAvailable: boolean;
}

export function isPremiumTier(e: EntitlementState): boolean {
  return (e.tier === 'premium' || e.tier === 'premiumStudentPromo') && (e.status === 'active' || e.source === 'devOverride');
}

/**
 * The single source of truth for "what can this person use?". Pure, so it is
 * tested directly. Focus mechanics never appear here: focusing, rewards, coins,
 * XP, growth, streaks, missions, Play, protection and the free catalog are the
 * same for everyone.
 */
export function capabilitiesFor(e: EntitlementState, ctx: AccessContext): Capabilities {
  const premium = isPremiumTier(e);
  return {
    canUsePremiumCollections: premium,
    canUsePremiumLooks: premium,
    canUsePremiumRoomThemes: premium,
    canUsePremiumEffects: premium,
    canUseAdvancedCustomization: premium,
    canPurchase: !ctx.childView && ctx.storeAvailable && !premium,
    canPreviewPremium: true,
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
