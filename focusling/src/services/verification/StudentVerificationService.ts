import type { EntitlementState, ServerEligibility, TrialKind } from '@/core';

/**
 * Student email verification, server side (docs/PREMIUM_ARCHITECTURE.md).
 * Interface only: no backend exists, so the app uses the Unavailable
 * implementation. A real implementation must keep every security rule on the
 * server: cryptographically random six-digit codes, expiry, rate limits,
 * attempt limits and resend cooldowns, no raw codes in persistent logs,
 * eligibility decided against the approved directory, one-time trial
 * redemption, minimal retention, no student ID photos, and no sharing of
 * emails or academic data with advertisers. Never fake a sent email.
 */
export type RequestCodeResult =
  | { status: 'sent'; challengeId: string; expiresAt: number; resendAvailableAt: number; attemptsLeft: number }
  | { status: 'rateLimited'; retryAt: number }
  | { status: 'invalidEmail' }
  | { status: 'unavailable' };

export type VerifyCodeResult =
  | { status: 'verified'; eligibility: ServerEligibility; offerToken: string }
  | { status: 'rejected'; attemptsLeft: number }
  | { status: 'expired' }
  | { status: 'tooManyAttempts' }
  | { status: 'unavailable' };

export type ActivateTrialResult = { status: 'activated'; trialKind: TrialKind; entitlement: EntitlementState } | { status: 'alreadyRedeemed' } | { status: 'unavailable' };

export type ReviewRequestResult = { status: 'queued' } | { status: 'unavailable' };

export interface StudentVerificationService {
  readonly kind: 'unavailable' | 'server';
  requestCode(email: string): Promise<RequestCodeResult>;
  /** The code goes straight to the server; callers must not store or log it. */
  verifyCode(challengeId: string, code: string): Promise<VerifyCodeResult>;
  activateTrial(offerToken: string): Promise<ActivateTrialResult>;
  requestInstitutionReview(domain: string, institutionName: string): Promise<ReviewRequestResult>;
}

/** The only implementation today: says so honestly and never pretends to send an email. */
export class UnavailableStudentVerificationService implements StudentVerificationService {
  readonly kind = 'unavailable' as const;
  async requestCode(): Promise<RequestCodeResult> {
    return { status: 'unavailable' };
  }
  async verifyCode(): Promise<VerifyCodeResult> {
    return { status: 'unavailable' };
  }
  async activateTrial(): Promise<ActivateTrialResult> {
    return { status: 'unavailable' };
  }
  async requestInstitutionReview(): Promise<ReviewRequestResult> {
    return { status: 'unavailable' };
  }
}
