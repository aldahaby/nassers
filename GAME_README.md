# INVINCIBLE RUN — Omni Flight (Prototype)

A 3D third-person, physics-feel flying action prototype. You play an **invincible villain**
(Omni-Man style) who carries a ragdoll **victim** out in front and smashes him **through** a
destructible city. There is no finish line — **catch buildings to refuel momentum; miss too long
and you fall out of the sky.**

> Primitives only, no art assets. Focus is clean, modular, expandable systems and game *feel*.

## Run it

ES modules must be served over HTTP (not opened as a `file://`):

```bash
# from the repo root
python3 -m http.server 8000
# then open http://127.0.0.1:8000/game.html
```

Three.js is **vendored locally** in `./vendor`, so it runs fully offline (no CDN).
On a phone, open the same URL — touch controls appear automatically.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Steer (up/down/left/right) | `WASD` / arrows | left stick |
| Surge (momentum burst) | `Shift` / `Space` | SURGE |
| Restart | `R` | — |

## Core loop

1. You auto-fly forward; steer to line the victim up with buildings.
2. The dummy smashes **through** each building — you pass clean through (no bounce).
3. Each smash is graded by building size (`glance → smash → crush → level`) and gives
   **score**, **momentum**, **adrenaline**, and extends your **combo**.
4. Momentum decays over time (faster the higher it is). The run ends when it hits **zero**.
5. Big hits trigger **debris, a shockwave ring, screen flash, camera shake and slow-motion**;
   high adrenaline buffs your speed and score.

The city always spawns at least one building in your lane, so a save is always reachable — the
skill is chaining smashes for combos and not drifting above the skyline.

## Architecture

Pure **Three.js** with a **kinematic flight model** + custom lightweight impact physics (no
rigidbody solver — that was the source of the earlier stiffness/glitch/chaos). Each system is its
own class on a shared `game` bus, ready to be split into modules:

`InputSystem` · `FlightPlayer` (villain + dummy) · `CitySystem` · `ImpactSystem` ·
`EffectsSystem` (debris / rings / flash) · `MomentumSystem` · `ComboSystem` ·
`AdrenalineSystem` · `ScoreSystem` · `CameraSystem` · `TimeSystem` (slow-mo) ·
`RunStateManager` · `UISystem` · `AudioSystem` (synthesised WebAudio, no assets).

> Note: the unrelated `index.html` (a gold-price display) is left untouched.
