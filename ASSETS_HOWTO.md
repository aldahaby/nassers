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
  blastAfter:1,    // how many towers BEHIND the gate also go down (never another gate)
  blastRange:150,  // how far past the gate that follow-through reaches
  gateScore:3.0,   // score multiplier for clearing a gate with a power
  slamCost:62,     // momentum lost for body-slamming a gate instead
  kindRange:{ laser:0.85, split:0.95, nova:1.10, storm:1.25 },
};
```

**A power takes two buildings: the gate, and one tower behind it.** `blastAfter` was 2, and a
single shot cleared most of a street — the run stopped being about flying and became about waiting
for the meter. At 1 the follow-through still reads as a power (the beam visibly does not stop at
the gate) without erasing the road ahead. A gate can be several blocks wide; every block sharing
its `gid` goes together and counts as the one gate. The beam never swallows the *next* gate, at any
setting.

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

## Two ways to steer

**Settings → Controls** flips between them, and the choice is persisted in `invrun_scheme`.

| | |
|---|---|
| **JOYSTICK** (default) | the on-screen stick in the bottom-left. Familiar, and your thumb has a home. |
| **DRAG** | put a finger anywhere on the playfield and the villain follows it left and right. `#joy-base` disappears entirely. |

**The two schemes are different kinds of control, and that is the whole point.**

The joystick is a **velocity** control: hold it over and he keeps sliding until you let go.

Drag is a **position** control: he goes where your finger has dragged to, and **stops when your
finger stops**. The first version fed the finger offset into the same velocity channel as the
joystick, which meant an off-centre thumb kept accelerating him sideways — it felt like ice, and it
was the single thing that made the scheme unusable.

Steering also happens **after** the forward step now, against the road centre where he has just
arrived. Doing it the other way round anchors the target one frame behind the road.

```js
// InputSystem: the finger's travel since it landed, plus a sequence number per new touch
dragPx, dragSeq, dragActive
dragWorldPerPx()   // 60% of the screen width == the full playfield, times moveSens

// FlightPlayer: anchor on a new touch, then follow, capped
if(input.dragSeq!==this._dragSeq){ this._dragSeq=input.dragSeq; this._dragBase=this.pos.x-roadCentre; }
const want=clamp(this._dragBase + input.dragPx*input.dragWorldPerPx(), -PLAY.xBox, PLAY.xBox);
const step=clamp((roadCentre+want-this.pos.x)*Math.min(1,18*dt), -STRAFE*dt, STRAFE*dt);
```

Four properties that all matter:

- **Relative anchoring.** The origin is wherever the finger landed, so grabbing the screen never
  snaps him sideways.
- **Lifting leaves him where he is.** Recentring on release would yank him across the road every
  time you tap FIRE.
- **A speed cap, kept out of the way.** `STRAFE` bounds the step so a flick cannot teleport him
  through a tower — but at `1.55×` a *normal* swipe was hitting it, and a clamped spring is a
  constant-speed slide. That is the "stiff after a certain point" feel. At `2.9×` the spring stays
  in charge of everything but a flick.
- **The road carries him.** `pos.x += rc - prevRc` before the damped step. Without it the follow has
  to chase the curve *as well as* the finger and always trails it by about two frames of road
  movement — the lane you picked slides out from under you on every bend.
- **The direction is checked in SCREEN space.** World `+X` is screen *left* under this camera, so a
  world-space test passes happily on an inverted control — which is exactly how drag first shipped,
  backwards. `scripts/controls.mjs` projects him through the camera and checks the pixels.
- **The motion is a critically damped spring**, not a per-frame lerp toward the target. A lerp
  starts at full speed and decays; there is no acceleration in it at all, which is the stepped,
  robotic feel. A spring carries velocity between frames, so he leans into the move and settles out
  of it, and it still cannot overshoot.
- **The velocity channel stays empty.** `sample()` adds `this.joy` only in stick mode, and
  `setScheme` clears both plus any live touch id — a stale joystick value left at 1 would otherwise
  steer forever after a switch.

Drag ignores anything inside `#btn-power, #btn-boost, #joy-base, #pause-btn, .modal, .overlay,
button, input`, so pressing FIRE is never also a swipe.

