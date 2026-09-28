# Focusling Art Direction

How Focusling cosmetics look, and the rules that keep every pet recognisable under any outfit.
This covers the **v1 in-house vector art**, drawn as code in `src/ui/pet/`. It is placeholder-quality
art with a real system underneath; see §9 for what a professional illustrator should replace.

Related: [`COSMETICS.md`](COSMETICS.md) (collections, Looks, Reactions, ethics) and
[`ARCHITECTURE.md`](ARCHITECTURE.md) §14.

---

## 1. Principles

1. **Pet first.** The outfit supports the character. Eyes, mouth and crest (sprout, flame) always read.
2. **Material tells the story.** A visor should look like smoked polycarbonate and a scarf like fabric,
   before colour is even considered. Collections differ in silhouette and material, not just palette.
3. **Remix is the point.** No set bonuses and no hidden penalties. Pieces exclude each other only when
   they really overlap on the pet.
4. **Calm, finite motion.** Auras twinkle slowly; reactions end by themselves; Reduce Motion keeps the
   feeling without the movement.
5. **Original IP only.** Broad archetypes, no brands, teams, liveries, characters or traced outfits.

---

## 2. Materials Bible

Every drawing is rendered in **one material family** (`ART_MATERIAL` in `src/config/cosmetics.ts`,
also stored as `art.material` on each collection item). Each family has **one recipe** in
`src/ui/pet/materials.tsx`, so the same material looks the same on every item. Everything is flat SVG
(gradients, strokes, ellipses): **no filters or blur**, which keeps it cheap on low-end phones.

| Family | Recipe (cues in order of importance) | Used for |
|---|---|---|
| **Jelly** | translucent radial gradient (accent → primary → secondary), soft specular blob, darker rim | Gummy Visor, Heart Shades, goggle glass, Acorn Specs lenses, Heart charm |
| **Smoked** (jelly variant) | top-to-bottom tint (darker top), one hard diagonal reflection, a thin streak | Scanline Visor (smoked polycarbonate) |
| **Chrome** | banded light–dark–light gradient, crisp white streak | Tech Collar, goggle rings, Aero Shades bar, Golden Crown |
| **Pearl** | radial white core → tint, faint iridescent sheen overlay, pin-point glint | Pearl Collar, Moon Charm, Crescent Headband star, Planet charm |
| **Fabric** | matte fill, stitched seams (`Stitch`), soft fold shadow | Cloud Cap, Racing Cap, Racing Scarf, Charm Harness, Acorn Satchel, rosette ribbon |
| **Knit** | matte fill, rib lines following the shape, chevron cuff (`KnitRibs`) | Pixel Beanie, Leaf-Knit Beanie |
| **Plastic** (glossy) | lighter top, darker base, one bold highlight | Arcade Headset, D-Pad charm, Ladybug Pin, Star/Bolt charms |
| **Holographic** | restrained multi-hue sheen (cyan, pink, butter) over the base colour | Aero Shades lens, Crescent Headband moon |
| **Fuzzy** | soft fill with a bumpy dotted outline (`FuzzEdge`), no hard edges | Cloud Beret, Moss Scarf |
| **Wood** | warm fill, curved grain lines (`Grain`), a small varnish glint, no gloss blob | Acorn Specs frames, Toadstool Charm |

**Representative upgrades in this pass:** Midnight Arcade visor → smoked polycarbonate; Dreamwave →
pearl, jelly and holographic gloss; Cloud Racer scarf → stitched fabric (and re-tied at the side);
Racer Goggles → chrome rings with reflective glass; Focus Club visor → jelly, cap → fabric.

**Rules for new items**
- Pick one family; add the art key to `ART_MATERIAL` (a test fails otherwise).
- Glossy families get exactly **one** dominant highlight; matte families get **none**.
- Eyewear must be see-through: jelly, smoked or holo lenses with opacity ≤ 0.8 (tested).
- Gradient ids come from `materialId(family, palette)`: identical ids always mean identical gradients.

---

## 3. Species-aware fashion

### Crest zones
The **Sproutling's sprout** and the **Emberling's flame** are part of their identity; a hat may never
hide them. Crests are drawn by `PetCrest` (`src/ui/pet/crest.tsx`), not `PetBody`, so `PetArt` can
place them relative to what's on the head. Each head drawing declares one mode in `HEAD_FIT`:

