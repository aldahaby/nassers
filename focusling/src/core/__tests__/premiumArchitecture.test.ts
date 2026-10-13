import { ACADEMIC_SUFFIXES, SAMPLE_INSTITUTIONS } from '@/config/institutions';
import { TRIAL_CONFIG } from '@/config/trials';
import { adEligibility } from '../ads/adEligibility';
import { accessStateFor, capabilitiesFor, FREE_ENTITLEMENT, isPremiumAccess } from '../entitlements/entitlementService';
import { classifyDomain, normalizeEmail } from '../verification/emailDomain';
import { INITIAL_VERIFICATION, trialOfferFor, verificationReducer } from '../verification/verificationFlow';
import { UnavailableStudentVerificationService, type StudentVerificationService } from '@/services/verification/StudentVerificationService';
import type { AdContext, AdPlacement, EntitlementState, VerificationEvent, VerificationState } from '../models';

const NOW = Date.UTC(2026, 9, 13, 12);
const DAY = 86_400_000;
const ctx = { childView: false, storeAvailable: true, now: NOW };
const trial = (expiresAt: number, kind: 'student' | 'standard' = 'student'): EntitlementState => ({ tier: 'premium', source: 'storekit', status: 'active', period: 'trial', trialKind: kind, expiresAt });
const paid = (extra: Partial<EntitlementState> = {}): EntitlementState => ({ tier: 'premium', source: 'storekit', status: 'active', period: 'paid', expiresAt: NOW + 30 * DAY, ...extra });

describe('access states (entitlement + time → state)', () => {
  it('covers free, active trial, active paid, expired trial, expired/cancelled paid, pending and unavailable', () => {
    expect(accessStateFor(FREE_ENTITLEMENT, NOW)).toBe('free');
    expect(accessStateFor(trial(NOW + DAY), NOW)).toBe('trialActive');
    expect(accessStateFor(paid(), NOW)).toBe('paidActive');
    expect(accessStateFor({ ...trial(NOW - DAY), status: 'expired' }, NOW)).toBe('trialExpired');
    expect(accessStateFor(paid({ status: 'expired' }), NOW)).toBe('paidExpired');
    expect(accessStateFor(paid({ status: 'revoked' }), NOW)).toBe('paidExpired');
    expect(accessStateFor({ tier: 'premium', source: 'storekit', status: 'pending' }, NOW)).toBe('pending');
    expect(accessStateFor({ tier: 'free', source: 'none', status: 'unavailable' }, NOW)).toBe('unavailable');
  });

  it('a trial ends at its expiry even if the store has not reported it yet', () => {
    const t = trial(NOW + 10 * DAY);
    expect(accessStateFor(t, NOW + 10 * DAY - 1)).toBe('trialActive');
    expect(accessStateFor(t, NOW + 10 * DAY)).toBe('trialExpired');
    expect(capabilitiesFor(t, { ...ctx, now: NOW + 11 * DAY }).canUseExtendedStats).toBe(false);
  });

  it('a cancelled (won’t renew) subscription stays active until it expires, then ends', () => {
    const p = paid({ willAutoRenew: false, expiresAt: NOW + DAY });
    expect(accessStateFor(p, NOW)).toBe('paidActive');
    expect(accessStateFor(p, NOW + 2 * DAY)).toBe('paidExpired');
  });

  it('only active trial or paid unlock Premium capabilities', () => {
    const states = ['free', 'trialActive', 'paidActive', 'trialExpired', 'paidExpired', 'pending', 'unavailable'] as const;
    expect(states.filter(isPremiumAccess)).toEqual(['trialActive', 'paidActive']);
    expect(capabilitiesFor(trial(NOW + DAY), ctx).canUseExtendedStats).toBe(true);
    expect(capabilitiesFor({ tier: 'free', source: 'none', status: 'unavailable' }, ctx).canUseExtendedStats).toBe(false);
  });

  it('a client-side save field can never grant access: only the entitlement passed in counts', () => {
    const forged = { tier: 'premium', source: 'none', status: 'inactive' } as EntitlementState;
    expect(accessStateFor(forged, NOW)).toBe('free');
  });
});

describe('trial offers (copy only; the server decides)', () => {
  it('30 days for a verified student, 14 for everyone else', () => {
    expect(trialOfferFor('student')).toEqual({ kind: 'student', days: 30 });
    expect(trialOfferFor('standard')).toEqual({ kind: 'standard', days: 14 });
    expect(trialOfferFor('needsReview')).toEqual({ kind: 'standard', days: 14 });
    expect(trialOfferFor(null).days).toBe(TRIAL_CONFIG.standardTrialDays);
  });
});

