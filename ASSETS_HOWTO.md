# CITYBREAKER — how to change the font and add your own images

Two step-by-step guides, then a reference for every tuning number in the game.
Everything lives in one file: **`game.html`**. There is no build step. Edit, save, refresh.

---

# PART 1 — Change the font

The game currently uses **Luckiest Guy**, and it is *baked into the file* as text (base64). That
is why it looks the same on your iPhone as it does on my screen — there is nothing to download and
nothing to go wrong. It is the only typeface in the game: menus, HUD, numbers, buttons, everything.

To swap it for a different one, you have two options.

## Option A — just tell me the name (easiest)

Say *"use Bungee"* (or any font name) and I will do all of Option B for you in one go. I can reach
Google Fonts from here.

Chunky, classic fonts that suit this game:

| Font | Feel |
|---|---|
| **Luckiest Guy** | current — cartoon comic-book, rounded and chunky |
| **Archivo Black** | solid, neutral, very legible |
| **Bungee** | arcade signage, boxy, very chunky |
| **Alfa Slab One** | heavy slab serif, retro-poster |
| **Titan One** | bubbly, playful, thick outlines |
| **Passion One** | tall and condensed, punchy headlines |
| **Bowlby One SC** | very round and heavy, toy-like |

Browse more at **fonts.google.com** — filter by *Display*, sort by popularity. Any of them works.

## Option B — do it yourself

**Step 1.** Go to `https://fonts.google.com` and pick a font. Note the exact name, e.g. `Bungee`.

**Step 2.** Get the font file URL. In a terminal, replace `Bungee` with your font (spaces become
`+`, e.g. `Alfa+Slab+One`):

```
curl -A "Mozilla/5.0 Chrome/120" \
  "https://fonts.googleapis.com/css2?family=Bungee&display=swap" \
  | grep -o "https://[^)]*woff2"
```

You will get one or more URLs. **Take the LAST one** — that is the plain latin set.

**Step 3.** Download it and turn it into text:

```
curl -A "Mozilla/5.0 Chrome/120" -o myfont.woff2 "PASTE_THE_URL_HERE"
base64 -w0 myfont.woff2 > myfont.txt
```

`myfont.txt` now contains one very long line of letters and numbers.

**Step 4.** Open `game.html` and search for:

```
@font-face{ font-family:'CBDisplay';
```

You will find **one** block that looks like this:

```css
@font-face{ font-family:'CBDisplay'; font-style:normal; font-weight:100 900; font-display:block;
  unicode-range:U+0000-00FF,...;
  src:url(data:font/woff2;base64,d09GMgABAAAAA...THOUSANDS OF CHARACTERS...) format('woff2'); }
```

Select everything between `base64,` and `)` and replace it with the whole contents of
`myfont.txt`. Nothing else needs to change — both `--f-display` and `--f-num` already point at
this one face.

**Step 5.** Save and refresh. Done.

> ⚠️ **Do not change `font-weight:100 900`.** That line tells the browser "this one file covers
> every weight". Remove it and the browser will try to fake a bold and the letters will smear.

---

# PART 2 — Add your own PNG images

## The one thing I cannot do

When you attach an image to a chat message, it reaches me as a **picture I can look at**, not as a
**file I can save**. So I can describe it, match it, copy its style — but I cannot put it in the
game myself. You have to place the file. That is what this section is for.

## Step 1 — Prepare the image

- Format: **PNG**
- If it should have a see-through background (clouds, logos, effects) → it must have a real
  **transparent background**, not white.
- Size: ideally a power of two — `512×512`, `1024×512`, `1024×1024`. Not required, just sharper.
- Weight: keep it **under 400 KB** or the game gets slow to open on a phone.

Free tools: **remove.bg** to cut out a background, **squoosh.app** to shrink the file size.

## Step 2 — Put the file in the repo

**On a computer**

1. Open the repo folder.
2. Drop the file into the **`assets/`** folder.
3. Commit and push.

**On a phone, straight from GitHub**

1. Open `github.com/aldahaby/nassers` in a browser.
2. Tap into the **`assets`** folder.
3. Tap **Add file → Upload files**.
4. Choose your PNG, then **Commit changes**.

