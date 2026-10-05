# Family Mode, Missions and Calm Play

Milestone 5. Everything here is **local to one device**. There is no account, server, sync,
analytics SDK, advertising or remote tracking.

> **Any future cloud version of Family Mode (parent and child on different devices, remote
> settings, shared progress) needs its own privacy, security and legal review before any work
> starts.** Children's data rules (COPPA, GDPR-K, the Age Appropriate Design Code and app store
> kids policies) apply the moment child-related data leaves the device.

## 1. Modes

The first onboarding question is **"Who is Focusling for?"**

| Choice | Mode | What happens |
|---|---|---|
| For me (offered first): "I want help spending less time scrolling." | `self` | The single-user app (Pet, Focus, Shop, Play, Settings tabs). Missions open from Focus; the active mission also shows on the pet screen. |
| For my child (smaller second option): "Set up Family Mode with a parent PIN on this device." | `family` | Parent setup, then the device is handed to the child in **Child View**. |

`GameSave.mode` stores the choice. Saves from before this milestone migrate to `mode: 'self'` with
their onboarding already complete, so existing users never see the question (schema v3 → v4, see
`src/core/save/migrations.ts` and `familyCore.test.ts`).

### Family setup flow

For my child → explanation ("You set the boundaries. Their Focusling turns healthy screen habits into
pet progress and rewards.") → create parent PIN (entered twice) → child nickname → choose and name a
pet (the regular onboarding screens) → choose a first mission (or skip) → Child View.

Onboarding is completed only at the last step (`finishFamilySetup`), so quitting half-way resumes
setup rather than dropping a child into an unconfigured app.

## 2. Parent View vs Child View

| | Child View | Parent View |
|---|---|---|
| Routes | `src/app/(child)/` tabs: Pet, Missions, Play, Shop (+ hidden Focus) | `src/app/parent/`: Dashboard, Missions, Settings; plus `/protection` |
| Can | Focus, play the two games, shop, use items, see missions | Configure missions, play access, protection, nickname, PIN, developer tools, reset |
| Can't | Change settings, protection, missions; see stats or settings tabs | (n/a) |
| Leaving | Only through the **Parent Gate** | "Child View" button |

Which view is showing (`familyView`) is **in-memory only**. Every app start, reload or crash opens
Child View, so the PIN is needed again. Layouts guard the routes: `(child)` redirects to `/parent`
only when unlocked; `parent/_layout.tsx` redirects to `/parent-gate` when locked, so typing a URL on
web doesn't skip the gate. The protection screen redirects Child View back to the pet.

### Parent Dashboard

`src/app/parent/index.tsx`. Two columns at ≥ 768 pt (iPad portrait and up), one column on phones.

- **Today:** focus minutes, successful sessions, missions completed, coins from healthy habits
  (focus + mission coins), and play coins against the daily cap.
- **Current mission:** name, goal, progress, reward, schedule/window.
- **Protection:** the configured rule and an honest state from `describeProtection`:
  `off`, `configured` (set up, waits for a session and native confirmation), `simulated` (web or no
  native module: nothing is blocked), `active` (native status confirms protection for the running
  session) or `unavailable`. It never says "active" without native confirmation.
- **Child:** nickname, pet, stage, level.
- **Actions:** Missions, Protection, Parent settings, Child View.

## 3. Parent Gate

`src/core/family/parentGate.ts`, `src/app/parent-gate.tsx`, config in `src/config/family.ts`.

- 4-digit PIN. Stored as `{ salt, hash, iterations }`: a random 16-byte salt and 2,000 rounds of
  SHA-256 over `salt:pin` (pure-TS SHA-256 in `src/core/shared/sha256.ts`, checked against the
  standard test vectors). The digits are never stored; tests assert the save JSON doesn't contain
  them.
- Throttling: 5 free attempts, then a 30 s pause that doubles per further wrong attempt, capped at
  5 minutes. Failed attempts and the pause are saved, so restarting the app doesn't reset them.
- Changing the PIN (Parent settings) needs the current PIN.

**Limits, stated plainly.** A 4-digit PIN on a device the child holds keeps curious hands out of
settings; it is not OS-level security. Anyone with the device's file system (a jailbroken phone, a
desktop browser's dev tools on web) can edit local data, and the 10,000-PIN space is small once the
throttle is bypassed that way. We don't claim otherwise in the UI.

**Stronger device auth later.** The gate is one function (`unlockParentView`) so it can be swapped
or layered: device owner authentication (`expo-local-authentication`: Face ID / Touch ID / device
passcode), Keychain-backed storage for the gate record, and, for real restrictions, Apple's
FamilyControls `.child` authorization with Screen Time's own parent passcode. A forgotten PIN has
no in-app recovery yet; the future device-auth path is the intended recovery route.

**Developer Mode.** With *Developer tools* on (a parent setting), the gate shows "Enter Parent View
(developer)", and Developer tools can reset the PIN. When Developer tools are off, neither button
renders, **and the store refuses these actions** (`devOnly` in `createGameStore.ts`, covered by
`familyStore.test.ts`). The developer toggle itself lives only in Settings (self) or Parent settings
(family), behind the gate.

## 4. What is stored, and what is not

Stored locally (AsyncStorage on device, `localStorage` on web), in the single versioned save:

- the child's **nickname** (≤ 16 characters; setup copy says a nickname is enough);
- pet, coins, items, XP and the aggregate daily/lifetime focus numbers the app already kept;
- missions and their per-day progress (14 days kept, then dropped);
- parent settings: play access, the PIN record, protection settings;
- today's play totals and recent round IDs (for duplicate protection).

**Not collected, and there is no code to collect it:** real name, date of birth, age, school,
address, location, contacts, photos, messages, browsing history, screenshots, per-app usage
timelines, content the child views, or any activity log beyond the daily totals above. Family Mode
doesn't monitor the child; it rewards finished focus sessions. The dashboard footnote says so.

## 5. Future pairing boundary

Parent and child on separate devices would need, at minimum: accounts or a pairing protocol, an
authenticated channel, server-side storage of child-related data, consent flows, data deletion,
and a new threat model (account takeover, a compromised parent device). That is a different
product with legal obligations, hence the review requirement at the top. The current code keeps the
seam narrow: family state is `GameSave.family` + `GameSave.missions`, and every change goes through
store actions, which a future sync layer could observe. No network code exists today.

---

## 6. Missions

Core: `src/core/missions/missionService.ts`. Config: `src/config/missions.ts`.
UI: `src/features/missions/`. Used in both modes (self users manage their own missions).

### Types

| Type | Goal | Counts |
|---|---|---|
| `focusMinutes` | N focus minutes in the day (5–240) | Minutes of each **completed** session |
| `sessionCount` | N completed sessions (1–6), optionally each ≥ M minutes | 1 per qualifying completed session |
| `scheduledFocus` | One completed session of ≥ N minutes (5–120) that starts and ends inside a time window | 1 (goal = 1) |
| `avoidSurface` | e.g. "no short videos after 9 PM" | **Not available.** Needs native protection telemetry; shown as "Not available yet", can't be created or completed |

Abandoned sessions never count. A session is attributed to the calendar day it **ended**
(a session finishing at 12:10 AM counts for the new day).

### Presets

Homework Buddy (45 focus minutes, daily, medium) · Morning Start (15-min session 6–9 AM, weekdays,
small) · After-School Focus (30-min session 4–7 PM, weekdays, medium) · Dinner Time (30-min session
6–8 PM, daily, small) · Deep Focus (one 60-min session, daily, big) · Wind Down (avoid short videos
after 9 PM, **unavailable**). Custom missions use the same editor: name, type, goal stepper, window
(hour steppers), repeat (every day / selected days / one time), reward size.

### Model and lifecycle

`Mission { id, title, description?, type, target, minSessionMinutes?, window?, recurrence, rewardCoins, rewardXp, rewardHappiness, active, createdAt, presetId? }`

Progress lives separately, per **occurrence**: `progress["<missionId>:<occurrence>"]`, where the
occurrence is `"once"` for one-time missions or the day's `DateKey`. Each entry has
`progress`, `completedAt` and `rewarded`.

1. **Created** (`addMission`, max 6 active) → shows on the pet screen/dashboard when scheduled today.
2. **Progress** is added only inside `endSession` (completed sessions), via
   `applySessionToMissions`, in the same state transition as the focus reward.
3. **Complete**: when progress reaches the goal, `rewarded` flips to `true` and the reward is paid
   in that same pure update. A new day is a new occurrence key, so daily missions reset by
   construction; nothing runs at midnight.
4. **Missed**: nothing happens. No penalty, no streak loss, no sad pet. Copy is neutral: "Missions
   reset each day. If one doesn't happen, that's okay: tomorrow is a fresh start."
5. **Paused / edited / removed**: pausing keeps progress; editing keeps today's progress and never
   un-completes an occurrence that was already paid; removing drops its progress.

### Double-grant protection

- The reward is paid only on the transition to `rewarded: true`, inside the same immutable update
  that saves it. Reloading, restarting, switching views or re-running the same session can't pay
  again because the occurrence is already `rewarded`.
- The key includes the day, so a mission can't be paid twice for one day, and midnight can't
  "re-open" yesterday's occurrence.
- Tests: `missions.test.ts` (reload, midnight crossing, weekday, one-time, debug complete),
  `familyStore.test.ts` (end-to-end through the store and a simulated restart).

### Rewards

Fixed tiers (`MISSION_REWARD_LEVELS`): small 5 coins / 15 XP, medium 10 / 25, big 15 / 40, plus
2–4 happiness. They **supplement** focus: a 30-minute session already pays about 10 coins and 75 XP,
and `balance.test.ts` keeps the biggest mission below an hour of focus. The celebration is calm:
a green line on the session summary ("Homework Buddy complete! +10 coins +25 XP") and the pet's
usual happy hop. Confetti and full-screen celebrations stay reserved for level-ups, growth and
evolution (mission XP does count toward those).

### Future native mission types

`avoidSurface` is modelled so a later build can verify it from native protection events (e.g. no
Reels detected in a window). Rules for adding it: only count what the native layer confirms, keep
it unavailable on platforms that can't confirm it, and never infer success from the absence of
data.

---

## 7. Calm Play

Two finite mini-games using the child's actual pet: **Memory Garden** and **Toy Toss**. Routes in
`src/app/games/`, rules in `src/core/play/`, economy in `src/config/play.ts`.

### Calm Play design rule

> A Focusling game must be finite, slow, quiet and optional. It ends on its own in 1–3 minutes,
> never measures speed, never speeds up, never hides a prize, and never asks for "one more".

What that rules out, always:

- **No endless gameplay.** Every round has a fixed end.
- **No loot boxes** or random prizes.
- **No ad-driven loops.** There are no ads, rewarded videos or "watch to continue".
- **No escalating speed** or difficulty ramps inside a round.
- **No reward farming.** Rounds pay small fixed amounts, each round pays once, and play coins stop at
  the daily cap.
- **Daily coin cap** (10 by default, `PLAY_ECONOMY.dailyCoinCap`).
- **Focus remains the main progression source.** One 30-minute session is worth more than a whole
  day of capped play (enforced by `balance.test.ts`).

Concretely:

- **Finite:** Memory Garden ends when 4 pairs are found; Toy Toss is exactly 5 tosses.
- **No timers or speed scoring.** Toy Toss's toy moves at one constant speed for the whole round.
- **No loot boxes, random prizes, streak pressure or countdowns.** Rewards are fixed and shown
  before playing.
- **Equal exits:** the summary's "Play again" and "Back to {pet}" are the same size and style; a
  ✕ is always visible during play.
- **Reduce Motion:** the pet stops its idle bob and reacts with a face change and fading hearts
  instead of hops (`AnimatedPet`, app-wide); Toy Toss's toss arc is skipped. The toy's slow lateral
  glide stays because it is the game.
- **Accessible:** big targets (cards ≥ 60 pt on a 320 pt phone), every card announces
  "face down" / "{item}, face up" / "{item}, matched", toss results are text, not colour.

### Memory Garden

8 cards (4 pairs of shop-item art), no timer. A mismatched pair stays up for 0.9 s. Each pair makes
the pet cheer. Finishing pays **+2 coins, +1 happiness**.

### Toy Toss

5 tosses. Tap **Toss** when the ball is near the pet (a soft catch zone is drawn). Catch quality is
judged from the same clock that draws the marker. Coins by catches: 0–1 → 1, 2–3 → 2, 4–5 → 3;
+1 happiness. The summary says how many the pet caught.

### Economy

- **Daily play-coin cap: 10** (`PLAY_ECONOMY.dailyCoinCap`). After it: "You've earned today's 10
  play coins. You can still play with {pet}." Games stay playable.
- **Daily play happiness cap: 4.**
- Rounds are idempotent: each has a round ID; a paid ID is remembered (last 50), so double taps,
  reloads and view switches can't pay twice.
- Today's coins, happiness and per-game completions reset on a new calendar day.
- Balance tests: a 30-minute session pays at least 3× the best round, and the whole daily cap is no
  more than one 30-minute session.

### Parent play setting

Parent settings → Play: **Always available**, or **After completing a mission** ("Finish today's
mission to play with {pet}."). Completing any mission unlocks Play for the rest of that day. When
locked, the core also refuses to pay for a round, not just the UI.

---

## 8. Developer tools added

All inside *Developer tools* (hidden and refused by the store when off): switch Self/Family, enter
Parent View / Child View, reset parent PIN, complete the current mission, set it one step from
done, simulate next day, reset today's missions, +3 play coins, play cap with one coin left, reset
daily play, unlock Play for today. The Play hub shows its own play shortcuts in dev mode because
Child View has no settings screen. All earlier tools are unchanged.