**Sensitivity means two different things**, so the Settings row renames itself: **Steer Speed** on
the joystick (how fast he strafes) and **Swipe Distance** on drag (how far he travels per swipe).
It is applied in exactly one place per scheme — in `STRAFE` for the stick, in `dragWorldPerPx` for
drag — never both. The slider runs 0.6×–2.2× and names each stop (*slow · normal · fast · very
fast · twitchy*), because a bare multiplier tells nobody anything.

Guarded by **`scripts/controls.mjs`**, which also holds the blast radius to one extra tower.

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

### Nobody is home

The menu shows the city streaming past exactly as it does in play — same speed, same camera, same
lighting — but **with no villain in it**. He arrives when you press PLAY. `FlightPlayer.setMenuMode(on)`
does it, and it has to hide more than the model: the rig, the contact shadow, the fire aura, the
cape, every speed streak and every live ember. Miss one and a disembodied shadow or a trail of
sparks flies down an empty street.

```js
player.setMenuMode(true);    // init, and every toMenu()
player.setMenuMode(false);   // startRun()
```

Nothing else changes — the world, the difficulty ramp and the camera all keep running, which is why
pressing PLAY reads as joining a shot already in progress rather than starting one.
`scripts/characters.mjs` asserts this for all ten villains: invisible at the menu, visible in play.

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
floor separating them from her boots. Silver Shrike, Scarlet Tyrant and Nocturne — cape behind and
below, same two-ramp shape as Dominus. The Forged is the exception: it is built in code, so its
cape is a named mesh and `flowMesh:'cape'` tags the whole thing instead of guessing at a box.

## Checking a change

`scripts/cape-and-window.mjs` guards that the weights exist and the shader is live on every
character. To actually *see* the mask, render the model with `aFlow` as vertex colour — grey is
pinned, yellow moves. That is how each region above was set, and it is the check to repeat if a
model is ever replaced.

The wind itself is applied along the model's own local axes, derived by carrying world "behind /
up / sideways" back through each character's `rotX` and `yaw`. Phase advances with **flight
speed**, so the faster you go the harder the air pushes and the tighter the ripple.

---

# PART 7 — The roster

Nineteen villains. Nine are GLB models; ten are built from code.

| Key | Name | Source |
|---|---|---|
| `dominus` | Dominus | GLB |
| `frutiger` | Frutiger Villain | GLB |
| `knight` | Evil Knight | GLB |
| `patriot` | The Patriot | GLB |
| `entity` | The Entity | GLB |
| `countess` | Violet Voidstrike | GLB |
| `shrike` | Silver Shrike | `assets/char_a.glb` |
| `tyrant` | The Red Jester | `assets/char_b.glb` |
| `nocturne` | Nocturne | `assets/char_c.glb` |
| `forged` | The Forged | **code geometry** |
| `dominus_f` … `nocturne_f` | *· Forged* — the whole roster again, rebuilt in code | **code geometry** |

### Orientation: check it, never assume it

`rotX`, `yaw` and `roll` in `CHARACTERS` rotate the export into the flight pose. Copying another
character's numbers is how three villains shipped crooked:

- **Nocturne** and **The Red Jester** are authored standing upright, facing `+Z`. They take the
  full `rotX: 1.15` flight pitch — but `yaw: 0`. They had inherited Dominus's `Math.PI/2-1.3`
  (≈15.5°), which is a correction for *his* export and skewed theirs off the street.
- **Silver Shrike** is authored **already flying prone** — arms forward, cape trailing, like
  Voidstrike. Pitching him another 66° on top of that stood him on his head. He is `rotX: 0.20`,
  `yaw: 0`.

**`pose-sweep.html`** does exactly this. Serve the repo root and open:

```
pose-sweep.html?u=./assets/char_a.glb&p=[[0,0,0],[0,0,1.5708],[0,0,3.1416],[0,0,-1.5708]]
```

Each `p` entry is `[rotX, roll, yaw]`, rendered side by side from the game's own camera. Whichever
panel shows his BACK is your yaw; then add pitch only if he is standing up in it. Guessing costs
more than the two minutes that takes. Each also carries an `aura:{epic,eth}` pair, which is
what colours the whole screen at Epic and Ethereal — see *The villain's aura colours the whole
screen*.

