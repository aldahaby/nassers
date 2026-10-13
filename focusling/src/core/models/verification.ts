import type { EntitlementState, TrialKind } from './entitlement';

/**
 * Student email verification (architecture only; no backend exists yet).
 * See docs/PREMIUM_ARCHITECTURE.md. A verified address proves control of the
 * email, not current enrollment. Nothing here is stored in the game save.
 */

export interface Institution {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  /** Approved email domains (exact or parent of a subdomain). */
  domains: readonly string[];
}

export type DomainClass =
  /** In the approved directory. */
  | { kind: 'recognized'; institutionId: string }
  /** Looks academic (suffix) but isn't in the directory: offer the review route. */
  | { kind: 'academicUnlisted' }
  | { kind: 'unrecognized' };

/** Server answers. The client never computes eligibility itself. */
export type ServerEligibility = 'student' | 'standard' | 'needsReview';

/**
 * Client view of the flow. Holds no OTP: the six-digit code is sent straight
 * to the server and never kept in state, storage or logs.
 */
export type VerificationState =
  | { step: 'idle' }
  | { step: 'requestingCode'; domain: string }
  | { step: 'codeSent'; challengeId: string; domain: string; expiresAt: number; resendAvailableAt: number; attemptsLeft: number }
  | { step: 'verifying'; challengeId: string; domain: string; expiresAt: number; resendAvailableAt: number; attemptsLeft: number }
  | { step: 'verified'; domain: string; eligibility: ServerEligibility; offerToken: string }
  | { step: 'activating'; domain: string; eligibility: ServerEligibility; offerToken: string }
  | { step: 'trialActive'; trialKind: TrialKind; entitlement: EntitlementState }
  | { step: 'reviewRequested'; domain: string }
  | { step: 'blocked'; reason: VerificationBlock; retryAt?: number };

export type VerificationBlock = 'rateLimited' | 'codeExpired' | 'tooManyAttempts' | 'alreadyRedeemed' | 'unavailable' | 'invalidEmail';

export type VerificationEvent =
  | { type: 'submitEmail'; domain: string }
  | { type: 'invalidEmail' }
  | { type: 'serverCodeSent'; challengeId: string; expiresAt: number; resendAvailableAt: number; attemptsLeft: number }
  | { type: 'serverRateLimited'; retryAt: number }
  | { type: 'submitCode' }
  | { type: 'serverCodeRejected'; attemptsLeft: number }
  | { type: 'serverCodeExpired' }
  | { type: 'serverAttemptsExhausted' }
  | { type: 'serverVerified'; eligibility: ServerEligibility; offerToken: string }
  | { type: 'activateTrial' }
  | { type: 'serverTrialActivated'; trialKind: TrialKind; entitlement: EntitlementState }
  | { type: 'serverAlreadyRedeemed' }
  | { type: 'serverReviewQueued' }
  | { type: 'serviceUnavailable' }
  | { type: 'reset' };
