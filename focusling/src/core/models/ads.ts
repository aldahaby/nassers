/** Ad eligibility types (interfaces only; no ad SDK). */
export type AdSurface =
  | 'courseSpaceFeed'
  | 'communityDiscovery'
  | 'finalGrind'
  // Surfaces that never carry ads:
  | 'focusTimer'
  | 'assignment'
  | 'notes'
  | 'syllabusReview'
  | 'notification'
  | 'retrieval'
  | 'messages'
  | 'announcements'
  | 'childView';

/** Only labelled cards/sponsorships. No interstitials, rewarded ads or formats that look like messages. */
export type AdFormat = 'sponsorCard' | 'sponsorship';

export interface AdPlacement {
  id: string;
  surface: AdSurface;
  format: AdFormat;
  /** Reviewed and approved for use. All false today. */
  approved: boolean;
  /** Always visibly labelled. */
  label: 'Sponsored';
}

export interface AdContext {
  access: import('./entitlement').AccessState;
  placementId: string;
  surface: AdSurface;
  /** Consent for ads (and any tracking) where required; false until asked. */
  adConsent: boolean;
  /** Age requirements for the region are met (never assumed). */
  ageRequirementMet: boolean;
  childView: boolean;
  focusSessionActive: boolean;
  /** Assignments, notes, syllabus review, grades or retrieval answers are on screen. */
  sensitiveAcademicContentVisible: boolean;
}

export type AdIneligibleReason = 'notFree' | 'unknownPlacement' | 'placementNotApproved' | 'forbiddenSurface' | 'surfaceMismatch' | 'noConsent' | 'ageRequirement' | 'childView' | 'focusSessionActive' | 'sensitiveContent';

export type AdEligibility = { eligible: true } | { eligible: false; reason: AdIneligibleReason };
