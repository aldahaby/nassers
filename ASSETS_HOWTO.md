# CITYBREAKER — how to change the font and add your own images

Two step-by-step guides, then a reference for every tuning number in the game.
Everything lives in one file: **`game.html`**. There is no build step. Edit, save, refresh.

---

# PART 1 — Change the font

The game currently uses **Archivo Black**, and it is *baked into the file* as text (base64). That
is why it looks the same on your iPhone as it does on my screen — there is nothing to download and
nothing to go wrong.

To swap it for a different one, you have two options.

## Option A — just tell me the name (easiest)

Say *"use Bungee"* (or any font name) and I will do all of Option B for you in one go. I can reach
Google Fonts from here.

Chunky, classic fonts that suit this game:

| Font | Feel |
|---|---|
| **Archivo Black** | current — solid, neutral, very legible |
| **Bungee** | arcade signage, boxy, very chunky |
| **Luckiest Guy** | cartoon comic-book, rounded and friendly |
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

You will find **two** blocks that look like this:

```css
@font-face{ font-family:'CBDisplay'; font-style:normal; font-weight:100 900; font-display:block;
  unicode-range:U+0000-00FF,...;
  src:url(data:font/woff2;base64,d09GMgABAAAAA...THOUSANDS OF CHARACTERS...) format('woff2'); }
```

In the **first** block, select everything between `base64,` and `)` and replace it with the whole
contents of `myfont.txt`. **Delete the second block entirely** (it is only the extended-latin set;
you do not need it).

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
               xBox:22, hitDepth:8, gateEvery:12, gateMinGap:9 };
```

| Key | What it does |
|---|---|
| `xBox` | how far off centre you may fly |
| `hitDepth` | collision depth of a target, so a thin wall and a long train car are equally forgiving |
| `tierVol` | the volume every target reports, so score per smash is map-independent |
| `gateEvery` | average rows between armored/shielded gates |
| `gateMinGap` | hard minimum rows between two gates, so they never bunch up |

## Powers

```js
const PWR = {
  range:400,       // if you can see it you can shoot it (~4 s of FIRE window)
  blastAfter:2,    // how many towers BEHIND the gate also go down (never another gate)
  blastRange:150,  // how far past the gate that follow-through reaches
  gateScore:3.0,   // score multiplier for clearing a gate with a power
  slamCost:62,     // momentum lost for body-slamming a gate instead
};
```

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
the Powers sheet; `POWERS[char][0]` is the default. Setting `gateEvery` very high turns the whole
mechanic off without deleting any code.

Gate colours per map live in `GATE_LOOK`.

Reliability is asserted by **`scripts/power-reliability.mjs`** — 240 shots across every character,
map and power kind. Last run: 100% fire, 100% animation, 100% gate destroyed, 100% debris.

> Note for future edits: the gate schedule lives in four counters — `_rowN`, `_gateNext`,
> `_lastGateRow` and `_gateCount`. **They must all reset together.** `_rowN` used to reset alone
> while `_gateNext` kept climbing across runs, so after a handful of deaths the next gate was
> scheduled hundreds of rows away and gates stopped appearing at all.

## Shard boost

```js
const BOOST = { mult:2, hours:4, everyRuns:3, cooldownH:6 };
```

Offered on the results screen every `everyRuns` runs. Accept and shards count `mult`× for `hours`
hours. While it is live the prompt never appears again; after a decline it waits `cooldownH` hours.
Stacks with the separate first-three-runs-of-the-day daily multiplier.
