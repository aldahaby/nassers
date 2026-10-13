# Premium architecture: access states, trials, student verification, ads

Foundations only. **No billing, no verification backend, no ad SDK.** Nothing here can grant paid
access from the client. See also `docs/PREMIUM.md`.

## Access states (`core/entitlements/entitlementService.ts`)

`accessStateFor(entitlement, now)` → one of:

| State | When | Premium capabilities |
|---|---|---|
| `free` | No entitlement, unknown, inactive | Off |
| `trialActive` | Active, `period: 'trial'`, not past `expiresAt` | On |
| `paidActive` | Active paid (including won't-renew until it expires) | On |
| `trialExpired` | Store says expired/revoked, or `expiresAt` passed, for a trial | Off |
| `paidExpired` | Same, for paid | Off |
| `pending` | e.g. Ask to Buy | Off |
| `unavailable` | No store / can't reach the authority | Off (nothing deleted; records stay Free) |

`capabilitiesFor(entitlement, { childView, storeAvailable, now })` is still the single gate. New:
`canUseExtendedStats`. Entitlements come only from the store service at runtime; nothing is read
from the save.

**Developer override hardening:** "Force Premium" now needs Developer tools **and** a development
build or the web demo (`devOverrideAllowed()`: `__DEV__ || Platform.OS === 'web'`). Developer tools
can be switched on in a release build, so they alone can no longer grant Premium.

## Trials (`config/trials.ts`)

- Verified email at an approved institution: **30 days**. Everyone else: **14 days**.
- These numbers are copy only (`trialOfferFor`). The server decides eligibility, activates a trial
  once (`activateTrial`), and reports the resulting entitlement and expiry.

## Student email verification

Models: `core/models/verification.ts`. Logic: `core/verification/`. Service:
`services/verification/StudentVerificationService.ts`.

1. Email entered → `normalizeEmail` → `classifyDomain` against the approved directory.
   - Only a directory match (exact domain or a subdomain of it) is **recognized**.
   - An academic-looking suffix (`.edu`, `.ac.uk`, `.edu.au`, `.ac.nz`, `.edu.jo`, …) alone is
     `academicUnlisted` → offer "Ask us to add your school" (review route).
   - Institution domains without academic suffixes (e.g. `mcgill.ca`) work through the directory.
   - `config/institutions.ts` is a **sample** for tests, not the real directory (that lives on the
     server).
2. `requestCode` → the server sends a six-digit code.
3. `verifyCode` → server checks it and answers eligibility (`student` / `standard` / `needsReview`).
4. `activateTrial(offerToken)` → one-time redemption on the server.
5. `requestInstitutionReview` for missing institutions.

The client flow is a pure reducer (`verificationReducer`): every change to eligibility, attempts,
expiry or trial status comes from a server event. The state never holds the code.

**Today the app ships `UnavailableStudentVerificationService`**, which answers "unavailable" to
everything. There is no verification UI and no simulated email.

### Server requirements (for the future backend)

- Codes from a cryptographically secure RNG; server-side expiry and rate limits; attempt limits and
  resend cooldowns.
- No raw codes in persistent logs.
- Eligibility and trial redemption decided only on the server; one redemption per person/account.
- Minimal collection and retention of personal data; no student ID photos in the default flow.
- No sharing of verification emails or academic data with advertisers.
- Email-domain verification proves control of the address, not current enrollment.

## Ads (`core/ads/adEligibility.ts`, `config/ads.ts`)

Rules only. `adEligibility(ctx)` is true only when **all** hold:

- access is `free`, `trialExpired` or `paidExpired` (never trial, paid, pending or unavailable);
- the placement exists, is on its own surface, and is **approved** (none are approved today);
- not Child View; ad consent given; regional age requirements met;
- no active focus session; no sensitive academic content on screen.

Planned placements: Course Space feed sponsor card, community discovery sponsor card, Final Grind
sponsorship (all labelled "Sponsored", all `approved: false`).

Never: the focus timer, assignments, notes, syllabus review, retrieval, notifications, messages or
announcements, Child View, full-screen interstitials, rewarded ads, or anything that pays for
studying longer or looks like a classmate's message.
