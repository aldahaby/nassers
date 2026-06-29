# MOMENTUM — Villain Run (Prototype)

A 3D third-person, physics-based action prototype. You play a superhuman villain who hurls a
target through a destructible placeholder city. There is no finish line — chain impacts to keep
your **momentum** alive and survive as long as possible.

> Primitives only, no art assets. Focus is clean, modular, expandable systems.

## Run it

ES modules must be served over HTTP (not opened as a `file://`):

```bash
# from the repo root
python3 -m http.server 8000
# then open http://127.0.0.1:8000/game.html
```

Three.js and cannon-es are **vendored locally** in `./vendor`, so the prototype runs fully
offline with no CDN dependency.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Steer | `WASD` / arrows | left stick |
| Launch / mid-air thrust | `Space` | LAUNCH |
| Impact boost | `Shift` | BOOST |
| Restart | `R` | — |

## Core loop

1. Launch the target into the city.
2. Each collision is graded into an **impact tier** (light → medium → heavy → catastrophic).
3. Impacts add **score**, **momentum**, and **adrenaline**, and extend your **combo**.
4. Momentum decays over time (faster the higher it is) and the run ends when it hits zero or the
   chain breaks for too long while moving.
5. Big hits trigger camera shake + slow-motion; high adrenaline unlocks speed/score buffs.

## Systems (all in `game.html`, one class each)

1. **InputSystem** – keyboard + touch → normalised intent
2. **PhysicsSystem** – cannon-es world, fixed timestep, body↔mesh registry
3. **MomentumSystem** – core survival resource, tracked separately from velocity
4. **ImpactSystem** – collision force → tiers → rebound / score / momentum / fx
5. **AdrenalineSystem** – meter from speed/combo/quality → buffs
6. **ComboSystem** – consecutive impacts within a time window
7. **ScoreSystem** – impacts, distance, destruction
8. **CameraSystem** – follow + dynamic FOV + shake, state machine
9. **TimeSystem** – smooth slow-motion that never destabilises physics
10. **CitySystem** – procedural placeholder city, recycled around the target
11. **RunStateManager** – Idle / Running / HighMomentum / SlowMotion / GameOver
12. **UISystem** – HUD bindings
13. **AudioSystem** – synthesised WebAudio event hooks (no assets)

Each system owns its own state and communicates through the shared `game` bus, so any one can be
lifted into its own module later without rewrites.

> Note: the unrelated `index.html` (a gold-price display) is left untouched.
