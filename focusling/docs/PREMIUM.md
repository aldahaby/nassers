# Focusling Premium

> Focus for free. Make your Focusling's world bigger with Premium.

Free is the whole product: every focus session, reward, coin, XP point, growth stage, streak,
mission, the five free collections, the shop, Looks, reactions, any room colour, Play, sounds and
focus protection. Premium sells **depth and expression** only. It never changes focus rewards,
pet mood or growth, and it never adds energy, loot boxes, paid multipliers, countdowns or coin packs.

## 1. Status: what exists today

| Piece | Status |
|---|---|
| Entitlement model + capabilities (`src/core/entitlements`) | Implemented, unit-tested |
| Runtime entitlement store (`src/state/entitlementStore.ts`) | Implemented, unit-tested with the mock |
| Mock store (web / `__DEV__`) | Implemented. Purchases only while Developer tools are on, in memory only |
| StoreKit 2 module (`modules/focusling-store`) | **Written, not compiled, not run.** Needs a Mac/EAS build and App Store Connect products (or a StoreKit configuration file) |
| Premium content: Nightglow (6 pieces), 2 Premium Looks, 4 room themes, Aurora Veil aura | Implemented (original art) |
| Premium screen (`/premium`), Settings + Parent status, Restore, Manage | Implemented against the store interface; verified on web with the mock only |
| Real products, prices, receipts, sandbox purchases | **Not done**: needs App Store Connect |
| Student offer | **Architecture only** (see §7). No verification, no promo in production UI |

## 2. One entitlement system

```
StoreService (StoreKit | Mock | Unavailable)
      │ currentEntitlement / purchase / restore / Transaction.updates
      ▼
entitlementStore (runtime only, never in the save)  ── devOverride (Developer tools only, memory only)
      │ effectiveEntitlement()
      ▼
capabilitiesFor(entitlement, { childView, storeAvailable })   ← the single source of truth
      │
      ├─ useCapabilities()            (screens)
      └─ capabilities provider        (game store actions: equip, wear look, set theme)
```

Screens and store actions ask for **capabilities**, never `isPremium`:

| Capability | Free | Premium / Student promo | Child View |
|---|---|---|---|
| `canUsePremiumCollections` | ✗ | ✓ | same as the family's entitlement |
| `canUsePremiumLooks` | ✗ | ✓ | same |
| `canUsePremiumRoomThemes` | ✗ | ✓ | same |
| `canUsePremiumEffects` | ✗ | ✓ | same |
| `canUseAdvancedCustomization` | ✗ | ✓ | same |
| `canPreviewPremium` | ✓ | ✓ | ✓ |
| `canPurchase` | ✓ if a store is available | ✗ (already subscribed) | **always ✗** |

Only `status: 'active'` counts as Premium (`pending`, `expired`, `revoked`, `unknown` do not).
A developer override counts while it exists; it can only be set with Developer tools on and is
cleared when they're turned off.

**No Premium in the save.** `GameSave` has no entitlement field; a copied or edited save cannot
grant Premium. On iOS, StoreKit's verified `Transaction.currentEntitlements` is authoritative.

## 3. Catalog metadata and the legacy policy

Each catalog item has `access: 'free' | 'premium'` (default free), `source` (`starter`, `earned`,
`shop`, `premium`), plus optional `previewable` and `availability`. Collections have `access`.
Room themes live in `src/config/roomThemes.ts`.

- **Owned items are wearable forever.** Anything in `inventory.items` stays yours whatever happens
  to a subscription. Nothing is silently removed.
- **Premium pieces are never added to the inventory.** They're "included" while entitled.
- **Losing Premium hides, never deletes.** Equipped Premium pieces stay in the save;
  `effectiveEquipped(save, caps)` hides them, and they reappear on resubscribe. A saved Premium room
  theme works the same way (`useRoomTheme()` returns it only while entitled).
- Premium collections have no completion reward or reaction and never count toward "collections
  complete", so free progress is never measured against paid content.