## Adding a GLB

Raw exports are enormous — the three most recent were **76 MB together**, which on a phone is a
loading screen you cannot hide. Compress before committing:

```bash
npx @gltf-transform/cli optimize in.glb out.glb \
  --compress meshopt --texture-compress webp --texture-size 1024
```

That took them to **10 MB together** with no visible difference at gameplay distance.

⚠️ **Meshopt output uses interleaved attributes.** `geometry.attributes.position.array[i*3]` reads
whatever attribute happens to sit next to it in the buffer and returns garbage — which is how a
cape mask once came out as random speckle across the whole model. Always use `getX/getY/getZ`.

Then add the entry to `CHARACTERS`, give it a `flow` region (PART 6), and render a portrait to
`assets/prev_<key>.png`.

## The Forged — built from code

`buildProceduralVillain()` builds a villain out of geometry alone: **~110 meshes, 19k triangles,
8.7 heads tall in the flight pose.**

Unlike the GLBs, his **pose is authored, not corrected**: he is modelled standing and then pitched
exactly `Math.PI/2` so he flies dead level. Because "forward in flight" is the model's own `+Y`,
fists-first means both arms go **overhead**, not out to the sides — and the splay has to stay small
(`z: ±0.115`); at `±0.30` he read as a T from behind rather than a spear going into the wall. The
head is its own group pivoting at the base of the neck, craned back `0.92` rad, because a flier
staring at the tarmac reads as a corpse falling rather than a villain arriving. Legs trail with a
small stagger; a walking stride at 300 km/h looked like somebody stepping through the air. Everything derives from one constant, `HEAD = 0.115`, so the proportions stay
human no matter what it is scaled to.

The thing that keeps it from reading as a toy is that **almost nothing is a box or a sphere**.
Limbs and torso are `LatheGeometry` silhouettes — a profile of radii swept around the axis — so the
deltoid swells, the elbow tapers, the calf bulges and the ankle pinches, the way an actual arm and
leg do. The face is built rather than painted: brow ridge, nose bridge, cheekbones, jaw and ears.

### Lathes for limbs, rounded boxes for everything else

Two primitives carry the whole model, and using the wrong one is what makes a part look wrong:

- **`limb(profile)`** — a `LatheGeometry`, a solid of revolution. Right for anything radially
  symmetric about its own axis: upper arms, forearms, thighs, shins, necks, bands, spikes.
- **`roundBox(w,h,d,r)`** — a box whose vertices are pulled onto an inner box swept by a sphere of
  radius `r`. Right for anything that is a **block with radii**: hands, fingers, boots, knee guards.

The fist was built out of lathes first. A lathe cannot make a hand: the palm came out as a faceted
cone and the fingers as loose cylinders floating off the end of it, which reads as a robot claw.
Rebuilt from rounded boxes it is a rounded palm mass, four knuckles standing proud of the leading
face, four fingers curled round onto the palm with the tips tucked under, and a two-segment thumb
laid across the front — about 0.010 heads of clear air between fingers, because the grooves are
what say "fingers" at gameplay distance. The knuckle line is an **arc**, not a bar.

Feet had the same problem, plus a scale one: a foot is nearly a **head long**. A stub on the end of
the shin is the classic tell. The sole is its own dark material — it was chrome, and from behind it
read as a grey block wedged into a red boot.

### Nothing may differ between left and right

The legs carried a walking stride, `0.34` on one side and `-0.10` on the other. At 300 km/h that
does not read as a stride, it reads as **him leaning** — and the player will report it as the model
being crooked, not as an animation choice. Both legs and both arms are exact mirrors now
(`side*` on the z-rotation only). `BANK_ROLL` is already `0/0`, so any apparent lean is the model.

### The cape is a cone, not a plane

This is the one that took three goes. A cape built as a `PlaneGeometry` bent backwards keeps its
side edges near `z≈0`, so they punch out through the ribs — from the front he was wearing two red
panels — and a plane long enough to drape properly rises past his ears.

A cape is a **conical shell**. Every point sits at a radius `R` from the body axis, swept through
an arc that only covers the back. Build it in polar coordinates and the body can never poke
through, because the cloth is always outside `R`:

```js
const half = A0 + (A1-A0)*t;                    // 126° across the back at the collar, 165° at the hem
const th   = u*half;
const fold = Math.sin(u*Math.PI*3.5)*0.115*HEAD*Math.pow(t,1.25);   // a RADIAL ripple
const R    = R0 + (R1-R0)*Math.pow(t,0.88) + fold;
x =  R*Math.sin(th);
z = -R*Math.cos(th) - 0.05*HEAD;
y =  CTOP - t*CLEN + Math.pow(Math.abs(u),1.7)*0.42*HEAD*t*t;       // hangs low at the spine, lifts at the tips
```

### The head took three goes too

Each failure is worth naming, because they are the obvious things to try:

1. **A bare skin ovoid** reads as a shop dummy. There is nothing to catch the light and nothing
   that says "costume".
2. **An open-arc cowl standing off the skull** shows its cut edges as sharp panels beside the ears
   — an open shell with `DoubleSide` displays its own interior at the seam.
3. **A face lathe pushed forward through a closed helmet** turns into a **muzzle**, because a lathe
   protrudes as a cone, not as a plane.

What works: a full skin head, with the cowl as a thin shell of the **same profile** `0.02` heads
larger, wrapped around everything but the face. The two surfaces are nearly coincident, so the cowl
reads as a cover *on* the head rather than a helmet floating around it, and its open edge lands
flush on skin — which is exactly what the edge of a real cowl does. The visor is its own lathed
band across the eye line; trimming a full head-shell down to a band by shrinking the vertices
outside it does **not** work, because a shell 0.038 heads proud of the skull is still proud of it
after a 6% shrink, and the whole face comes out red.

Two more first-pass mistakes: the arms ended at the hip (anatomically the elbow sits at the navel
and the wrist at the crotch), and the chest plate was a full lathe in the trim colour — a red dome
widest at the chest and narrowing to the shoulders, which is the silhouette of a bust. It is now a
metal shell over the front 210° with a small chevron.

### Detail is worthless if the value is too dark to show it

The suit was `0x1b1d26`. Every plate, rib, buckle and guard on him disappeared into one silhouette
in daylight — the model had the detail and none of it was visible. Lifting the suit to `0x232a3a`
is what made the armour read at all, and it cost nothing.

There are now **four** armour tones, and they have to stay separated or the detail merges again:
`matSuit` (dark cloth), `matPlate` (mid, for large chest and collar pieces), `matMetal` (bright, for
small hardware — bands, cuffs, knee guards, spikes) and `matSole` (near-black rubber). The chest
shell was `matMetal` at first and became a white bib across his chest that read as a bust *again*,
and it drowned the chevron sitting on it. Big pieces take the mid tone; only small ones get chrome.

The armour pass itself: pauldron spikes, forearm vambraces, abdominal ribs, a belt emblem, knee
guards, boot straps, cape clasps, and emissive eyes set into the visor. The eyes are the cheapest
thing in the whole model and the one that makes the head look alive at speed.

Because it is code, its cloth is tagged by mesh name — `flowMesh:'cape'` — rather than by a
bounding box, which is exact.

## ON FIRE overwrites materials — put them back

`glow()` writes `emissive` on every material in `player.glowMats`. Whatever you set there is
**destructive**, so the way out of it matters:

- The restore is **unconditional**, and it restores each material's **authored** emissive from a
  snapshot — not black, and not the `0.16` floor the glow uses. The Forged's metal is authored with
  a real emissive of its own, and his eyes with a bright one.
- It used to be gated on `fireAura.visible`, and `setMenuMode` hides that aura directly. So dying
  while ON FIRE hid the aura, the guard read false on the next run, and the villain **stayed lit in
  the last aura colour for the rest of the session** — which is what "he turns white and stays
  white" was. `unglow()` is now called from the update, from `setMenuMode`, and from `reset()`.

`scripts/characters.mjs` lights every villain, drops him back to the menu mid-blaze, and asserts
every material is exactly as authored.

## The Forged line — one anatomy, nine costumes

Every GLB villain has a code-geometry twin. They share `buildProceduralVillain`, the rig, the cloth
shader and the powers of the original; only the **kit** differs. A kit is a palette plus a costume
description, and it lives in the `FORGED` table:

```js
knight_f: { from:'knight', name:'Evil Knight · Forged', flow:FLOW_TIP, kit:{
  skin:0x6a5a52, suit:0x161418, plate:0x2a262c, metal:0x6e6a74, trim:0xb2131c,
  sole:0x0e0d10, eye:0xff2a1a, eyeCore:0xffb08a,
  mask:'helm', horns:2, hornStyle:'curved',
  back:'wings', backCol:0x8e1018, backCol2:0x241f24, emblem:'none' } },
```

`from` supplies the aura and the four powers. The CHARACTERS entry and the villain card are both
**generated from this table**, so adding a villain is a dozen lines and no download at all.

| Option | Values |
|---|---|
| `mask` | `visor` `domino` `helm` `hood` `jester` `wrap` |
| `back` | `cape` `coat` `wings` `energy` `shreds` `none` |
| `emblem` | `chevron` `star` `diamond` `none` |
| `hair` | `null` or `{col, len}` |
| `horns` / `hornStyle` | `0`/`2`, `spike` / `curved` |
| `armour` / `chest` / `slim` | `0`/`1` — hardware, breastplate, build |

Five colours have to stay **separated** or the detail merges back into one silhouette: `suit`
(cloth), `plate` (mid, big pieces), `metal` (bright, small hardware only), `trim` (accent), `sole`
(near-black). Putting a large shell in `metal` is what turned the chest into a white bib twice.

### `flow` differs by what is hanging off the back

The cloth shader ramps its weight along one axis of each mesh's own bounding box, so the free edge
has to be at the far end of that axis:

- `FLOW_HEM` — `{a:'y', d:-1}`. A cape, coat, shreds or hair: the free edge is the **hem**, lowest y.
- `FLOW_TIP` — `{a:'z', d:-1}`. A wing: the free edge is the **tip**, and a wing sweeps backward as
  it extends, so its tip is the most-negative z.

### Traps hit while building the back pieces

- **Wing bones pointed the wrong way.** A lathe is built along `+Y`, so aiming it at `(cos a, sin a)`
  is a rotation about Z of `a − π/2`. With the sign flipped the bones splay out through the far side
  of the membrane. They also stop at `0.88` of the span, or they spear past the trailing edge.
- **A helmet whose face is the trim colour is just a coloured head.** The read comes from a **dark
  visor band**, not from the shell.
- **Hair as a full ring of narrow strands** puts hair across the face and overlaps into one dark
  wedge. It hangs off the back half of the crown only, and the strands are twice as wide.
- **A near-black cape disappears** against a dark background — not a bug, but lift it off black or
  it reads as a hole.

## Checking the roster

```bash
node scripts/characters.mjs           # every villain the page declares
CHARS=knight_f node scripts/characters.mjs   # just one, while iterating
```

The roster is read from the page, so a new villain is covered the moment its kit is added. Asserts, for each: the model exists, the cloth mask covers a plausible slice of
it (a mask over ~60% means it caught a limb), the portrait decodes, the villain is hidden at the
menu and visible in play, all four powers are wired, and the page threw nothing.

---

# PART 8 — Performance

The game was never JS-bound — a full update pass measures **0.25 ms**. It was bound on **draw
calls**, and there were 1,408 of them in Tokyo. Four changes took that to **917** (Metro: 577 →
313), with no visible difference.

| Change | What it was | What it is |
|---|---|---|
| Prop batching | ~30 meshes per roadside group | one mesh per distinct look (2–10) |
| Coin field | 130 shards × 2 meshes, 260 materials | two `InstancedMesh`es, 2 calls total |
| Drink cans | 6 meshes each | 3 — the ribs, lid and tab bake into one |
| Shadow frustum | 200 units wide at 2048 | 124 wide at 1536 |

## Prop batching

A prop group is a trunk, a canopy, a kerb, five lanterns and a wire — and **nothing inside it ever
moves on its own**; the whole group slides along the road as one rigid object. So `_mergeProps()`
bakes each group down to one mesh per distinct look, after `_skinProps` has built it.

Bucketing is by the material's **values**, not its identity — `_M()` mints a fresh material for
every call, so two kerbstones of the same grey are different objects and would never batch on
identity alone. `castShadow` is part of the key, since it decides which pass a mesh lands in.

