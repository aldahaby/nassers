# Focusling: architecture

Focusling is a focus / screen-time app built around a virtual pet. The loop:

> Focus in real life → your pet benefits → you earn rewards → you customise your pet → you get attached → you focus more.

This document covers the milestone-1 planning deliverables: what the repo contained, the chosen
architecture, the folder layout, the data models, the reward formulas, and how real Screen Time
enforcement will plug in later.

---

## 1. What the repository contained

`aldahaby/nassers` had no mobile app to extend:

| Path | What it is |
|---|---|
| `index.html` | A standalone gold-price web page served by GitHub Pages |
| `game/` | CITYBREAKER, a single-file three.js game plus its GLB assets and vendored libraries |
| `app/` | A Capacitor 6 shell whose only job is native haptics for CITYBREAKER |
| `ASSETS_HOWTO.md` | Asset guide for CITYBREAKER |

Nothing there overlaps with this product, so Focusling is a **new, self-contained project in
`focusling/`**. The existing sites and the game are untouched, and GitHub Pages keeps serving them
as before.

## 2. Framework choice

**Expo (SDK 57) + React Native + TypeScript (strict), with Expo Router.**

- One codebase for iOS and Android, plus a web build for quick previews and screenshots.
- Real app blocking will need native code on both platforms (see §7). Expo's config plugins and
  local Expo Modules let us add Swift/Kotlin without leaving the managed workflow or hand-editing
  `ios/` and `android/`.
- Capacitor (already used in `app/`) could host native plugins too. But the Screen Time work is
  native-heavy, and React Native has the stronger ecosystem and examples for FamilyControls and
  Android usage-access modules.

Other libraries, kept deliberately small:

| Need | Choice | Why |
|---|---|---|
| State | `zustand` | Tiny and unopinionated; the store is a thin shell over pure logic |
| Persistence | `@react-native-async-storage/async-storage` | Standard key-value storage on device (localStorage on web) |
| Pet and room art | `react-native-svg` | Original vector art that scales crisply and animates cheaply |
| Animation | React Native `Animated` | Built in, works on web; Reanimated can come later if needed |
| Tests | `jest-expo` | Unit tests for all game logic |

## 3. Layers

```
┌────────────────────────────────────────────────────────────────┐
│ src/app/          Screens (Expo Router routes). Layout + wiring │
│ src/features/     Screen-specific composite components          │
│ src/ui/           Design system: theme, components, pet & room  │
├────────────────────────────────────────────────────────────────┤
│ src/state/        zustand store: calls core, persists results   │
│ src/hooks/        App lifecycle (foreground refresh, OS events) │
├────────────────────────────────────────────────────────────────┤
│ src/core/         PURE game logic. No React, no I/O, no clocks  │
│ src/config/       All tunable numbers and static catalogs       │
├────────────────────────────────────────────────────────────────┤
│ src/services/     Side-effect boundaries behind interfaces:     │
│                   SaveRepository, ScreenTimeService             │
└────────────────────────────────────────────────────────────────┘
```

Rules:

1. **`core/` is pure.** Every function takes state plus `now` and returns new state. That makes it
   deterministic and fully unit-testable, and it can later run unchanged on a server for
   validation.
2. **Numbers live only in `config/`.** No thresholds, prices or rates appear in UI files.
3. **UI never mutates game state.** Screens call store actions; store actions call `core` and then
   persist.
4. **Platform work goes behind interfaces** in `services/`, chosen in one composition root
   (`services/index.ts`).

## 4. Folder structure

