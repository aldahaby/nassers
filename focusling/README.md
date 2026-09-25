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

No native modules beyond Expo's standard set are used yet, so **Expo Go** works.

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

Next: a real Screen Time proof-of-concept on a device.

## Tuning

Every number is in `src/config/`: `economy.ts`, `progression.ts`, `petCare.ts`, `focus.ts`,
`shopCatalog.ts`.
