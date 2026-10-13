import { TRIAL_CONFIG } from '@/config/trials';
import type { ServerEligibility, TrialKind, VerificationEvent, VerificationState } from '../models';

export const INITIAL_VERIFICATION: VerificationState = { step: 'idle' };

/**
 * The verification flow as a pure reducer. Every transition that changes
 * eligibility, expiry, attempts or trial status comes from a server event;
 * user events only move to a "waiting for the server" step. Unexpected events
 * leave the state unchanged.
 */
export function verificationReducer(state: VerificationState, event: VerificationEvent): VerificationState {
  if (event.type === 'reset') return INITIAL_VERIFICATION;
  if (event.type === 'serviceUnavailable') return { step: 'blocked', reason: 'unavailable' };
  switch (state.step) {
    case 'idle':
    case 'blocked':
      if (event.type === 'submitEmail' && !(state.step === 'blocked' && state.reason === 'alreadyRedeemed')) return { step: 'requestingCode', domain: event.domain };
      if (event.type === 'invalidEmail') return { step: 'blocked', reason: 'invalidEmail' };
      return state;
    case 'requestingCode':
      if (event.type === 'serverCodeSent') return { step: 'codeSent', domain: state.domain, challengeId: event.challengeId, expiresAt: event.expiresAt, resendAvailableAt: event.resendAvailableAt, attemptsLeft: event.attemptsLeft };
      if (event.type === 'serverRateLimited') return { step: 'blocked', reason: 'rateLimited', retryAt: event.retryAt };
      return state;
    case 'codeSent':
      if (event.type === 'submitCode') return { ...state, step: 'verifying' };
      if (event.type === 'submitEmail') return { step: 'requestingCode', domain: event.domain }; // resend (server enforces the cooldown)
      return state;
    case 'verifying':
      if (event.type === 'serverCodeRejected') return { ...state, step: 'codeSent', attemptsLeft: event.attemptsLeft };
      if (event.type === 'serverCodeExpired') return { step: 'blocked', reason: 'codeExpired' };
      if (event.type === 'serverAttemptsExhausted') return { step: 'blocked', reason: 'tooManyAttempts' };
      if (event.type === 'serverVerified') return { step: 'verified', domain: state.domain, eligibility: event.eligibility, offerToken: event.offerToken };
      return state;
    case 'verified':
      if (event.type === 'activateTrial') return { ...state, step: 'activating' };
      if (event.type === 'serverReviewQueued' && state.eligibility === 'needsReview') return { step: 'reviewRequested', domain: state.domain };
      return state;
    case 'activating':
      if (event.type === 'serverTrialActivated') return { step: 'trialActive', trialKind: event.trialKind, entitlement: event.entitlement };
      if (event.type === 'serverAlreadyRedeemed') return { step: 'blocked', reason: 'alreadyRedeemed' };
      return state;
    case 'trialActive':
    case 'reviewRequested':
      return state;
  }
}

/** Which trial the offer screen should describe for a server eligibility answer (copy only). */
export function trialOfferFor(eligibility: ServerEligibility | null): { kind: TrialKind; days: number } {
  return eligibility === 'student' ? { kind: 'student', days: TRIAL_CONFIG.studentTrialDays } : { kind: 'standard', days: TRIAL_CONFIG.standardTrialDays };
}