| Mode | Meaning | Drawings |
|---|---|---|
| `lift` | Closed crown. The crest sits on top of the crown and pokes through a species opening: a brass **eyelet** (sprout) or a glowing, stitched **heat vent** (flame). It scales down only if it would leave the canvas (never below ~0.7×, tested). | Caps, beanies, Cloud Beret |
| `over` | Open or thin headwear. The crest is redrawn in front of it at its natural spot. | Headphones, Arcade Headset, Crescent Headband, Golden Crown |
| `under` | Normal stacking; the headwear only touches the crest's base. | Racer Goggles, Flower Crown |

**Cloudling** has no separate crest: its whole cloud silhouette is the crest. Under a closed hat, soft
**cloud tufts** puff out from under both sides of the brim (`CloudTufts`), so the silhouette still reads
as a cloud instead of a flat cap; side puffs, wings and outline stay visible.

Every head drawing must be listed in `HEAD_FIT` (tested), so a new hat can't silently cover a crest.
Tests also check, for every hat × species × stage, that the crest's tip stays visible and on-canvas.

### Face and eye clearance
- `HEAD_FIT[key].faceEdge` is the lowest point a hat reaches over the eye columns. For every species
  and stage, `headTop + faceEdge (+ fit dy) ≤ eyeY − eyeRadius(stage) − 2` (tested). Babies have
  bigger eyes (×1.18), so brimmed caps ride 2 units higher at Baby (`FIT.babyBrim`) and eyewear opens
  up (`FIT.babyEyewear`, `FIT.babyHearts`).
- Pieces beside the face (headphone cups, the headset mic beside the mouth) are allowed; nothing may
  sit on the eyes or the mouth.
- Charms hang at the chest (`neckY + 11`); neck pieces sit on the collar line.

### Extending fit
Species/stage adjustments stay in the existing fit architecture: `art.fit` entries (±12 units,
0.8–1.25×, tested) for placement, `HEAD_FIT` for crest behaviour. No coordinate tweaks in components.

---

## 4. Aura composition

An aura **frames** the pet; it never sits on it. Rules (`AURA_FRAME` in `src/ui/pet/auras.tsx`,
tested for every aura layout):

1. Every particle centre is **outside the pet ellipse** (centre 100,120; radii 72 × 68), which holds
   the body, face and worn pieces.
2. No particle enters the **crest column** above the head (x 78–122, y < 72): that's where sprouts,
   flames and hats live.
3. Every particle stays **inside the 200 × 200 box**.
4. **At most six particles**, each ≤ ~35 units. Pixel Hearts was reduced to four smaller hearts
   (3-unit cells) because the old 5 × 5 grid read as noise.
5. Motion: a slow out-of-phase twinkle; off for Reduce Motion, focus sessions (dimmed) and thumbnails.
6. Asymmetry is allowed (Firefly Glow gathers on one side) as long as rules 1–3 hold.

---

## 5. Controlled asymmetry

Asymmetry adds character when it is **one deliberate detail per piece**, never on the face:
the Pixel Beanie slouches right; the Pearl Collar's bow sits left; the Racing Scarf knots on the side;
Moss Club puts the leaf on the left of the beanie, the long scarf tail on the left, the satchel on the
right hip, the ladybug pin right of centre and the fireflies mostly on the right. Eyewear, eyes and
mouth stay symmetric.

---

## 6. Moss Club (the one new collection)

Forest streetwear for a tiny magical creature: cosy, tactile, organic, a little lopsided.

- **Palette:** moss `#6E9B4E`, forest `#2F4A2E`, mushroom red `#C8553D`, cream `#F4E9D2`, warm wood
  `#A9744F`, firefly `#E9F27A`. **Badge:** a lopsided pebble with a toadstool and a firefly.
- **Pieces (7):** Leaf-Knit Beanie (knit; 15 sessions), Acorn Specs (wood + amber jelly; 12 h of
  focus), Moss Scarf (fuzzy; 12 missions), Acorn Satchel (fabric; 55 coins; its strap crosses the
  charm, so it excludes charms — the only exclusion in the catalog), Toadstool Charm (carved wood;
  10-day streak), Ladybug Pin (glossy enamel; 35 coins), Firefly Glow aura (20 h of focus).
- **Curated Look:** beanie, specs, scarf, ladybug pin, Firefly Glow.
- **Reaction:** *Firefly Hello* (Calm): a slow small wave while fireflies drift up one side. Reduce
  Motion: the same face and fireflies, shown in place and faded, no drift or sway.

