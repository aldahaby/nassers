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
| `lift` | Closed crown. The crest sits on top of the crown and pokes through a species opening: a stitched **grommet** (sprout) or a warm **vent** (flame). It scales down only if it would leave the canvas (never below ~0.7×, tested). | Caps, beanies, Cloud Beret |
| `over` | Open or thin headwear. The crest is redrawn in front of it at its natural spot. | Headphones, Arcade Headset, Crescent Headband, Golden Crown |
| `under` | Normal stacking; the headwear only touches the crest's base. | Racer Goggles, Flower Crown |

**Cloudling** has no separate crest: its whole cloud silhouette is the crest. Hats sit on the top puff;
the side puffs, wings and outline must stay visible (checked on the Fit Lab board).

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

## 8. Checking the art (Fit Lab)

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
- Give crests a proper "through the hat" treatment per species (the grommet/vent is a stand-in).
- Known weak spots today: Dreamwave is the least distinct in grayscale (lavender on lavender);
  fuzzy/knit texture is approximated with dotted strokes; auras are simple particle shapes; wood grain
  is a few lines; Cloudling hats flatten the top puff.

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
