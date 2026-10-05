# Focusling

A focus app with a virtual pet. Set a focus session, stay off the apps that distract you, and your
pet grows happier, healthier and bigger. Coins earned from focusing buy food, toys, outfits and room
decor.

The pet, art and mechanics are all original. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for the full design.

## Run it

```bash
cd focusling
npm install
npx expo start          # then press i (iOS simulator), a (Android), or w (web)
```

The web build and Expo Go use a mock protection service. Real protection needs an iOS development build (see `docs/IOS_DEVICE_TEST_PLAN.md`).

| Command | |
|---|---|
| `npm test` | Unit tests for the game logic |
| `npm run typecheck` | TypeScript, strict |
| `npm run lint` | ESLint (Expo config) |
| `npx expo export --platform web` | Static web build in `dist/` |

## Status

**Milestone 1 (foundation):** onboarding, animated pet home screen, bottom tabs, pure tested game
logic, local persistence, and a mock Screen Time service.

**Milestone 2 (focus loop):**
- Focus setup: 15/30/45/60 or a custom length (±5 min stepper, 5–180), the pet on screen, and the
  expected coins, XP, completion bonus and happiness before you start
- Active session: the pet breathes slowly inside a progress ring and gives a quiet smile about every
  45 s; big countdown, end time, coins and XP you'll earn, session streak. Timing comes from
  timestamps, so leaving the app or reloading doesn't break it
- End early: a low-key text link, a confirmation that makes "Keep focusing" the main button, and a
  neutral "Session ended early. You still made some progress."
- Completion: reward rows reveal one by one, the coin balance counts up, the XP bar fills and rolls
  over levels, streak progress, confetti, and a happy pet. A separate celebration screen follows for
  a level-up, a new growth stage (old form → flash → new form) or evolution
- A session that ended while the app was closed opens straight into its reward screen
- Returning to the pet: it hops and thanks you, and the stats already show the new values
- Developer tools on the Focus tab (only when Settings → Developer tools is on): start a session
  with 8 s left, skip to 8 s left, complete now, simulate opening a blocked app, and prime XP one
  short of a level-up, growth stage or evolution

**Milestone 3 (shop, inventory and pet items):**
- Shop tab with Accessories / Toys / Food / Room, a prominent coin balance, and 20 original items.
  Tapping opens a details sheet (on-pet or in-room preview, what it does, cosmetic vs interactive,
  price vs balance, "about N more focus sessions"). Nothing is bought from the grid
- After buying: the item pops in, the balance ticks down, and you're offered "Put it on" / "Place it"
  / "Play" / "Feed". The first-ever purchase says "Your focus paid for {pet}'s first gift!"
- Accessories in head / face / neck slots (items that would overlap share a slot); room decor in
  wall / left floor / centre rug / right floor slots; all persisted
- Toys have their own animations (ball bounces, bear hug, twirling star, bubbles);
  happiness only once per cooldown, but playing is always allowed. Food plays an eating animation
  and is consumed
- Inventory (from the Shop's "My items" or the pet screen's "Items") with a pinned live preview of the
  pet and room: wear / take off, place / remove, play, feed
- Pet screen items bar: one-tap toys and snacks
- Developer tools: +100 coins, clear inventory, unlock all, one of each, reset equipped, dress up

**Milestone 4 (iOS selective blocking POC), awaiting physical-device testing:**
- Research and decision: `docs/IOS_SELECTIVE_BLOCKING_RESEARCH.md` (chosen: on-device visual
  detection with iOS 27 ScreenCaptureKit, plus a Screen Time shield intervention; whole-app blocking
  as the user-chosen fallback). Third parties: `docs/THIRD_PARTY_RESEARCH.md`.
- Native module `modules/focusling-protection` (Swift): Family Controls, FamilyActivityPicker,
  ManagedSettings, DeviceActivity, ScreenCaptureKit capture, Vision-based Reels detector
  (heuristic, not production), temporal voting policy, interventions, App Group state.
- Extensions in `targets/`: Shield Configuration, Shield Action, Device Activity Monitor.
- JS: `FocusProtectionService` (mock on web, iOS on device), native-authoritative session start,
  one cleanup path, reconciliation, Protection settings screen, Developer Mode native panel.
- Device test plan: `docs/IOS_DEVICE_TEST_PLAN.md`.

**Milestone 5 (Family Mode, Missions, Calm Play):** details in `docs/FAMILY_MODE.md`.
- Onboarding asks "Who is Focusling for?": *For me* (the app as before) or *For my child*. Existing
  saves migrate to *For me* and skip the question.