- Choosing a Premium theme requires Premium at that moment (`setRoomTheme` refuses otherwise).

## 4. Previews

Anyone can try on any Premium piece, Look or theme on their own Focusling (Wardrobe, collection
page, Room Studio, Premium screen). Locked content uses one marker, `PremiumMark` (sparkle glyph +
the word "Premium", never colour alone), and says "Try it on free". Child View sees previews but
never a purchase button or "See Premium" link.

## 5. StoreKit 2 implementation (`modules/focusling-store/ios/FocuslingStoreModule.swift`)

APIs used, checked against Apple's documentation:

| Need | API |
|---|---|
| Products, localized name/price/period | `Product.products(for:)`, `displayName`, `displayPrice`, `subscription.subscriptionPeriod` |
| Intro offer eligibility | `Product.SubscriptionInfo.isEligibleForIntroOffer(for:)` |
| Purchase | `product.purchase()` → `.success(verification)` / `.pending` / `.userCancelled` |
| Verification | only `VerificationResult.verified` transactions unlock; `transaction.finish()` after |
| Current access | `Transaction.currentEntitlements` (excludes refunded/revoked), `revocationDate`, `expirationDate` |
| Renewal state | `product.subscription.status` → `renewalInfo.willAutoRenew` |
| Live changes | `Transaction.updates` listener started on module create → `onEntitlementChange` |
| Restore | `AppStore.sync()` (only from the Restore button; it can prompt for sign-in) |
| Manage | `AppStore.showManageSubscriptions(in:)` |

Not used: `presentOfferCodeRedeemSheet` (deprecated in iOS 27) and the signature-based promotional
offer API (deprecated in iOS 26). If promo offers are added, use the current replacement APIs.

## 6. What App Store Connect must provide (before any real purchase)

1. Paid Apps agreement, tax and banking.
2. One subscription group (proposed name "Focusling Premium") with auto-renewable products.
   Replace the **placeholder** IDs in `src/config/premium.ts` (`com.focusling.app.premium.monthly`
   / `.yearly`). These are proposals, not final.
3. Localized display names, descriptions and prices (the app shows StoreKit's strings only).
4. Hosted Privacy Policy URL (mandatory) and Terms (or use Apple's standard EULA), then set
   `src/config/legal.ts`. Until then the app says "link added before launch".
5. A review screenshot of the Premium screen; sandbox testers; optionally a `.storekit` file for
   local testing in Xcode.
6. Family Controls distribution entitlement approval (separate request; needed for any App Store
   build of the protection feature).

## 7. Student offer (architecture only)

Nothing here verifies students. Focusling does **not** capture or store student ID images and
does not build or fake verification. Planned flow:

```
third-party verifier (future, its own privacy review)
   → eligibility token/status (server-side, short-lived, never a photo)
   → StoreKit offer (introductory/offer code or a current promotional-offer API)
   → Apple entitlement (tier: premiumStudentPromo) → same capabilities as Premium
```

Eligibility is separate from entitlement: being eligible unlocks nothing until Apple reports an
active transaction. Types live in `src/core/models/future.ts` (`StudentPromoEligibility`) and are
not part of the save. The only UI is a Developer-tools demo card ("Student offer demo"); production
UI never advertises an unavailable promo. See `docs/FUTURE_FRIENDS_AND_PROMO.md`.

## 8. Family Mode

- Purchases, Restore and Manage appear only in Self Mode Settings and Parent settings (behind the
  parent PIN). Child View has `canPurchase = false`, a read-only Premium page, and no "See Premium"
  links in the Wardrobe, collections, Room Studio or Shop.
- Premium doesn't change any parent boundary (play access, missions, protection, PIN).
- Local-only: no remote parent accounts, no cloud pairing.

## 9. Developer tools (QA)

Settings → Developer tools → **Premium (QA)**: Force Free / Premium / Student (memory only),
mock "next purchase" pending/cancelled/failed, simulate expired/revoked, student offer demo.
All refused by the store unless Developer tools are on.