## Step 3 — Tell me the filename

Send me a message like:

> use `assets/cloud.png` for the clouds

That is genuinely all I need. I will wire it in and deploy.

## Where a PNG can go right now

| What you want to replace | Filename to use | Notes |
|---|---|---|
| Clouds in the sky | `assets/cloud.png` | needs transparency |
| A villain's menu portrait | `assets/prev_dominus.png` (etc.) | already a PNG — upload with the **same name** and it swaps automatically, no message needed |
| Tokyo shop signs | `assets/sign1.png`, `sign2.png` … | any number |
| A building wall | `assets/facade_tokyo.png` | tiles, so make the edges match |
| The game logo | `assets/logo.png` | replaces the text logo on the menu |

**Portraits are the special case** — those files already exist, so uploading one with the same name
replaces it instantly with no code change at all.

## If you cannot use GitHub

Convert the image to base64 (search "png to base64", or use any Shortcuts app on iOS), paste the
result to me, and I will write the file into `assets/` myself. Best for small images — big ones
make an enormous message.

---

# PART 3 — Every tuning number, in one place

All of these sit near the top of the `<script>` in `game.html`.

## Look and feel — every item is an on/off switch

```js
const BANK_ROLL = { group:0, model:0 };   // 0,0 = no lean at all. {1, 0.32} restores banking.

const LOOK = {
  richDebris:    true,  // chipped rubble shapes; false = plain grey cubes
  vignette:      true,  // dark corners
  grade:         true,  // saturation / contrast lift
  contactShadow: true,  // soft shadow on the ground under the villain
  softerFog:     true,  // horizon fades a touch sooner
  richerSun:     true,  // 2048 shadow map; false = 1024
};
```

## Gameplay pacing — shared by every map, which is what keeps them equal

```js
const PLAY = { laneLo:11, laneHi:16.5, wLo:8, wHi:11, tierVol:2200,
               xBox:22, hitDepth:8, gateMinGap:9 };
```

| Key | What it does |
|---|---|
| `xBox` | how far off centre you may fly |
| `hitDepth` | collision depth of a target, so a thin wall and a long train car are equally forgiving |
| `tierVol` | the volume every target reports, so score per smash is map-independent |
| `gateMinGap` | hard minimum rows between two gates, so they never bunch up |

Gate *cadence* is no longer a constant — it comes from `STAGES` below.

## Escalation — how a run progresses

```js
const STAGES = [
  { at:0,       gateEvery:14, shielded:false, label:'OPENING'    },
  { at:250000,  gateEvery:11, shielded:false, label:'PRESSURE'   },
  { at:1200000, gateEvery:10, shielded:true,  label:'SHIELDED'   },
  { at:3500000, gateEvery:8,  shielded:true,  label:'RELENTLESS' },
  { at:7500000, gateEvery:7,  shielded:true,  label:'CHAOS'      },
];
```

The run escalates on **your score inside a single life**, not on the clock, so a good run visibly
changes shape under you. Each stage is announced on screen as you reach it. Early on every gate is
a single armored tower; shielded rows only unlock at `SHIELDED`; drones only at `CHAOS`.

Add, remove or reorder stages freely — `at` is the only field that has to increase.

## Powers

```js
const PWR = {
  leadSec:3.0,     // SECONDS of window, before the per-kind multiplier
  minRange:150,    // never a shorter reach than this at low speed
  maxRange:560,    // never past the spawn horizon (city.aheadDist is 620)
  blastAfter:2,    // how many towers BEHIND the gate also go down (never another gate)
  blastRange:150,  // how far past the gate that follow-through reaches
  gateScore:3.0,   // score multiplier for clearing a gate with a power
  slamCost:62,     // momentum lost for body-slamming a gate instead
  kindRange:{ laser:0.85, split:0.95, nova:1.10, storm:1.25 },
};
```

**Reach is measured in seconds, not metres.** A fixed distance is a shrinking window — 210 m is
four seconds early in a run and barely one and a half at top speed, which is how a gate could
arrive with no time to answer it. Reach is `speed × leadSec × kindMul`, so the window is the same
length of time at 140 km/h and at 500 km/h.