---

## 7. Personality presentation

The nine reactions belong to four families (`PERSONALITIES` in `config/reactions.ts`):
**Calm** (Wave, Sleepy, Firefly Hello), **Hype** (Happy Hop, Victory Lap), **Dreamy** (Star Twirl,
Dream Float), **Cool** (Cool Pose, Pixel Pop). Presentation only: the Reactions tab is grouped by
family, the outfit card shows the favourite's family, and when the favourite plays on a tap the pet
speaks in that family's voice. No stats, scores, quizzes or reward effects.

---

## 8. Checking the art (Fit Lab, Character Lab)

Developer tools → **Character Lab** (`/dev/character-lab`): the naked-pet test (each species × Baby /
Young / Adult / Evolved × A naked, B one accessory, C a full Look), the expression library, face
close-ups, and the room comparison board (Default, White, Black, Red, Green, Blue, Yellow, Pink,
Purple, Gray and a custom colour from the real picker; decorations on/off).

Developer tools → Fit Lab (`/dev/fit-lab`, hidden and route-refused when Developer tools are off):
- **Creative board:** Core (Focus Club) / Midnight Arcade / Dreamwave / Cloud Racer / Moss Club /
  User Remix × Cloudling / Sproutling / Emberling.
- **Hats × crests:** every head drawing on every species (evolved crests are the largest).
- **Any Look × Baby / Young / Adult / Evolved**, plus Extras A–F covering every piece not in a Look.
- **Grayscale** toggle (web, CSS `filter: grayscale(1)`): silhouettes and materials must read without
  colour. On a device, use the OS colour filter (iOS: Accessibility › Display & Text Size › Colour
  Filters › Greyscale).

---

## 9. Honest limitations and illustrator handoff

This is **v1 vector art written as code**. It is consistent and tested for fit, but it is not
final illustration. What an illustrator should do:

- Redraw each item keeping its **art key**, **material family**, **anchor points** (`ANATOMY`) and
  `HEAD_FIT` values; logic never needs to change (art is keyed data, separate from rules).
- Deliver per-item SVG (or layered vectors) in the 200 × 200 pet space; one drawing per art key,
  colourways via the palette slots (primary, secondary, accent, optional lens opacity).
- Redraw the base pets (`PetBody`, `PetFace`, `crest.tsx`) keeping silhouettes, `ANATOMY` anchors and
  the crest heights; the species language (§11) and growth language (§12) are the brief.
- Room art (`RoomScene`) takes a `RoomPalette`; a new room drawing should paint only with palette
  tones so every user colour keeps working.
- Known weak spots today: fuzzy/knit texture is approximated with dotted strokes; auras are simple
  particle shapes; wood grain is a few lines; eyelet/vent openings and cloud tufts are simple stand-ins;
  Dreamwave is better in grayscale (darker band outline) but is still the softest-contrast collection
  on a lavender Cloudling; expressions are drawn with a small set of shapes.

---

## 10. Future only (documented, not built)

- **Focusling Cards:** a possible collectible card per Look/reaction for sharing a snapshot. Not
  built. Would need: no trading economy, no randomness, Child View without sharing, parent control.
- **Licensed collaborations:** architecture boundary only (`CollectionOrigin` / `CollectionAvailability`
  unions, see `COSMETICS.md` §14). Nothing licensed exists; no fake collaborations.
- **Behaviour achievements:** `Provenance` (`core/cosmetics/cosmeticsService.ts`) is a union so a
  future `{ kind: 'achievement' }` source can sit next to milestones and coins. No native-protection
  achievements are implemented.
- Not planned in this pass: After Hours / Jelly Lab collections, rotations, social features.

---

## 11. Base character rendering and species language

Hierarchy (never broken): **1 silhouette → 2 face → 3 species signature → 4 small material/detail
cues.** At phone size 1 and 2 carry the pet; 3 and 4 reward a close look. All flat SVG: soft radial
body gradients (light top-left, shaded edge), one rim-light stroke, a two-layer contact shadow, no
blur or filters. Per-species tones live in `SPECIES_ART` (`src/ui/pet/speciesArt.ts`).

