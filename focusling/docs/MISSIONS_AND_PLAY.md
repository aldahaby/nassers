# Missions and Calm Play

Missions are small daily study goals that pay bonus coins on top of focus rewards. Calm Play is two
short, optional mini-games with your pet. Both are student features; focus stays the main way the
pet grows.

## 1. Missions

Core: `src/core/missions/missionService.ts`. Config: `src/config/missions.ts`.
UI: `src/features/missions/` (Focus › Missions). Students manage their own missions.

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

1. **Created** (`addMission`, max 6 active) → shows in Focus and on the pet screen when scheduled today.
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
  that saves it. Reloading, restarting or re-running the same session can't pay
  again because the occurrence is already `rewarded`.
- The key includes the day, so a mission can't be paid twice for one day, and midnight can't
  "re-open" yesterday's occurrence.
- Tests: `missions.test.ts` (reload, midnight crossing, weekday, one-time, debug complete).

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

## 2. Calm Play

Two finite mini-games with your own pet: **Memory Garden** and **Toy Toss**. Routes in
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
  and reloads can't pay twice.
- Today's coins, happiness and per-game completions reset on a new calendar day.
- Balance tests: a 30-minute session pays at least 3× the best round, and the whole daily cap is no
  more than one 30-minute session.

## 3. Developer tools

Inside *Developer tools* (hidden and refused by the store when off): complete the current mission,
set it one step from done, simulate next day, reset today's missions, +3 play coins, play cap with
one coin left, reset daily play. The Play hub also shows its play shortcuts in dev mode.