| Kind | Window | Feel |
|---|---|---|
| `laser` | 2.55 s | a focused lance — the tightest window |
| `split` | 2.85 s | a scything cut |
| `nova` | 3.30 s | a blast, so it reaches further |
| `storm` | 3.75 s | lightning called down from above, the longest |

Measured in real play across all six villains: **every** gate approach gave at least **2.72 s**,
median 3.0 s. Asserted by `scripts/cape-and-window.mjs`.

**Pressing with nothing in range does not fire.** It plays a flat dud click and prints
`NO TARGET <n>m`, and the button is visibly dimmed (`.dead`) the whole time a press would do
nothing. A silent dead press is what made the power feel broken.

Powers work **only** on gates. No energy bar, no cooldown, no on-screen warnings. The only
challenge is pressing while the gate is inside `range`.

**Only a live EPIC or ETHEREAL window breaks a gate on contact.** ON FIRE and SURGE do not — they
are states you spend most of a good run in, and letting them through made gates pointless.

**The penalty for slamming one is meant to be brutal:** `slamCost` momentum off a 100 bar, the
whole streak wiped (including any epic/ethereal window), surge cancelled, adrenaline cut to a
third, and forward speed knocked to 45% with the speed floor suspended for 1.1 s so you feel the
wall. From a half-empty bar it ends the run.

**The power button has three states:** `POWER` (dim, nothing ahead), a metre countdown with a
filling bar (violet, a gate is on the way), and `FIRE` (gold, pulsing, full — the shot will land).

Per-character names, colours and kinds live in `POWERS`. Each villain has four, all selectable in
the Powers sheet; `POWERS[char][0]` is the default. Setting every `STAGES` `gateEvery` very high
turns the whole mechanic off without deleting any code.

Gate colours per map live in `GATE_LOOK`.

Reliability is asserted by **`scripts/power-reliability.mjs`** — 240 shots across every character,
map and power kind. Last run: 100% fire, 100% animation, 100% gate destroyed, 100% debris.

> Note for future edits: the gate schedule lives in four counters — `_rowN`, `_gateNext`,
> `_lastGateRow` and `_gateCount`. **They must all reset together.** `_rowN` used to reset alone
> while `_gateNext` kept climbing across runs, so after a handful of deaths the next gate was
> scheduled hundreds of rows away and gates stopped appearing at all.

## Drones

```js
const DRONES = {
  minScore:  7500000, // no drones at all below this — a Grandmaster-grade run, inside ONE life
  minDist:   2200,    // ...and not before this many metres
  minTime:   40,      // ...and not in the first 40s, whatever else happens
  rampScore: 4000000, // score span over which they ease to their normal cadence
  easeIn:    3.2,     // gap multiplier the moment they unlock (3.2x rarer than normal)
};
```

Drones are a **late** threat. The opening of every run is purely you against the city; they only
turn up once the run is genuinely going, and even then they ease in. **All three gates must be
passed** — score, distance and time — so a lucky early burst cannot summon them. Raise `minScore`
to switch them off entirely without deleting any code.

## The maps

| Key | Name | Look |
|---|---|---|
| `nyc` | Tokyo | Shibuya side street, real 3D signage |
| `aero` | Frutiger Aero | glass towers, bright sky, bubbles |
| `medieval` | Medieval | stone watch towers, cobbles, citadel |
| `metro` | Frutiger Metro | underground tunnel, train cars on the track |
| `backrooms` | The Backrooms | yellow carpet, drywall partitions, ceiling tiles |
| `inferno` | **Inferno** | black basalt splitting over a magma river, ash storming upward |
| `synth` | **Neon Void** | a black void ruled by a glowing grid; towers drawn only in light |

Adding a map is one `THEMES` entry, one `GATE_LOOK` entry, one `body.theme-<key>` CSS block and one
card in the maps sheet. Facade styles live in `_drawFacade` (`window`, `glass`, `stone`, `metro`,
`drywall`, `basalt`, `neon`) and road styles in `_roadTexture` (`jp`, `cobble`, `carpet`, `rails`,
`lava`, `grid`).

Difficulty parity is enforced by `PLAY`, so a new map is automatically in line with the rest.
Measured across nyc / metro / inferno / synth: score-per-minute spread **1.11×**, hits 1.03×,
distance 1.01×.

