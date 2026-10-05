import type { GrowthStage, PetSpeciesId } from './pet';

/**
 * FUTURE ONLY — compile-time contracts, nothing persisted or built.
 * See docs/FUTURE_FRIENDS_AND_PROMO.md.
 *
 * These types are deliberately NOT part of `GameSave` (a test checks). Friend
 * codes and student eligibility belong to a future server-side account; a
 * device-local copy would be a fake identity and create migration debt.
 */

/** A random, server-generated code (never derived from email, school, phone, name or pet name). */
export interface FriendCodeModel {
  code: string;
  ownerUserId: string;
  createdAt: string;
  status: 'active' | 'rotated' | 'revoked';
}

/** Exactly what a friend may see. Opt-in fields only; no exact session times, no location. */
export interface FriendProfilePreview {
  userId: string;
  petName: string;
  species: PetSpeciesId;
  growthStage: GrowthStage;
  equippedCosmeticIds: string[];
  favoriteReactionId?: string;
  roomColor: string;
  /** Positive, explicitly shared weekly metrics only. */
  focusThisWeekMinutes?: number;
  completedSessionsThisWeek?: number;
}

/** Mutual acceptance only; either side can remove or block. */
export interface FriendRelationship {
  requesterId: string;
  recipientId: string;
  status: 'pending' | 'accepted' | 'blocked';
}

/**
 * Result of a third-party student verification. Focusling stores only the
 * outcome and a reference, never an ID image or document.
 */
export interface StudentPromoEligibility {
  status: 'unverified' | 'pending' | 'verified' | 'rejected' | 'expired';
  provider?: string;
  verificationReference?: string;
  verifiedAt?: string;
  expiresAt?: string;
}