describe('student email domains', () => {
  const classify = (email: string) => classifyDomain(normalizeEmail(email)!.domain, SAMPLE_INSTITUTIONS, ACADEMIC_SUFFIXES);

  it('normalises addresses and rejects implausible ones', () => {
    expect(normalizeEmail('  Ada@Mail.McGill.CA ')).toEqual({ email: 'ada@mail.mcgill.ca', domain: 'mail.mcgill.ca' });
    for (const bad of ['', 'ada', 'ada@', '@mcgill.ca', 'a@b@mcgill.ca', 'ada@mcgill', 'ada@-mcgill.ca', 'ada@mcgill..ca']) expect(normalizeEmail(bad)).toBeNull();
  });

  it('recognises approved institutions worldwide, including subdomains', () => {
    expect(classify('a@mcgill.ca')).toEqual({ kind: 'recognized', institutionId: 'mcgill' });
    expect(classify('a@mail.mcgill.ca')).toEqual({ kind: 'recognized', institutionId: 'mcgill' });
    expect(classify('a@ox.ac.uk').kind).toBe('recognized');
    expect(classify('a@student.unimelb.edu.au').kind).toBe('recognized');
    expect(classify('a@aucklanduni.ac.nz').kind).toBe('recognized');
    expect(classify('a@ju.edu.jo').kind).toBe('recognized');
  });

  it('an academic-looking suffix alone is not recognized; it only suggests the review route', () => {
    expect(classify('a@unknown-college.edu')).toEqual({ kind: 'academicUnlisted' });
    expect(classify('a@newuni.ac.uk')).toEqual({ kind: 'academicUnlisted' });
  });

  it('look-alike and ordinary domains are unrecognized', () => {
    expect(classify('a@notmcgill.ca').kind).toBe('unrecognized'); // suffix match without a dot boundary
    expect(classify('a@mcgill.ca.evil.com').kind).toBe('unrecognized');
    expect(classify('a@gmail.com').kind).toBe('unrecognized');
  });
});

describe('verification flow (server-driven reducer)', () => {
  const run = (events: VerificationEvent[], from: VerificationState = INITIAL_VERIFICATION) => events.reduce(verificationReducer, from);
  const sent: VerificationEvent = { type: 'serverCodeSent', challengeId: 'ch1', expiresAt: NOW + 600_000, resendAvailableAt: NOW + 60_000, attemptsLeft: 5 };

  it('happy path: email → code sent → verify → server eligibility → one trial activation', () => {
    const ent = trial(NOW + 30 * DAY);
    const s = run([{ type: 'submitEmail', domain: 'mcgill.ca' }, sent, { type: 'submitCode' }, { type: 'serverVerified', eligibility: 'student', offerToken: 'tok' }, { type: 'activateTrial' }, { type: 'serverTrialActivated', trialKind: 'student', entitlement: ent }]);
    expect(s).toEqual({ step: 'trialActive', trialKind: 'student', entitlement: ent });
  });

  it('the state never holds the code', () => {
    const s = run([{ type: 'submitEmail', domain: 'mcgill.ca' }, sent, { type: 'submitCode' }]);
    expect(JSON.stringify(s)).not.toMatch(/\b\d{6}\b/);
    expect(Object.keys(s)).not.toContain('code');
  });

  it('the client cannot skip the server: user events alone never reach verified or trialActive', () => {
    const s = run([{ type: 'submitEmail', domain: 'mcgill.ca' }, { type: 'submitCode' }, { type: 'activateTrial' }]);
    expect(s.step).toBe('requestingCode');
  });

  it('wrong code keeps attempts from the server; exhausted attempts, expiry and rate limits block', () => {
    const base = run([{ type: 'submitEmail', domain: 'mcgill.ca' }, sent, { type: 'submitCode' }]);
    expect(run([{ type: 'serverCodeRejected', attemptsLeft: 4 }], base)).toMatchObject({ step: 'codeSent', attemptsLeft: 4 });
    expect(run([{ type: 'serverAttemptsExhausted' }], base)).toEqual({ step: 'blocked', reason: 'tooManyAttempts' });
    expect(run([{ type: 'serverCodeExpired' }], base)).toEqual({ step: 'blocked', reason: 'codeExpired' });
    expect(run([{ type: 'submitEmail', domain: 'x.edu' }, { type: 'serverRateLimited', retryAt: NOW + 3_600_000 }])).toEqual({ step: 'blocked', reason: 'rateLimited', retryAt: NOW + 3_600_000 });
  });

  it('one-time redemption: an already-redeemed answer blocks, and a new email cannot restart it', () => {
    const s = run([{ type: 'submitEmail', domain: 'mcgill.ca' }, sent, { type: 'submitCode' }, { type: 'serverVerified', eligibility: 'student', offerToken: 't' }, { type: 'activateTrial' }, { type: 'serverAlreadyRedeemed' }]);
    expect(s).toEqual({ step: 'blocked', reason: 'alreadyRedeemed' });
    expect(run([{ type: 'submitEmail', domain: 'ox.ac.uk' }], s)).toBe(s);
  });

  it('an unlisted institution can be sent for review', () => {
    const s = run([{ type: 'submitEmail', domain: 'newuni.ac.uk' }, sent, { type: 'submitCode' }, { type: 'serverVerified', eligibility: 'needsReview', offerToken: 't' }, { type: 'serverReviewQueued' }]);
    expect(s).toEqual({ step: 'reviewRequested', domain: 'newuni.ac.uk' });
  });

  it('with no backend the flow says unavailable instead of pretending to send an email', async () => {
    const svc: StudentVerificationService = new UnavailableStudentVerificationService();
    expect(await svc.requestCode('a@mcgill.ca')).toEqual({ status: 'unavailable' });
    expect(run([{ type: 'submitEmail', domain: 'mcgill.ca' }, { type: 'serviceUnavailable' }])).toEqual({ step: 'blocked', reason: 'unavailable' });
  });
});