## Two buildings, and only two

On every map there are exactly **two** things you can fly at:

| | Looks like | Answer |
|---|---|---|
| **Normal tower** | one colour, one facade, no glowing rim — identical every time | fly through it |
| **Armored / shielded gate** | hazard body in the map's own palette, glowing frame, a **pulsing** glow and a glowing **capping rim** on its top edge | use a power, or a live EPIC / ETHEREAL |

Normal towers carry **no** random variation — no colour jitter, no texture offset — because "is
this one armored?" must be answerable at a glance, from the far end of the street. The decorative
skyline behind them still varies freely; it is backdrop, and you never fly at it.

A gate is always **taller than any normal target** on its map, and a shielded row's three blocks
are placed **flush** so it reads as one barrier rather than loose crates. The capping rim sits *on*
the top edge instead of floating above it — a detached cap looked like an unfinished prop, worst of
all on metro where a gate is short and wide.

Gate colours per map live in `GATE_LOOK`. The gate texture's tiling is baked **once**, at creation,
and shared by every gate. Never set `repeat` on it per building — every gate shares the object, so
that rewrites all of them at once, which is what used to make armored towers appear to morph as you
flew toward them.

Guarded by **`scripts/world-integrity.mjs`** — 240s of play per map, asserting that no normal tower
ever wears the gate texture, no gate ever wears a facade, the tiling never changes, there is
exactly one normal colour and one gate colour, and no drone arrives before its gates.

## Vibration (haptics)

```js
const HAPTIC = { tap:12, shard:8, smashLight:14, smashHeavy:26, smashHuge:[30,24,44],
                 combo:[10,30,10], fire:[22,40,22], epic:[34,40,20,40,52],
                 ethereal:[46,30,26,30,26,30,64], closeCall:[8,26,8],
                 power:[16,26,58], powerBig:[22,30,34,26,70], dud:[6,40,6],
                 gateBlock:[70,60,120], drone:[90,50,60,50,90], death:[140,70,220],
                 stage:[18,50,18,50,54], milestone:[12,36,12] };
```

A number is one buzz; an array alternates buzz / pause / buzz. Every meaningful event has its own
pattern, so the phone tells you what happened without you reading anything.

Two rules keep it from turning into a permanent hum: light events (`tap`, `shard`, `smashLight`,
`smashHeavy`, `closeCall`) are rate-limited to one every 90 ms, and heavy events to one every
40 ms. In a 120-second run that works out to about 50 buzzes — noticeable, never constant.

Toggle lives in **Settings → Vibration**, persisted as `invrun_haptic`.

## Four backends, picked automatically

| Mode | When | What you get | Reliable? |
|---|---|---|---|
| `native` | a native shell published a bridge | real haptics, mapped to real feedback styles | **yes** |
| `vibrate` | `navigator.vibrate` exists — Android / Chrome | the real pattern, real durations | **yes** |
| `ios` | iOS Safari, iOS 17.4+ | best effort, and usually nothing | no |
| `none` | neither | silent, and the row says so | no |

## iOS: read this before touching the haptics code

An iPhone obviously has a Taptic Engine. What it does not have is a way for a **web page** to
reach it:

- **Safari has never shipped `navigator.vibrate`** — not on any iPhone, not on any iOS version.
- **Add to Home Screen does not help.** A "web app" on iOS is the same WebKit under the same
  rules. There is no PWA escape hatch for this.
- The only hook that exists is the system tap played when an `<input type="checkbox" switch>` is
  toggled (iOS 17.4+). iOS plays it **only for a genuine finger-on-glass activation** — a
  script-driven `click()` is not user activation, so in-game events almost never fire it. It is
  left in because it costs nothing, but it must never be advertised as working. `Haptics.reliable`
  is `false` for this path and the settings row says *"iOS: Safari can't — works in the app build"*.

**On iOS, the app build is what makes haptics real.** That is what the `native` bridge is for.

## The native bridge

Publish **any one** of these before the page loads and the game uses it automatically — no change
to the game is needed:

```js
window.CBHaptics = { play(name, pattern) { /* ... */ } };          // any shell
window.webkit.messageHandlers.cbHaptic.postMessage({name, pattern}) // iOS WKWebView
window.CBAndroid.haptic(JSON.stringify({name, pattern}))            // Android JS interface
```

The message carries the **event name** as well as the pattern, e.g.:

```json
{ "name": "gateBlock", "pattern": [70, 60, 120] }
```

Use the name — a shell should map it onto a real feedback style rather than replaying a buzz
pattern, which is what makes native haptics feel better than vibration in the first place:

| Event | Suggested iOS feedback |
|---|---|
| `shard`, `tap` | `UISelectionFeedbackGenerator` |
| `smashLight` | `UIImpactFeedbackGenerator(style: .light)` |
| `smashHeavy`, `smashHuge` | `.medium` / `.heavy` |
| `gateBlock`, `drone`, `death` | `UINotificationFeedbackGenerator(.error)` |
| `epic`, `ethereal`, `stage` | `UINotificationFeedbackGenerator(.success)` |
| `power`, `powerBig` | `.rigid` / `.heavy` |

### Minimal iOS shell (WKWebView)

```swift
// 1. register the handler on the web view's config
config.userContentController.add(self, name: "cbHaptic")

// 2. play the mapped feedback
func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
    guard m.name == "cbHaptic",
          let body = m.body as? [String: Any],
          let name = body["name"] as? String else { return }
    switch name {
    case "shard", "tap":            UISelectionFeedbackGenerator().selectionChanged()
    case "smashLight":              UIImpactFeedbackGenerator(style: .light).impactOccurred()
    case "smashHeavy", "power":     UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    case "smashHuge", "powerBig":   UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
    case "gateBlock", "drone", "death":
                                    UINotificationFeedbackGenerator().notificationOccurred(.error)
    case "epic", "ethereal", "stage":
                                    UINotificationFeedbackGenerator().notificationOccurred(.success)
    default:                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}
```

With Capacitor, the same thing is a few lines on top of `@capacitor/haptics` — define
`window.CBHaptics.play` and call `Haptics.impact({ style })`.

## Per-map typefaces

Every world speaks in its own voice. All seven faces are embedded as base64 for the same reason the
display face is — identical on every device, nothing to download, nothing to fail — and are
switched on `body.theme-<key>`, so the menu, every sheet, the HUD, the buttons and the results
screen change together.

| Map | Face | Why |
|---|---|---|
| Tokyo | **Bungee** | arcade signage, pure Shibuya |
| Frutiger Aero | **Fredoka** | bubbly and round, 2000s glossy |
| Medieval | **MedievalSharp** | carved, hand-cut blackletter |
| Frutiger Metro | **Rajdhani** | clean squared tech, Metro design |
| The Backrooms | **Special Elite** | battered institutional typewriter |
| Inferno | **Rubik Mono One** | heavy molten slab |
| Neon Void | **Audiowide** | retro-futurist chrome |

To swap one: fetch its woff2 (Part 1 has the commands), then replace the base64 inside the matching
`@font-face{ font-family:'CB<key>' … }` block. Nothing else needs to change.

**The wordmark fits itself.** These faces are nowhere near the same width — Audiowide is far wider
than Titan One at the same size — so a font-size tuned for one clips CITY / BREAKER on another.
`Game.fitText` measures the headline and shrinks it until it fits, rather than carrying a per-font
fudge factor that the next font would break. It re-runs when the map changes, when fonts finish
loading, and on resize or rotation.

Guarded by **`scripts/theme-fonts.mjs`** (the swap reaches every surface, and the face really
renders) and **`scripts/wordmark-fit.mjs`** (nothing clips on any map at 360, 412 or 430 wide).

## What each map is, and the detail that belongs to it

Roadside props are six "kinds" per map, rebuilt on every map change in `_skinProps`, keyed on
`theme.building.style`. **A style with no branch falls through to the next one** — Inferno and Neon
Void were silently inheriting Frutiger Metro's subway benches and catenary pylons until each got
its own branch.

