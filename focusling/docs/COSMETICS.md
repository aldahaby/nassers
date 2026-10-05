# Cosmetics, Wardrobe and Rewards

Creative milestone. Goal: Focusling is a focus companion you build a relationship and a collection
around, not a timer with a mascot. Research basis: the *Focusling Pet & Cosmetics Trend Strategy*
brief. The product line from it that everything below serves: **"Nimbus turns focus into identity."**

## 1. Design principles (from the research, applied to this codebase)

| Research finding | What we did |
|---|---|
| Modular pieces beat fixed outfits (Roblox makeup, Fortnite Kicks, Adopt Me fit tools) | Five wearable slots that combine freely: **head, face, neck, charm, aura**. Charm stacks with a neck item; aura is its own layer. |
| Cosmetics should be stat-neutral, or people dress for optimisation, not identity | Every item's XP/coin bonus was removed. The bonus plumbing stays so one could be set deliberately; a test guards that none is. |
| Earned prestige: the best pieces should come from healthy behaviour | The Focus Club collection is mostly **earned** by visible milestones (first session, 2 h of focus, 5 missions, first growth, 3-day streak…). |
| No paid gacha, mystery pulls, confusing currencies, fake scarcity (FTC Genshin action) | No randomness anywhere. Every unlock rule and its progress is shown up front. No countdowns, no rarity ladder, no real money. |
| Try-on should be free | Anything, owned or not, can be tried on in the wardrobe; nothing is saved until you wear something you own. |
| Seasonal colourway system: one asset, many palettes | Items share a drawing (`art.key`) and carry a palette. Gummy Visor ships in 4 colourways, Cloud Cap in 2, Mood Charms in 4 shapes. |
| Cute streetwear around an unmistakably soft mascot; gummy / translucent materials | Oversized cap with a stitched cloud, translucent visor, pin-covered harness, dangling mood charms, soft auras. Nimbus's face stays readable. |
| Palette references: frosty blue, jade, plum, wasabi, persimmon | Used as colourways (`COLORWAYS` in `config/cosmetics.ts`), not as the permanent app brand. |
| Animation ladder: most items A/B, a few hero items C | A: items move with the pet (they're drawn in its body). B: the equip beat. C: auras twinkle, go still and dim during focus. |
| Equip storyboard: notice → land → hop → sparkle → settle; Reduce Motion = crossfade + static highlight | `PetReactionStage` "show" reaction does exactly this; Reduce Motion gets one fading highlight ring. |
| Legal/source metadata for every item | `credit: { designer, rights: 'original', art: 'v1' | 'final' }` on every collection item. |
| Child side: earned items and play, no purchase pressure (Québec, Apple Kids) | Child View gets the same wardrobe and reveals. Nothing costs real money anywhere; the only prices are coins earned by focusing. Copy never uses urgency, envy or guilt. |
| Don't make "minutes browsing cosmetics" a goal | The wardrobe is one finite screen: no feeds, no refreshes, no recommendations. |

**Out of scope this milestone** (per research roadmap, later phases): real-money bundles, creator
capsules, licensed collaborations, a bounded customiser, AR, seasonal availability windows, social
share cards, dark mode.

## 2. The loop

**Focus → complete → reward → discover → customise → return.**

1. A session ends. Rewards are computed in the same pure transition as coins, XP and missions
   (`endSession`), then `grantUnlocks` gives any starter/earned item the save now qualifies for.
2. The session summary shows a **"New for {pet}"** card: the item pops in with one small sparkle,
   says how it was earned, and offers **Wear it** or **Later**. Below it, an honest
   **"Next: … · 1 of 3"** line shows the closest locked item.
3. New items carry a **NEW** badge. The pet mentions it once per visit ("Psst… something new in the
   wardrobe!"), never during a focus session.
4. The **Wardrobe** shows everything: owned, wearing, earnable (with progress), and in the shop (with
   price). Tap to wear or take off; tap a locked item to try it on for free. Three saved **Looks**.

## 3. Architecture

Data and rendering are separate.

| Layer | File | Role |
|---|---|---|
| Model | `core/models/inventory.ts` | `AccessorySlot` (head, face, neck, charm, aura), `ItemSource` (shop, starter, earned), `UnlockRule`, `ItemPalette`, `ItemCredit`, `SavedLook`, `CosmeticsState` |
| Data | `config/cosmetics.ts` | Collections, colourway palettes, the Focus Club items, `COSMETICS.maxLooks` |
| Catalog | `config/shopCatalog.ts` | `CATALOG` = classic shop items + collections. `SHOP_ITEMS` = what the Shop sells (source `shop`). `EARNED_ITEMS` = starter + earned. |
| Rules | `core/cosmetics/cosmeticsService.ts` | `unlockProgress`, `grantUnlocks` (idempotent), `nextUnlock`, `getWardrobe`, `markItemsSeen`, looks |
| Save | `GameSave.cosmetics`, `stats.missionsCompleted` | Schema v5 (migration 4 backfills missions from daily stats). Ownership stays in `inventory`. |
| Art | `ui/pet/focusClubArt.tsx`, `ui/pet/accessories.tsx` | Drawings keyed by art key, drawn against per-species anatomy anchors, coloured by palette |
| Auras | `ui/pet/auras.tsx` | Particle sets around the pet; `AuraLayer` (animated or static), `AuraIcon` |
| Composition | `ui/pet/PetArt.tsx` | Fixed layer order: body → face → **neck → charm → face item → head** → aura overlay |
| UI | `app/wardrobe.tsx`, `features/wardrobe/*`, `features/completion/UnlockReveal.tsx` | Wardrobe, tiles, looks, reveal |

**Rules that keep it safe:**

- `grantUnlocks` skips owned items, so an item can be granted **once**, however often it runs:
  after every session, and on every launch (which also back-grants milestones reached before an
  update added an item). Tests cover reload, second sessions and abandoned sessions.
- Earned and starter items can't be bought (`purchaseItem` returns `not-for-sale`).
- Saved looks only equip items still owned, and only touch wearable slots (room decor is untouched).
- Starter items are always owned; even the developer "Clear inventory" gets them back on next launch.

### Rendering and fit

All art lives in the pet's 200×200 SVG space and is positioned from `ANATOMY[species]` anchors
(`headTop`, `eyeY`, `eyeDx`, `neckY`, `headHalfWidth`), so one drawing fits all three species. The
growth-stage scale applies to the whole pet, so accessories scale with it. Charms bring their own
cord so they never float. Auras render in a separate overlay so they can animate independently and
fall back to static.

**Focusing state:** during a session `AnimatedPet` is `calm`, so the aura goes still and dims to 55%.
**Reduce Motion:** auras are static, the pet doesn't bob or hop, the equip beat becomes one fading
ring, the reveal fades in instead of popping.

## 4. Adding a cosmetic

If its drawing already exists (a new colourway), it's **data only**. Add one entry to
`FOCUS_CLUB_ITEMS` (or a new collection array) in `config/cosmetics.ts`:

```ts
cosmetic({
  id: 'fc-visor-plum',
  name: 'Gummy Visor',
  colorway: 'Plum',
  description: 'The visor in dark plum.',
  slot: 'face',
  artKey: 'gummy-visor',
  palette: COLORWAYS.plum,
  obtain: { kind: 'sessions', count: 30 }, // or 'starter', or { price: 36 }
}),
```

For a new silhouette, also:

1. Add a drawing to `FOCUS_CLUB_ART` in `ui/pet/focusClubArt.tsx` (a function of anatomy + palette),
   and an icon crop in `FOCUS_CLUB_ICON_VIEWBOX`. For an aura, add a particle to `PARTICLES` in
   `ui/pet/auras.tsx` instead.
2. Check it on all three species and at 320 pt (the wardrobe's try-on is the quickest way).

A new unlock kind means one case in `UnlockRule`, `unlockProgress`, and `describeUnlock`. Tests in
`core/__tests__/cosmetics.test.ts` check that every collection item has a slot, art key, credit and a
valid way to obtain it.

## 5. Starter collection: Focus Club

| Item | Slot | How to get it |
|---|---|---|
| Mood Charm · Star | charm | Everyone starts with it |
| Gummy Visor · Frost | face | First finished session |
| Mood Charm · Heart | charm | 3 sessions |
| Cloud Cap · Plum | head | 2 hours of focus |
| Sparkle Aura | aura | First growth (Young) |
| Charm Harness | neck | 5 missions |
| Sleepy Stars | aura | 3 days in a row |
| Gummy Visor · Jade | face | 10 sessions |
| Mood Charm · Bolt | charm | 5 hours of focus |
| Pixel Hearts | aura | 10 hours of focus |
| Cloud Cap · Frost | head | 20 sessions |
| Gummy Visor · Persimmon / Wasabi | face | 36 coins each (Shop) |
| Mood Charm · Planet | charm | 28 coins (Shop) |

The six classic shop accessories (Dapper Bow, Sporty Cap, Cool Shades, Flower Crown, Focus
Headphones, Golden Crown) stay in the Shop, now stat-neutral, and appear in the wardrobe too.

## 6. Placeholder art

All accessory art, including the classic items, is **v1 in-house SVG drawn in code**
(`credit.art: 'v1'`). It matches the pet's own vector style and ships fine, but the research's art
prompts (cute-streetwear capsule, gummy materials) are written for an illustrator pass. Replacing
art keeps the same art keys and anatomy anchors, so no logic changes.

---

# Style System (collections, Looks, Reactions)

Milestone goal: two people can own the same Cloudling and make their Focuslings feel completely
different, visually and behaviourally. **Design rule: even fully customised, the pet must be
instantly recognisable as a Focusling** (eyes, face, silhouette, expressions stay readable).

## 7. Collections

A collection is a small, art-directed drop with its own silhouette language, a curated Look and
one completion Reaction. Definitions: `config/collections.ts` (`CosmeticCollection`, types in
`core/models/style.ts`). Membership is declared on each item (`collection: 'midnight-arcade'` in
`config/cosmetics.ts`); `collectionItemIds()` derives the member list, and a test checks every item
points at a registered collection.

| Collection | Line | Silhouette language | Look | Reaction |
|---|---|---|---|---|
| Focus Club | *Where every Focusling starts.* | soft, gummy, cute streetwear | Cloud Cap · Plum, Gummy Visor · Frost, Mood Charm · Star, Sparkle Aura | Star Twirl |
| Midnight Arcade | *Focus after dark.* | angular, pixel-stepped, glowing dots (plum, navy, violet, icy cyan) | Pixel Beanie, Scanline Visor, Tech Collar, Pixel Burst | Pixel Pop |
| Dreamwave | *Soft colours, big dreams.* | round, glossy, bobbing celestial shapes (lavender, pink, pearl, baby blue) | Crescent Headband, Heart Shades, Moon Charm, Dream Aura | Dream Float |
| Cloud Racer | *Built for the long run.* | sleek, swept, checkered, wind-blown (cream, racing red, cobalt, charcoal) | Racing Cap, Aero Shades, Racing Scarf, Speed Lines | Victory Lap |

**Pieces and how they're earned** (all visible in the Wardrobe; nothing random, nothing expires):

| Midnight Arcade | | Dreamwave | | Cloud Racer | |
|---|---|---|---|---|---|
| Pixel Beanie (head) | 5 sessions | Heart Shades · Pink (face) | 8 sessions | Racing Cap · Cream (head) | 12 sessions |
| Scanline Visor · Ice (face) | 3 h focus | Moon Charm (charm) | 4 h focus | Aero Shades (face) | 6 h focus |
| D-Pad Charm (charm) | 3 missions | Crescent Headband (head) | 7 missions | Racing Scarf (neck) | 10 missions |
| Tech Collar (neck) | 5-day streak | Dream Aura (aura) | 7-day streak | Winner’s Rosette (charm) | 25 sessions |
| Pixel Burst (aura) | 8 h focus | Cloud Beret (head) | grown up (Adult) | Speed Lines (aura) | 15 h focus |
| Arcade Headset (head) | 60 coins | Pearl Collar (neck) | 45 coins | Racer Goggles (head) | 70 coins |
| Scanline Visor · Neon (face) | 40 coins | Heart Shades · Baby Blue (face) | 40 coins | Racing Cap · Cobalt (head) | 45 coins |

Streak pieces use the **best** streak ever reached, so a broken streak never takes progress away.
Focus-minute pieces count actual focused minutes, including sessions ended early; session pieces
count only completed sessions (both tested).

**Room accents** (one lightweight piece each, Shop decorations, not part of completion): Pixel Lamp,
Moon Lamp, Racing Pennant. A collection references its accent via `roomAccent`.

**Progress and completion.** `collectionProgress()` → owned / total (room accents excluded).
`checkCollections()` records a completion **once** in `cosmetics.completedCollections` and unlocks
the collection's Reaction. It runs after sessions (in `endSession`), after purchases (buying the last
coin piece), and on launch. Completion awards no currency, no stats: only the Reaction.

### Creating a collection

1. Register it in `COLLECTION_LIST` (id, name, one-line tagline, description, palette, badge key,
   `featuredLook`, `reaction`, optional `roomAccent`, `availability: { kind: 'permanent' }`,
   `origin: { kind: 'first-party', designer }`).
2. Add its pieces to `config/cosmetics.ts` with `collection: '<id>'` (and add the array to
   `COLLECTION_ITEMS`).
3. Draw new silhouettes in `ui/pet/styleArt.tsx` (+ icon crops), auras in `ui/pet/auras.tsx`, the badge
   in `ui/style/CollectionBadge.tsx`.
4. Register its Reaction in `config/reactions.ts` (`unlock: { kind: 'collection', collectionId }`) and,
   if it's a new style, render it in `features/pet/reactionPerformer.tsx`.
5. Check it in the Fit Lab (Developer tools → Open Fit Lab): every species × stage.

The registry tests (`core/__tests__/style.test.ts`, `ui/__tests__/artRegistry.test.ts`) catch missing
drawings, icons, badges, palettes, credit, invalid fit data, Looks using pieces from another
collection or the wrong slot, and reactions that don't point back at their collection.

## 8. Looks

- **Collection Looks** are data (`featuredLook`). "Wear look" sets the wearable slots to exactly the
  Look's owned pieces (`wearCollectionLook`). If pieces are missing you can **Try on** the Look for free.
  They never use a personal slot.
- **My Looks** are three personal slots (`cosmetics.looks`): save the current outfit, wear, replace,
  rename (≤ 20 chars) or delete. Wearing a Look skips unknown, legacy or unowned ids gracefully.
- After wearing any Look, individual pieces can still be changed.

## 9. Compatibility

Most slots stack. An item can list wearable slots it **excludes**: equipping either side quietly
takes the other off (`withEquipped` in `cosmeticsService`). The Wardrobe says so gently ("Swapped out
the Winner’s Rosette so it fits."). No warnings, no constraint engine. Exclusions are only for a
**real visual overlap**: the Acorn Satchel's strap crosses the charm, so it excludes `charm` (tested as
the only exclusion). The Racing Scarf was re-tied at the side in the art-direction pass and now wears
with any charm. One item per slot already prevents two hats or two pairs of glasses.

**Visibility audit.** Face items are translucent (lens opacity 0.5–0.78; the registry test enforces a
minimum of 0.45 so lenses stay visible) so eyes always read through; the classic Cool Shades lenses were made translucent too. Auras
sit outside the face and were shrunk so they support the pet instead of competing with it. The
Racer Goggles sit up on the forehead, leaving the eyes clear. **Hats never hide the Sproutling sprout
or the Emberling flame**: crests are lifted through closed hats or drawn over open ones
(`ui/pet/crest.tsx`, [`ART_DIRECTION.md`](ART_DIRECTION.md) §3). Auras follow the framing rule in
`ART_DIRECTION.md` §4.

## 10. Fit overrides (species × growth stage)

Every drawing is placed from `ANATOMY[species]` anchors, so most pieces need nothing. An item may add
`art.fit: ItemFit[]` entries `{ species?, stage?, dx?, dy?, scale?, rotate? }`. Matching entries are
combined (most specific last) into one transform around the slot anchor (`fitTransform`,
`slotAnchor` in `ui/pet/accessories.tsx`). Current overrides: eyewear opens up at the **Baby** stage
(babies have ~1.18× eyes): Scanline Visor and Aero Shades ×1.08, Heart Shades ×1.12. Overrides are
limited to ±12 units and 0.8–1.25× by test.

## 11. Reactions

Short pet behaviours (1–3 s), not clothing: `config/reactions.ts`. Starter: **Wave, Happy Hop,
Sleepy, Cool Pose**. Collection: **Star Twirl, Pixel Pop, Dream Float, Victory Lap, Firefly Hello**.
Each belongs to a presentation-only personality family (Calm, Hype, Dreamy, Cool; `ART_DIRECTION.md` §7).

- **State:** `cosmetics.reactions.unlocked` and `equipped` (the favourite; defaults to Happy Hop).
  Locked reactions can be **previewed** but never equipped (`equipReaction` → `locked`).
- **Rendering:** `features/pet/reactionPerformer.tsx`. Each style drives the pet's body (translate,
  rotate, scale), sets a face (delighted, sleepy, wink) and draws one small effect (wave marks, z's,
  a glint, stars, chunky pixels, pastel stars, speed lines). Every animation is a finite timing that
  ends by itself.
- **Reduce Motion:** same face and same effect, faded in place, with at most a 4% scale pulse; no
  travel, spin or hop. Personality stays, movement goes.
- **When it plays:** after a session ends (once), every 4th tap on the pet (`REACTION_TAP_EVERY`), on
  preview in the Wardrobe or a collection page, and from "Try reaction" on a completion.
  **Never during an active focus session**: the focus screen doesn't render reactions and taps during
  a session don't trigger them.

## 12. Wardrobe and completion UX

- Wardrobe as a **dressing room** — pet first, outfit second, inventory third: a large pet on a tinted
  set with a floor (the collection's colour when you wear or try on its Look) → the **outfit card**
  ("The Moss Club look" / "Your remix", worn pieces as chips, the favourite's personality with Play,
  quick **Save look**) → segmented **Pieces · Looks · Collections · Reactions** → slot chips → pieces
  grouped by collection. Tapping a piece scrolls back to the pet and shows a **piece detail** panel
  (collection, material, provenance).
- **Provenance** (`provenanceOf` + `describeProvenance`): owned pieces say how and when they arrived
  ("Earned after 5 completed focus sessions · 28 Sep", "Bought with 55 focus coins"); others say how
  to get them. Shown on piece details, collection pages and the completion reveal.
- Collection page (`/collection/[id]`) as a **lookbook**: badge, line, the pet in the curated Look on
  the collection's set (toggle to your own outfit), progress, "Wear the look", the Reaction with
  Preview, **The look** strip, every piece with its detail and provenance, the room accent.
- Completion: in the session summary, after new pieces, a single **"{COLLECTION} COMPLETE"** card
  ("You collected the full … look. Unlocked: … reaction" · Try reaction · Wear the look), then one
  "Next" line. Outside a session (buying the last piece) the same card appears in a calm sheet.

## 13. Art and IP rules

- Everything is **original Focusling IP**, drawn in-house as code vectors (`credit.rights: 'original'`,
  `art: 'v1'`). No logos, real teams, brands, liveries, characters, celebrities or traced outfits;
  broad archetypes only (arcade, celestial soft-pop, motorsport-inspired).
- The Winner’s Rosette has no numbers; the Racing Cap's patch is an original winged cloud.
- Any future non-original asset needs a documented licence before it ships.

## 14. Future collaborations (boundary only, nothing built)

`CosmeticCollection.origin` and `availability` are unions so a licensed collection can be added
without changing first-party ones. A licensed collection would add:
`origin: { kind: 'licensed', partner, attribution, licenceRef, territories, validFrom, validTo, postTermUse }`
and possibly `availability: { kind: 'window', from, to, returns }`. Rules to keep: items obtained
during the licence stay usable after it ends (`postTermUse`), attribution shows on the collection
page, Child View never shows purchase prompts, and nothing time-limited ships without a separate
product decision (Family Mode audiences).

## 15. Ethical design

- No random drops, loot boxes, gacha or hidden odds; every piece shows exactly how it's earned.
- No rarity tiers; desire comes from collection identity ("the Midnight Arcade visor"), not colour codes.
- No paid random rewards, no real money anywhere; coin pieces use coins earned by focusing.
- No temporary FOMO: all current collections are permanent; no countdowns, rotations or scarcity.
- Cosmetics are stat-neutral; completion rewards are Reactions (personality), not economy.

## 16. Premium content

Items and collections carry `access: 'free' | 'premium'` (default free). Premium pieces use
`obtain: 'premium'` in `config/cosmetics.ts` (source `premium`), are never sold for coins, never
earned and never added to the inventory: they're *included* while the person has Premium and can be
tried on by anyone. Premium collections (currently **Nightglow**) have no completion reward or
reaction and never count toward "collections complete". Premium Looks live in `PREMIUM_LOOKS`.
Wardrobe states add `included` (Premium, entitled) and `premium` (preview only). Policy details,
including what happens when a subscription ends: [`PREMIUM.md`](PREMIUM.md) §3.