```
focusling/
├── docs/ARCHITECTURE.md
├── src/
│   ├── app/                         # routes
│   │   ├── _layout.tsx              # root: hydrate save, loading/error gate, lifecycle
│   │   ├── index.tsx                # redirect → onboarding or tabs
│   │   ├── onboarding/              # welcome → how-it-works → choose → name
│   │   └── (tabs)/                  # Pet (home), Focus, Shop, Stats, Settings
│   ├── config/
│   │   ├── economy.ts               # coin/XP formulas' constants
│   │   ├── progression.ts           # level curve, growth stages
│   │   ├── petCare.ts               # happiness/health gains, decay, floors
│   │   ├── focus.ts                 # durations, streak rules, retention
│   │   ├── pets.ts                  # the 3 starter species
│   │   ├── shopCatalog.ts           # 13 shop items
│   │   ├── petLines.ts              # things the pet says
│   │   └── distractingApps.ts       # sample block targets for the mock
│   ├── core/
│   │   ├── models/                  # all data types
│   │   ├── economy/                 # reward maths
│   │   ├── progression/             # XP → level / stage
│   │   ├── pet/                     # care stats, decay, mood, petting
│   │   ├── focus/                   # session creation and timing
│   │   ├── inventory/               # buy / equip / feed / play
│   │   ├── streaks/                 # day + session streaks with freezes
│   │   ├── game/                    # cross-service actions (end session, refresh…)
│   │   ├── save/                    # new save factory, schema migrations
│   │   ├── shared/                  # dates, ids, Result type, math
│   │   └── __tests__/
│   ├── services/
│   │   ├── persistence/             # SaveRepository + AsyncStorage/Memory impls
│   │   ├── screenTime/              # ScreenTimeService + MockScreenTimeService
│   │   └── index.ts                 # composition root
│   ├── state/                       # store factory, app store, selector hooks
│   ├── hooks/                       # useGameLifecycle, useNow
│   ├── features/                    # pet/ and onboarding/ composites
│   ├── ui/                          # theme, components, pet art, room, icons
│   └── utils/
└── app.json, package.json, tsconfig.json, eslint.config.js
```

## 5. Data models

All in `src/core/models/`. Timestamps are epoch milliseconds; calendar days are local `YYYY-MM-DD`
keys.

| Model | Purpose | Key fields |
|---|---|---|
| `UserProfile` | Account-level info | `id`, `createdAt`, `onboardingCompletedAt`, `settings` |
| `Pet` | The persisted pet | `name`, `speciesId`, `stats`, `lifetimeXp`, `statsUpdatedAt`, `lastPettedAt` |
| `PetStats` | Care stats, 0–100 | `health`, `happiness` |
| `ProgressionState` | **Derived** from `lifetimeXp`, never stored | `level`, `xpIntoLevel`, `xpForNextLevel`, `stage`, `stageProgress` |
| `FocusSession` | One session | `plannedDurationMinutes`, `startedAt`, `endedAt`, `status`, `blockedTargets`, `reward` |
| `BlockTarget` | Something to block | `id`, `displayName`, `platformToken` (iOS token or Android package) |
| `SessionReward` | What a session paid | `coins`, `completionBonusCoins`, `xp`, `happinessDelta`, `healthDelta`, `leveledUpTo`, `stageReached` |
| `ShopItem` | Catalog entry (static) | `id`, `name`, `category`, `price`, `icon`, `happinessBonus`, `healthBonus`, `consumable`, `equipSlot`, `passiveBonus` |
| `InventoryItem` | An owned item | `itemId`, `quantity`, `acquiredAt`, `lastUsedAt` |
| `UserInventory` | All owned and equipped items | `items`, `equipped` (slot → item id) |
| `ShopListing` | `ShopItem` + `owned`, `quantity`, `equipped` | built by `getShopListings()` |
| `DailyStats` | Per-day totals | `focusMinutes`, `sessionsCompleted/Abandoned`, `coinsEarned`, `xpEarned` |
| `LifetimeStats` | Totals | `sessionsCompleted`, `totalFocusMinutes`, `lifetimeCoinsEarned`, `longestSessionMinutes` |
| `StreakState` | Streaks | `currentDays`, `bestDays`, `lastActiveDate`, `freezesAvailable`, `currentSessionStreak` |
| `GameSave` | **The whole persisted state**, one versioned document | `schemaVersion`, `profile`, `pet`, `wallet`, `inventory`, `focus`, `stats`, `streak`, `daily` |