| Map | Era / trend | What belongs there |
|---|---|---|
| **Frutiger Aero** | c.2004–2013, Vista/Zune-era optimism | gloss, translucency, aqua and lime, water pressed against clean tech: glass towers with fountain jets, waterfalls into lit basins, flower beds on grass mounds, bubble clusters, a wind turbine, a glass pergola over a mirror pool. Nothing matte, nothing weathered. |
| **Medieval** | high medieval, c.1100–1400 | stone, rough timber, thatch, iron, wool, fire: watchtower with pennant, well with windlass and bucket, loaded market stall, windmill with cloth sails, wall run with an iron brazier, farm corner with cart, hay and firewood. One machined edge and the street stops reading as the period. |
| **Frutiger Metro** | c.2010–2015 Metro/Modern UI | flat blocks of saturated colour, hard edges, no gloss or bevel — the deliberate anti-skeuomorphism that followed Aero. Tiled walls, platform edge with tactile strip, signal masts and conduit, stairs, ad lightboxes, service cabinets. Heights stay low: there is a tunnel ceiling. |
| **Inferno** | live volcanic fissure | basalt columns with hexagonal jointing, crusted lava pools, obsidian spires, charred dead trees, steam vents, heat-veined rubble. Nothing intact and nothing living — "nothing survives here" is the read. |
| **Neon Void** | 1980s synthwave | everything drawn in light, as a vector display: neon arches, chrome palms, wireframe pyramids, grid pylons with laser cross-beams, floating chrome spheres. Nothing textured or naturalistic. |

Tokyo and The Backrooms are deliberately untouched.

**The horizon belongs to the map too.** `theme.horizon` sets the distant ridge — `{day, night,
wire, glow, glowI}`. One grey-green ridge behind a volcano or a laser grid is the most out-of-place
thing possible, because it is the largest thing on screen.

Inspect any map's props with **`scripts/map-detail.mjs`** — it renders all six kinds side by side
under that map's own lighting, which is the only practical way to judge them.

### Three traps worth remembering

- **`metalness:1` with no environment map renders solid black.** There is nothing to reflect. Every
  "chrome" prop was a black silhouette until it was faked with a bright base plus a little emissive.
- **A blade box centred on its hub extends both ways**, so three turbine blades drew six spokes.
  Offset it outward before rotating.
- **Props are seen at a grazing angle**, angled ~29° toward the road. Anything with one printed face
  is a black slab from the other side — Metro's lit panels are doubled onto both faces.

## Motion

One transition language, defined once as CSS variables and pulled in by everything:

```css
--ui-in:  cubic-bezier(.16,1.06,.32,1.28);   /* opens with a small overshoot */
--ui-out: cubic-bezier(.5,0,.78,.2);         /* closes fast, no hang */
--t-open: .34s;  --t-shut: .22s;
```

- **Sheets** rise and overshoot slightly on open (`sheetIn`); on close they drop *away* from you
  (`sheetOut`) rather than replaying the entrance backwards, which reads as an undo instead of a
  dismissal. `shutM` plays the exit and only then takes the sheet out of the layout — hiding it
  outright would cut the animation off. Re-opening mid-close cancels the pending hide.
- **Buttons** scale down on contact and spring back, on the same curves.
- **PLAY** dissolves the menu: the panel fades and its blur clears, the rows drop away, and the
  button itself rushes at you as the world opens. The run starts 300 ms in, under the dissolve.

The start menu is a **translucent pane over the live city**, not a solid screen — the world is
already running behind it, which is what makes PLAY feel like being let through rather than
loading something. The HUD and joystick fade out under the menu and fade back up as it lifts, so
the controls arrive with the world. `body.at-menu` drives that.

Guarded by **`scripts/transitions.mjs`**, which asserts on the class *sequence* rather than
sampling at fixed times — under software GL the page runs at ~1.5 fps and any wall-clock sample
races the renderer.

## The villain's aura colours the whole screen

The aura is the villain's identity, so every state colour comes from it — the screen-edge glow, the
combo readout, the score pops, the epic teardown flash. `applyAuraUI(key)` publishes the equipped
villain's two colours as `--aura-epic` / `--aura-eth` (plus `-rgb` variants for `rgba()`), lifted
through `auraCol` so a near-black aura still reads as a tint.

Before this they were hardcoded gold and purple, which meant Voidstrike's violet aura sat inside an
orange screen.