Anything else that is a fixed cluster of small meshes can use the same `concatGeo(list)` helper.
It handles position/normal/uv on the shared primitives and skips the 40KB general-purpose merger.

## Shadows

The shadow frustum was 200 units across for a road 44 wide. Everything inside it is re-rendered
into the depth map every frame, and at 200/2048 each texel covered 10 cm. **124 units at 1536 is
8 cm per texel — sharper shadows AND fewer casters.**

Only **tall** props cast (`top > 2.6`). Benches, bins, crates and cones were each costing a draw
call to lay down a smudge two texels wide at the foot of something the player passes at 200 km/h.
Trees, poles and lamps still cast, which is where shadows actually read on the road.

## Adaptive resolution

It used to wait for a two-second average under **27 fps** before doing anything, and it could only
ever go **down** — one loading hitch and the game stayed soft for the rest of the session.

It now samples every 60 frames, drops a step above 20.8 ms (below ~48 fps), and climbs back after
three consecutive windows under 14.5 ms (~69 fps). Steps are
`[min(2,DPR), 1.7, 1.45, 1.2, 1]`.

## Measuring it

`renderer.info.render.calls` is the number that matters, and it moves with where you are in the
run — sample it a few seconds in, on the same map, before and after. Counting *visible meshes* by
walking the scene tells you where the calls are coming from; attributing each mesh to the pool that
owns it (`city.buildings`, `pickups.coins`, `city.props`, …) tells you what to fix.

---

# PART 9 — Swipe mode

A second way to play, picked in the menu, and a **branch through the existing systems** rather than
a second game: every map, villain, power and mission works in both. `game.mode` is `'free'` or
`'swipe'`, persisted in `invrun_mode`.

## Latency is the whole feel

The step fires on **touchmove**, the instant the finger crosses the threshold — **not** on release.
Waiting for the lift adds the entire duration of the gesture to the response, which is what made
the first version feel like mud next to a phone home screen. The anchor then re-arms where the
threshold was crossed, so one long drag across the glass steps lane after lane.

A short fast flick that lifts before crossing the threshold still counts, judged on **velocity** —
that is the difference between a control that respects a quick wrist and one that makes you draw
the whole distance.

⚠️ **World +X is screen LEFT under this camera.** Swipe shipped inverted for exactly the same reason
drag did. `scripts/swipe-mode.mjs` now projects him through the camera and checks the pixels, as a
fresh transient in each direction — the chase camera tracks his x, so a few tenths later the sign
has washed out.

## A flick is a step, not a push

The lane is an **integer** in `[-1,1]`, and a flick changes it. He leaves for the next lane and
arrives there; nothing done mid-flight changes where he is going. That commitment is the whole feel
of a swipe runner — a continuous position would just be the drag control with extra steps.

Flick detection lives in `InputSystem` on its own touch id, so it works whichever control scheme is
selected, and it is **consumed** by the reader (`consumeLane()`) so a flick can never be counted
twice or dropped between frames.

## The geometry has to be built for it

| | |
|---|---|
| `SW.laneX` | 9.2 m between lane centres |
| Targets | sit exactly **on** a lane and **fill** it — a tower narrower than its lane means landing in the right lane and still missing |
| Next target | at most **one lane away**, so a single flick always reaches it |
| Armored gates | span **all three lanes** |

That last one is not a detail. A gate you can dodge by changing lane makes powers optional, and the
whole power mechanic becomes decorative.

## The laser tower

Swipe mode's hazard, and it is a **building** — not a gantry. A black tower at the kerb with a
cantilevered emitter reaching out over the road: an iris of six blades that rotates open, a lens
that spins up, three energy rings sweeping *inward* into it, warning strobes up the face, and then
a beam straight across the street at flight height, into the far side, where it splashes.

```
charge (1.85s, warning + EVADE button)  ->  fire (0.55s)  ->  cool (0.55s, the iris closes)
```

`cool` matters: a weapon that just stops looks broken.

Three placement lessons, all learned by rendering it:

- **The emitter has to reach over the road.** The tower body must stand clear of the play box, and
  at that distance an aperture flush to its face sits outside the camera's 34° half-angle — you get
  shot by something you never saw. Hence the cantilever arm.