| Species | Feeling | Cues |
|---|---|---|
| **Cloudling** | soft, airy, squishy, dreamy | layered lobes with cool lavender creases, edge highlights on each puff, lower lobes in soft shadow, a cloud-shaped belly (three bumps), puff wings with their own shade |
| **Sproutling** | fresh, organic, curious, growing | veined leaves (midrib, side veins from Adult) with a lighter tip, a stem with a light edge that grows out of the head, faint seed-coat side lines, a dewdrop highlight |
| **Emberling** | warm, energetic, glowing, cozy | a three-layer flame (warm red-orange, gold, cream core) with a highlight, a warm inner body glow, tiny floating embers, a gradient tail wisp; never sharp or aggressive |

Feet read as paws (sole highlight, toe lines from Young).

## 12. Eye language and expressions

**Eyes:** an ink oval with a gentle vertical gradient, the species tint reflected in the lower eye
(lavender, leaf green, ember orange), one primary catchlight (top right) and one tiny secondary
(bottom left). Closed states share one stroke weight (4.2) so every expression is the same character.
Babies get larger eyes (×1.18). Behind translucent eyewear the catchlights still read.

**Library** (`EXPRESSIONS` in `PetFace.tsx`): content (auto), delighted (happy), excited (star
catchlights, big smile), curious (glance up, small "o"), proud (content closed eyes, warm closed
smile, stronger blush), surprised (round eyes, round mouth), wink (cool/confident), focused, sleepy,
eating, blink. **No punishing faces:** "lonely" is shown as calm half-lids and a neutral mouth, never
a frown or tears. Reactions map to these: Wave → delighted, Happy Hop / Star Twirl → excited,
Cool Pose / Pixel Pop → wink, Victory Lap → proud, Firefly Hello → curious, Sleepy / Dream Float →
sleepy.

## 13. Growth language

| Stage | Naked pet |
|---|---|
| **Baby** | largest eyes, simplest details, smallest crest (one leaf and a bud; a small flame) |
| **Young** | balanced proportions; Cloudling wings, a second leaf, a cream flame core, toe lines, a few embers |
| **Adult** | stronger species details: belly marks (moon, spark), leaf veins and a tendril, Emberling tail, larger wings |
| **Evolved** | one signature flourish: Cloudling iridescent top rim + belly star; Sproutling bloom + glowing leaf edges + leaf mark; Emberling side flamelets + golden core; plus the soft evolved glow |

Fantasy creature evolution, not body ideals: later stages never become less round or less cute.

## 14. Room palette

The room is the pet's space, and its colour is **free** (Room Studio). One chosen colour becomes a
designed room (`roomPalette` in `src/ui/room/roomPalette.ts`, tuning in `src/config/room.ts`):

```
user colour → wall (exactly the colour) · trim (±11 L) · floor (same hue, 70% saturation, darker or
lighter) · floor edge · spotlight (the pool the pet stands in) · halo (soft disc behind the pet) ·
shadow · small accent · window sky
```

- **Dark rooms** (luminance < 0.16): lighter floor, a lifted halo, stronger shadows, and a calm
  night window (moon and stars; static).
- **Very bright rooms** (white, yellow; luminance > 0.82): the spotlight and halo are tinted warm so
  they still show; the floor goes darker.
- **Very saturated walls**: the halo is desaturated so the pet separates from the wall.
- The chosen colour is never replaced; only supporting tones adapt. Tested for white, black, red,
  green, blue, yellow, purple, gray, pink and every preset.
- **Room colour is not an app theme:** only the room (and the Wardrobe stage and Focus setup pet
  circle, which are the pet's space) change colour. The interface keeps the Focusling design system.
- Decorations keep their own colours and are drawn after the halo and floor, so they stay readable.
- Future (not built): earnable room treatments (wallpapers, floors, lighting moods, windows, collection
  sets) would add optional fields to `RoomState`; normal colours are never locked.

## 15. Animation restraint

- Idle life is occasional and silent: a blink every 2–5 s, and every 4–8 s one small moment (a glance,
  a double blink, or a crest wiggle: leaves settle, the flame flickers).
- Nothing idles during a focus session except the slow breath and blinks; hidden screens pause.
- **Reduce Motion:** no bob, hop, squish or crest wiggle; glances and blinks remain (they don't move
  the pet); reactions become a face change and effects that fade in place.
- Ordinary taps: a squish, hearts, a crest wiggle and at most one soft species sound; no counters,
  combos or escalating feedback.