Why derive level and stage instead of storing them: if the level curve is retuned, every existing
pet is re-levelled correctly from its XP, and the two can never disagree.

Why a single document: local persistence is one read and one write, schema migrations are one
function (`core/save/migrations.ts`), and cloud sync gets one unit to upload and merge.

## 6. Economy and progression formulas

All constants are in `src/config/economy.ts`, `progression.ts` and `petCare.ts`.

### Coins
```
completed:  (floor(min / 5) + 2 + floor(min / 15)) × coinMultiplier
abandoned:  floor((min / 5) × 0.5 × coinMultiplier)      (0 if under 5 focused minutes)
coinMultiplier = 1 + min(0.20, streakDays × 0.02) + itemCoinBonus (≤ 0.10)
```

### XP
```
completed:  min × 2 × 1.25 × longSessionTier × (1 + itemXpBonus)
            longSessionTier: ≥45 min 1.1, ≥60 min 1.2, ≥90 min 1.3
abandoned:  min × 2 × 0.5 × (1 + itemXpBonus)
```

| Session | Coins | XP |
|---|---|---|
| 15 min | 6 | 38 |
| 30 min | 10 | 75 |
| 45 min | 14 | 124 |
| 60 min | 18 | 180 |
| 60 min, broken at 20 min | 2 | 20 |

Prices run 5–80 coins, so an item costs roughly one to five good sessions.

### Levels (from lifetime XP)
```
XP to go from level L to L+1 = 50 + 25 × (L − 1)
L2 = 50, L3 = 125, L5 = 350, L10 = 1,350 (about 9 hours of focus)
```

### Growth stages (from lifetime XP, not calendar age)
| Stage | Lifetime XP | Roughly |
|---|---|---|
| Baby | 0 | |
| Young | 300 | 2 h of focus |
| Adult | 1,500 | 10 h |
| Evolved | 5,000 | 33 h |

### Care stats
- Completed session: happiness `+min(20, 0.35 × min)`, health `+min(10, 0.15 × min)`.
- Abandoned session: happiness −3. Health is never touched.
- Passive decay while away: happiness −1/h, health −0.5/h, **stopping at floors of 35 and 50**. A
  neglected pet gets sleepy, never sick.
- Petting: +1 happiness, 5-minute cooldown (the tap animation always plays).
- Food restores health and happiness; toys give happiness on a per-toy cooldown; new non-food items
  give a one-time happiness bump.

### Streaks (forgiving by design)
- Day streak: consecutive days with at least one completed session.
- Freezes cover missed days automatically. You start with 1, earn 1 per 7-day streak, and can hold
  at most 2.
- Abandoning resets only the *session* streak, never the day streak. The best streak is always
  kept.

## 7. Real Screen Time enforcement later

The game depends only on this interface (`src/services/screenTime/ScreenTimeService.ts`):

```ts
interface ScreenTimeService {
  kind: 'mock' | 'ios' | 'android';
  getAuthorization(): Promise<ScreenTimeAuthorization>;
  requestAuthorization(): Promise<ScreenTimeAuthorization>;
  selectTargets(current: BlockTarget[]): Promise<BlockTarget[]>;
  startBlocking(req: { sessionId; targets; endsAt }): Promise<void>;
  stopBlocking(sessionId: string): Promise<void>;
  subscribe(listener: (e: ScreenTimeEvent) => void): () => void; // 'violation' | 'blockingRevoked'
}
```

The store calls `startBlocking` and `stopBlocking`; `useGameLifecycle` turns a `violation` event
into `endFocus('abandoned')`. The economy, progression and UI code never know which implementation
is running. Replacing the mock means writing a new class and changing one line in
`services/index.ts`.