Two things worth knowing if you touch it:

- The screen glow lives on **`#state-glow`**, not `#vignette`. Those two shared an id, so
  `getElementById` handed the game the static LOOK vignette and the glow was painted on the wrong
  layer.
- `UISystem.update` rewrites the glow every frame, so anything setting it from outside the loop
  gets overwritten on the next frame.

## Keeping the menu cheap

The start menu had a `backdrop-filter: blur()` over the live WebGL canvas. That is the most
expensive thing a full-screen overlay can do, it is flaky on iOS, and together with a second frozen
JPEG background layer it was why the background sometimes came up wrong. Both are gone — a painted
scrim does the legibility job for free. `snapMenuBg` is now a no-op: it used to force a render, read
the canvas back and base64-encode it, for a layer that is no longer drawn.

Measured effect under software GL: **36 frames in the same window where the blurred version managed
24**.

Guarded by **`scripts/menu-and-aura.mjs`**, which also asserts every sheet's ✕ actually closes it.

## Testing it on a phone

Open **`haptics-test.html`** on the device — deployed alongside the game, so on a phone it is
`<site>/game/haptics-test.html`. It reports what the browser exposes, then gives six things to
tap:

| | Test | What it proves |
|---|---|---|
| 2 | Vibration API | works on Android; does nothing on iPhone, as expected |
| 3 | flip the switch **with a finger** | whether this iPhone / iOS build can play the tap at all |
| 4 | flip the same switch **from code** | whether a script-driven event can play it — this is what the game needs for a smash |
| 5 | flip it **inside a finger press** | the case the game's FIRE / SURGE buttons use |

If 3 buzzes and 4 does not, that is the whole iOS limitation in one screen.

## iOS Safari: tested, and the answer is nothing

Run on a real **iPhone 14**, current iOS: **no test produced any haptic.** Not the Vibration API
(absent), not a scheduled switch tap, and not even the switch flipped **directly by a finger**.

So iOS Safari is no longer reported as `supported`. The Vibration row is disabled and reads
*"(Safari can't — app version only)"*, because a toggle sitting on ON while the phone stays silent
is worse than no toggle. `Haptics.gesture()` still attempts the tap from inside a real touch — it
costs nothing and does work on some builds — but nothing is promised.

**On iOS the app build is the only way.** See `app/`.

## Capacitor is detected automatically

Wrapping the game in Capacitor with `@capacitor/haptics` needs **no change to `game.html`**.
`Haptics._initNative` finds `window.Capacitor.Plugins.Haptics` by itself and maps each event onto a
real feedback style:

| Event | Feedback |
|---|---|
| `shard`, `tap`, `smashLight`, `closeCall` | impact **light** |
| `smashHeavy`, `power`, `combo`, `milestone` | impact **medium** |
| `smashHuge`, `powerBig` | impact **heavy** |
| `gateBlock`, `drone`, `death` | notification **error** |
| `fire`, `epic`, `ethereal`, `stage` | notification **success** |

`app/` holds the scaffold: `cd app && npm install && npx cap add ios && npm run ios`. Its README
covers what you need (a Mac, Xcode, an Apple ID) and how to confirm it worked.

Asserted by **`scripts/haptics.mjs`** — runs the game with six platforms emulated (three native
shell shapes, Android, iOS Safari, and a bare browser) and checks the right backend is chosen,
that heavy events out-fire light ones, that OFF is absolute, that reliability is reported
honestly, that iOS Safari is never sold as working, and that a genuinely working backend shows no
caveat.

## Shard boost

```js
const BOOST = { mult:2, hours:4, everyRuns:3, cooldownH:6 };
```

Offered on the results screen every `everyRuns` runs. Accept and shards count `mult`× for `hours`
hours. While it is live the prompt never appears again; after a decline it waits `cooldownH` hours.
Stacks with the separate first-three-runs-of-the-day daily multiplier.


---

# PART 4 — Missions

Four goals a day, drawn from a twelve-entry pool, each at one of three tiers. They are meant to be
**hard** — a mission is a reason to get better, not a participation tick.

