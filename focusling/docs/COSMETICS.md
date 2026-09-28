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