### iOS (FamilyControls / ManagedSettings / DeviceActivity, iOS 16+)
- **Authorization:** `AuthorizationCenter.shared.requestAuthorization(for: .individual)`. This needs
  the Family Controls entitlement, which Apple must approve for distribution.
- **Target selection:** SwiftUI `FamilyActivityPicker` returns opaque `ApplicationToken`s. We never
  learn app names, so the tokens are serialised into `BlockTarget.platformToken`.
- **Blocking:** `ManagedSettingsStore().shield.applications = tokens` when a session starts, cleared
  when it ends. A `DeviceActivitySchedule` ending at `endsAt` clears the shield even if the app is
  killed.
- **Violation detection:** iOS does not report "the user opened Instagram". Options: (a) a
  **Shield Action extension**. If the user taps a custom "Open anyway" button on the shield, the
  extension writes an event to a shared App Group, and the app reads it on the next launch or
  foreground and emits `violation`. (b) A `DeviceActivityMonitor` extension with a usage threshold
  event.
- **Packaging:** a local Expo Module (Swift) plus a config plugin that adds the entitlement, the App
  Group, and the Shield Action / Shield Configuration / DeviceActivityMonitor extension targets.

### Android
- **Detection:** `UsageStatsManager` (needs the special "Usage access" permission via
  `Settings.ACTION_USAGE_ACCESS_SETTINGS`), polled from a foreground service during a session to
  see the foreground package. An `AccessibilityService` gives instant window-change events but faces
  stricter Play Store review, so it should be optional.
- **Blocking:** when a blocked package comes to the foreground, show a full-screen "your pet is
  waiting" activity or overlay (`SYSTEM_ALERT_WINDOW`) and emit `violation` if the user chooses to
  continue.
- **Target selection:** list launchable apps via `PackageManager`; `platformToken` is the package
  name.
- **Packaging:** a local Expo Module (Kotlin) plus a config plugin for permissions and the
  foreground service declaration.

### What is cross-platform versus native
| Cross-platform (done in TS) | Platform-specific (future native modules) |
|---|---|
| Economy, XP, levels, stages, streaks | Permission and authorization flows |
| Pet care, inventory, shop | App pickers (iOS tokens, Android packages) |
| Session timing (wall-clock based, survives restarts) | Applying and removing shields or overlays |
| Persistence, migrations, UI, animations | Detecting violations while backgrounded |

### Integrity note
The app runs entirely on the device, so a determined user can cheat, for example by changing the
clock. That is acceptable for a self-motivation tool. If leaderboards or social features arrive,
the pure `core/` module can run server-side to validate submitted sessions.

## 8. Cloud sync later
`SaveRepository` is the seam. A `SyncingSaveRepository` can wrap the local one: write locally
first, then push the `GameSave` document to a backend. On conflict it can merge by rule
(max of monotonic counters such as `lifetimeXp` and `lifetimeCoinsEarned`, union of inventory,
latest-wins for settings). `profile.id` is already generated for that.

## 9. Focus loop (milestone 2)

- `core/game/gameEngine.ts`: `getActiveSessionProgress` (live timer and projection from
  timestamps), `previewAbandon` (what ending now would pay), and `endSession`, which now also
  returns a `SessionSummary`.
- `core/game/sessionSummary.ts`: `SessionSummary` holds before/after coins, XP and streaks for the
  completion animations, plus at most one `Celebration` (evolution > growth > level-up) and
  `completedWhileAway`.
- `core/game/debugTools.ts`: `debugPrimeXp` and `debugSetRemaining` for fast testing.
- Store: `lastSummary` is set whenever a session ends: by the timer, by ending early, by a
  Screen Time violation, or on launch for a session that ran out while the app was closed. The
  tabs layout watches it and opens the `/session-complete` modal. Closing that modal sets
  `pendingWelcome` so the pet screen greets the player once.
- The UI never recomputes rewards: the setup screen, countdown, confirmation and completion screen
  all read values that `core` produced.