| Goal | Tiers |
|---|---|
| Smash N buildings in one run | 260 / 420 / 650 |
| Fly N m in one run | 20k / 34k / 55k |
| Reach a xN combo | 80 / 130 / 190 |
| Collect N shards in one run | 300 / 500 / 780 |
| Score N in one run | 1.2M / 3.5M / 7.5M |
| Break N armored gates in one run | 12 / 22 / 36 |
| Clear N gates with a power, no slams | 10 / 18 / 30 |
| Smash N in a row without a miss | 60 / 95 / 140 |
| Enter EPIC N times in one run | 4 / 7 / 11 |
| Reach ETHEREAL N times in one run | 2 / 4 / 7 |
| Get N close calls in one run | 25 / 45 / 70 |
| Reach escalation stage N in one run | 3 / 4 / 5 |

The bottom seven demand the mechanics the game is actually about, so they cannot be reached by
simply surviving. **"No slams" is literal**: body-slamming a single gate resets that run's power
counter to zero.

Per-run tallies live in `ScoreSystem.st` and are handed to `missions.onRunEnd` at the results
screen. To add a goal: add a row to `POOL` with an `id`, then `score.tally('<id>')` wherever the
event happens.

---

# PART 5 — Impact

What makes a hit land, in order of how much you feel it:

| | Hitstop | Camera punch | Shake | Haptic |
|---|---|---|---|---|
| Ordinary smash | — | 0.22 + tier | tier | light / heavy |
| Power clears a gate | 70–105 ms | 0.9–1.3 | 0.9–1.15 | `power` / `powerBig` |
| Body-slam a gate | 150 ms | 1.6 | 1.5 | `gateBlock` |

`player.punch(n)` is a sharp recoil that decays about three times faster than the smash pulse and
kicks the camera's FOV out by `punch * 7` degrees. `time.hitstop(ms)` is a hard freeze-frame, not
an ease — it snaps back instantly so it reads as weight rather than slow motion.


---

# PART 6 — Capes and wings

Every villain is **one mesh, one material, no bones**. There is no cape object to animate, and the
models are open double-sided shells, so nothing can be worked out from the geometry — there are no
back faces to measure thickness against and the shells are too fragmented for boundary loops.

So the cloth is **declared**, per character, in the model's own local space:

```js
flow:[ { a:'z', d:-1, from:0.22, to:0.98, box:{ y:[-0.55,1] } },   // cape, ramping backward
       { a:'y', d:-1, from:-0.20, to:0.86, box:{ z:[-1,-0.26], y:[-0.66,1] } } ]  // ...and down to the hem
```

| Field | Meaning |
|---|---|
| `a` | which local axis the cloth extends along — `x`, `y` or `z` |
| `d` | which way: `-1`, `1`, or **`0` for symmetric** (a pair of wings) |
| `from`, `to` | the ramp, in normalised bbox units — `0` is the centre, `1` the edge |
| `box` | optional hard bounds, same units, to keep limbs out |

Weight is **0** at `from` and **1** at `to`, so the seam is pinned and only the free edge flies.
Anything outside every region is exactly zero and *cannot* move. That is the whole design: the
previous version guessed with a single threshold on an axis that, for most characters, pointed at
an arm or a leg instead of the cape.

Two ramps are usually needed for a hanging cape — backward off the shoulders **and** downward to
the hem — or the hem stays pinned while the middle of the cape flaps. The `y` bound on the
downward ramp is what keeps a trailing **boot** out of it.

Current regions: Dominus and The Patriot — cape behind and below. Frutiger Villain — trailing
ribbons. Evil Knight — both wings (symmetric on `x`) plus the robe hem. The Entity — tattered
shreds trailing on `z`. Violet Voidstrike — hair and ribbons on the upper trailing half, with a `y`
floor separating them from her boots.

## Checking a change

`scripts/cape-and-window.mjs` guards that the weights exist and the shader is live on every
character. To actually *see* the mask, render the model with `aFlow` as vertex colour — grey is
pinned, yellow moves. That is how each region above was set, and it is the check to repeat if a
model is ever replaced.

The wind itself is applied along the model's own local axes, derived by carrying world "behind /
up / sideways" back through each character's `rotX` and `yaw`. Phase advances with **flight
speed**, so the faster you go the harder the air pushes and the tighter the ripple.