describe('ad eligibility (rules only; no SDK)', () => {
  const approved: Record<string, AdPlacement> = { feed: { id: 'feed', surface: 'courseSpaceFeed', format: 'sponsorCard', approved: true, label: 'Sponsored' } };
  const ok: AdContext = { access: 'free', placementId: 'feed', surface: 'courseSpaceFeed', adConsent: true, ageRequirementMet: true, childView: false, focusSessionActive: false, sensitiveAcademicContentVisible: false };

  it('Free users on an approved placement with consent are eligible', () => {
    expect(adEligibility(ok, approved)).toEqual({ eligible: true });
    expect(adEligibility({ ...ok, access: 'trialExpired' }, approved).eligible).toBe(true);
  });

  it('trial, paid, pending and unknown access never see ads', () => {
    for (const access of ['trialActive', 'paidActive', 'pending', 'unavailable'] as const) expect(adEligibility({ ...ok, access }, approved)).toEqual({ eligible: false, reason: 'notFree' });
  });

  it('every condition must hold', () => {
    expect(adEligibility({ ...ok, focusSessionActive: true }, approved)).toMatchObject({ reason: 'focusSessionActive' });
    expect(adEligibility({ ...ok, sensitiveAcademicContentVisible: true }, approved)).toMatchObject({ reason: 'sensitiveContent' });
    expect(adEligibility({ ...ok, adConsent: false }, approved)).toMatchObject({ reason: 'noConsent' });
    expect(adEligibility({ ...ok, ageRequirementMet: false }, approved)).toMatchObject({ reason: 'ageRequirement' });
    expect(adEligibility({ ...ok, childView: true }, approved)).toMatchObject({ reason: 'childView' });
    expect(adEligibility({ ...ok, placementId: 'nope' }, approved)).toMatchObject({ reason: 'unknownPlacement' });
  });

  it('never in the timer, assignments, notes, syllabus review, notifications, retrieval or messages', () => {
    for (const surface of ['focusTimer', 'assignment', 'notes', 'syllabusReview', 'notification', 'retrieval', 'messages', 'announcements'] as const) {
      expect(adEligibility({ ...ok, surface }, { feed: { ...approved.feed!, surface } })).toMatchObject({ eligible: false, reason: 'forbiddenSurface' });
    }
  });

  it('no placement is approved today, so nothing is eligible with the shipped registry', () => {
    for (const id of ['courseSpaceFeedSponsor', 'communityDiscoverySponsor', 'finalGrindSponsorship']) {
      const surface = id === 'courseSpaceFeedSponsor' ? 'courseSpaceFeed' : id === 'communityDiscoverySponsor' ? 'communityDiscovery' : 'finalGrind';
      expect(adEligibility({ ...ok, placementId: id, surface })).toEqual({ eligible: false, reason: 'placementNotApproved' });
    }
  });
});