- **The tower needs lit panels.** A black slab against a dark street is invisible at 120 m, which is
  exactly the distance at which you need to notice it.
- **A wide additive halo washes the screen.** The first beam had an 84×26 sheet lying *flat* on the
  road; over the whole street it read as orange fog, not as a laser. A beam reads from a hard edge,
  so the halo stays tight and upright and the core stays bright.

## EVADE is a manoeuvre, not a lift shaft

Three phases over `SW.duckTime`:

| | |
|---|---|
| **TUCK** 0.00–0.20 | drops fast, pitches nose-up, like braking under the beam |
| **ROLL** 0.20–0.72 | a complete barrel roll, held at the low point |
| **RISE** 0.72–1.00 | back to cruise, roll easing out |

The height curve and the roll are **separate on purpose**: the height is what the hit test reads,
the roll is what sells it, and neither should be able to break the other.
`pos.y = cruiseY - duck*SW.duckDrop`, and the beam test reads `pos.y` — an animation-only duck would
look like a dodge and still take the hit. Pressing again mid-dodge is ignored rather than stacked,
so mashing cannot park him underground.

## Testing it

```bash
node scripts/swipe-mode.mjs
```

It checks both halves: that swipe behaves like a swipe runner **and** that free flight is untouched
— a flick is never even consumed there, the stick still steers continuously, its towers are not
lane-quantised, and no rail cannon exists.

⚠️ `_pathX` scales the road's lateral swing by `difficulty.level`, so a tower placed at one
amplitude and measured at another reads as off-lane through no fault of the placement. Freeze
`difficulty.update` in any test that measures lane alignment.

---

# PART 10 — The tutorial

Coached over a **live run**, not a slideshow. Each step states one thing and then waits for the
player to actually do it: a card you dismiss teaches nothing, and a card on a timer teaches the
timer.

```js
{ t:'ARMORED WALLS', b:'…', h:'TAP POWER WHEN IT GLOWS',
  focus:'#btn-power', done:()=>this.count.power>=1 }
```

- Steps are built **per run**, so they name the actual control scheme and mode — swipe mode gets a
  rail-cannon step, free flight does not, and the steer step reads "flick" or "drag" or "stick".
- `focus` lights the control the step is about, which beats a pointing hand.
- Progress comes from `note(kind)` calls placed at the real events — a smash, a lane change, a power
  fired, an evade — not from polling.
- Skippable, recorded in `invrun_tut`, never repeats, and replayable from **Settings → Tutorial**.

`scripts/tutorial.mjs` proves a step waits for its event rather than for the clock, by stubbing the
collision so the villain cannot satisfy step one on his own.

---

# PART 11 — Landmarks

The skyline pool fills the horizon with generic silhouettes. Landmarks are the layer above it: eight
recycled slots holding big, hand-shaped, **themed** features that say what world you are in.

| Map | What stands there |
|---|---|
| Frutiger Aero | terraced eco-towers, wind turbines, floating islands with a still pool |
| Medieval | a hill castle — keep, curtain wall, banners |
| Inferno | the volcano itself, glowing at the throat, with ash plumes |
| Neon Void | a wireframe sun and hard grid ridges |
| Tokyo | pagodas, and a low moon behind the skyline |
| Metro | service alcoves cut into the tunnel wall |
| Backrooms | **nothing** — see below |

The Backrooms slot is deliberately empty. The corridor is the whole idea, and a doorway hung on a
wall that is itself a moving ribbon reads as a flat panel floating in mid-air — which is exactly
what it looked like. An empty slot is the correct answer there.

**Placement is the whole trick.** Parked 150 m out to the side they are simply off-screen: at that
angle nothing but the road is in frame. Outdoor landmarks belong **ahead**, near the vanishing
point, 45–110 m to the side. Interior maps hang theirs on the wall a few metres out instead.

The Metro tunnel also gets **ceiling strip lights** — it was lit by nothing but the emissive on its
own walls, which is why it read as a green pipe rather than a place — and real trains: a rounded
shell, a raked cab nose, a wrapped window band, bogies, headlights and a pantograph. A
2.6×2.8×15 box with a stripe on it is a shipping container.