- Family Mode (local, one device, one child): parent PIN (salted hash, throttled), child nickname,
  pet, first mission, then **Child View** (Pet, Missions, Play, Shop). The **Parent Gate** leads to
  the **Parent Dashboard** (today's focus totals, current mission, honest protection state, the
  child's pet), mission management and parent settings. No monitoring, no accounts, nothing leaves
  the device.
- Missions in both modes: focus minutes, session count, scheduled focus; six presets (Wind Down is
  marked unavailable until native protection can verify it) and a custom editor. Paid once per
  occurrence, missed missions are never punished.
- Play: Memory Garden (4 pairs, no timer) and Toy Toss (5 tosses, constant speed) with the real pet,
  a 10-coin daily play cap, and an optional "after a mission" parent setting.
- Developer tools for modes, gate, missions and play (hidden and refused when off).

**Creative milestone (cosmetics, wardrobe, rewards):** details in `docs/COSMETICS.md`.
- Focus Club: an original cute-streetwear collection (Gummy Visor, Cloud Cap, Charm Harness, Mood
  Charms, Emotion Auras) in colourways, across five combinable slots (head, face, neck, charm, aura).
- Earned by visible focus milestones (first session, hours focused, missions, growth, streaks), never
  by chance; a few colourways cost coins. All cosmetics are stat-neutral.
- Session completion reveals new items ("New for Nimbus" → Wear it / Later) plus an honest "Next"
  line; the Wardrobe has try-on for everything, progress for locked pieces and 3 saved looks.
- An equip beat (land → hop → sparkle) and twinkling auras, all toned down for Reduce Motion and
  still during focus sessions.

**Style system (collections, Looks, Reactions):** details in `docs/COSMETICS.md` §7–15.
- Three original collections with their own silhouette language: **Midnight Arcade** (pixel beanie,
  scanline visor, tech collar, pixel burst), **Dreamwave** (crescent headband, heart shades, pearls,
  moon charm, dream aura) and **Cloud Racer** (racing cap, aero shades, wind-blown scarf, rosette,
  speed lines): 21 pieces plus one matching room accent each. Permanent, no FOMO.
- Collection progress and a one-time completion that unlocks the collection's **Reaction**.
- Reactions (Wave, Happy Hop, Sleepy, Cool Pose, Star Twirl, Pixel Pop, Dream Float, Victory Lap)
  with a favourite the pet uses after sessions and on the occasional tap, never during focus; each
  has a Reduce Motion version.
- Redesigned Wardrobe (Pieces · Looks · Collections · Reactions), collection lookbook pages, curated
  collection Looks separate from three personal (renameable) Looks, gentle compatibility swaps,
  species/growth-stage fit overrides, and a developer Fit Lab.
- Home: Wardrobe is the primary customisation action; Items and Shop are compact secondary buttons.

**Art direction pass:** details in `docs/ART_DIRECTION.md`.
- A Materials Bible (jelly, smoked, chrome, pearl, fabric, knit, glossy plastic, holographic, fuzzy,
  wood) with upgraded art across every collection.
- Species-aware headwear: hats never hide the Sproutling's sprout or the Emberling's flame; tested
  eye clearance for every species and stage; auras frame the pet instead of covering it.
- **Moss Club**, a new original collection (7 pieces, badge, Look, the calm *Firefly Hello* reaction).
- The Wardrobe as a dressing room (pet first, outfit card, piece details with provenance such as
  "Earned after 5 completed focus sessions"), collection lookbooks and personality families
  (Calm, Hype, Dreamy, Cool) for reactions. Still v1 vector art; see the illustrator handoff.

**Character, room and sound pass:** details in `docs/ART_DIRECTION.md` §11–15 and `docs/AUDIO_DIRECTION.md`.
- Richer base Focuslings: species-specific rendering (cloud lobes, veined leaves, layered flame),
  illustrated eyes, a fuller expression library, visible growth without clothing, and quiet idle life.
- **Room Studio:** any room colour, free for everyone (Child View too), with presets and a derived,
  art-directed palette that adapts to very dark and very bright colours.
- **Bubbly micro-sounds:** original synthesised UI sounds with one semantic palette, focus-session
  silence rules, rapid-tap protection, a Sound Effects setting and a developer Audio Lab. No music.

**Premium foundation:** details in `docs/PREMIUM.md`.
- Consumer-first tabs: Pet / Focus / Shop / Play / Settings, with missions inside Focus. Family Mode
  is unchanged and still offered in onboarding.
- One entitlement system (capabilities, never `isPremium`), a StoreKit 2 module (written, **not yet
  compiled or tested on a device**), a web/dev mock store and an "unavailable" fallback. Premium is
  never stored in the save.
- Premium content: the Nightglow collection, two Premium Looks, four room themes and the Aurora Veil
  aura. Everything can be previewed on your own pet for free; room colour stays free.
- A single Premium screen, Settings trust surfaces (Premium status, Restore, Manage, privacy, terms,
  support, version, local data erase) and Premium QA tools behind Developer tools.
- Native iPhone checks still to run: `docs/NATIVE_IPHONE_TEST_PLAN.md`.

## Tuning

Every number is in `src/config/`: `economy.ts`, `progression.ts`, `petCare.ts`, `focus.ts`,
`shopCatalog.ts`, `cosmetics.ts`, `collections.ts`, `reactions.ts`, `missions.ts`, `play.ts`, `family.ts`, `room.ts`, `roomThemes.ts`, `sounds.ts`, `premium.ts`, `legal.ts`.
