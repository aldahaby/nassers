import type { AdPlacement, AdSurface } from '@/core/models';

/**
 * Ad placements (docs/PREMIUM_ARCHITECTURE.md). Planned, NOT approved: no ad
 * SDK is integrated and nothing is shown. A placement must be reviewed and
 * marked approved before eligibility can ever be true.
 */
export const AD_PLACEMENTS: Record<string, AdPlacement> = {
  courseSpaceFeedSponsor: { id: 'courseSpaceFeedSponsor', surface: 'courseSpaceFeed', format: 'sponsorCard', approved: false, label: 'Sponsored' },
  communityDiscoverySponsor: { id: 'communityDiscoverySponsor', surface: 'communityDiscovery', format: 'sponsorCard', approved: false, label: 'Sponsored' },
  finalGrindSponsorship: { id: 'finalGrindSponsorship', surface: 'finalGrind', format: 'sponsorship', approved: false, label: 'Sponsored' },
};

/** Never ads here, approved or not. */
export const FORBIDDEN_AD_SURFACES: readonly AdSurface[] = ['focusTimer', 'assignment', 'notes', 'syllabusReview', 'notification', 'retrieval', 'messages', 'announcements', 'childView'];
