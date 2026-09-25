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

## Status: milestone 1 (foundation)

Working:
- Onboarding: welcome, how it works, choose one of 3 original starter pets, name it
- Pet home screen: animated pet (idle bob, breathing, blinking, tap to squish with hearts and a
  speech bubble), name, level, XP, growth stage, happiness, health, coins, day streak; equipped
  accessories and room decorations are drawn on the pet and in the room
- Bottom tabs: Pet · Focus · Shop · Stats · Settings
- All game logic (economy, progression, care, focus sessions, inventory, streaks) as pure,
  tested functions
- Local persistence with schema versioning and migrations
- Mock Screen Time service behind a swappable interface
- Settings with developer tools: grant coins or XP, simulate a successful or abandoned session,
  "dress up" to preview cosmetics, and reset

Next milestone: the Focus, Shop/Inventory and Stats screens, plus the reward summary animation.

## Tuning

Every number is in `src/config/`: `economy.ts`, `progression.ts`, `petCare.ts`, `focus.ts`,
`shopCatalog.ts`.
