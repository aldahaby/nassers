import { AD_PLACEMENTS, FORBIDDEN_AD_SURFACES } from '@/config/ads';
import type { AccessState, AdContext, AdEligibility, AdPlacement } from '../models';

/** Free-equivalent states. Trial, paid, pending or unknown ("unavailable") never see ads. */
const AD_ACCESS: readonly AccessState[] = ['free', 'trialExpired', 'paidExpired'];

/**
 * Could an ad be shown here? Pure and conservative: every condition must hold.
 * There is no ad SDK; this only defines the rules a future one must obey.
 */
export function adEligibility(ctx: AdContext, placements: Record<string, AdPlacement> = AD_PLACEMENTS): AdEligibility {
  const no = (reason: Extract<AdEligibility, { eligible: false }>['reason']): AdEligibility => ({ eligible: false, reason });
  if (FORBIDDEN_AD_SURFACES.includes(ctx.surface)) return no('forbiddenSurface');
  if (!AD_ACCESS.includes(ctx.access)) return no('notFree');
  const placement = placements[ctx.placementId];
  if (!placement) return no('unknownPlacement');
  if (placement.surface !== ctx.surface || FORBIDDEN_AD_SURFACES.includes(placement.surface)) return no('surfaceMismatch');
  if (!placement.approved) return no('placementNotApproved');
  if (ctx.focusSessionActive) return no('focusSessionActive');
  if (ctx.sensitiveAcademicContentVisible) return no('sensitiveContent');
  if (!ctx.adConsent) return no('noConsent');
  if (!ctx.ageRequirementMet) return no('ageRequirement');
  // No behavioural profiling of minors (or of anyone whose age isn't known).
  if (ctx.personalized && ctx.ageStatus !== 'adult') return no('personalizationNotAllowed');
  return { eligible: true };
}
