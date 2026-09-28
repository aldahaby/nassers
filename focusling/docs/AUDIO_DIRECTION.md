# Focusling Audio Direction

How Focusling sounds, and the rules that keep sound from becoming a distraction in a focus app.
Related: [`ART_DIRECTION.md`](ART_DIRECTION.md), [`AUDIO_COVERAGE.md`](AUDIO_COVERAGE.md) (generated).

---

## 1. Sonic identity

**Soft · bubbly · squishy · clean · tiny · playful · slightly magical · premium.**
Tiny "pop", "bloop", "plip", "pup", "boop", "fwip" and small chimes, all from one family of rounded
sine bubbles and soft bells.

**Never:** loud, harsh digital clicks, casino or slot-machine jingles, mobile-ad fanfares, arcade spam,
voices, songs or loops. No background music, focus music or ambience in this version.

This is the micro-sound layer only. Music and ambient room sounds may be evaluated separately later,
as optional, off-by-default treatments.

---

## 2. Semantic palette

The app never names files. It asks for a **semantic sound** (`playSound('equip')`); the table in
`src/config/sounds.ts` maps it to an asset, a mix level and its provenance.

| ID | Name | Intended feeling | ms | Level |
|---|---|---|---|---|
| `tap` | Standard Tap | a tiny soft bubble pop | 69 | 32% |
| `primary` | Primary | a rounder, satisfying "bloop" | 129 | 42% |
| `nav` | Navigation / tab | a very short, light "plip" | 49 | 26% |
| `back` | Back / Close | a softer, downward "pup" | 80 | 28% |
| `toggle-on` | Toggle On | a tiny rising bubble | 114 | 32% |
| `toggle-off` | Toggle Off | a tiny falling bubble | 114 | 30% |
| `select` | Select | a soft pop with a tiny sparkle | 144 | 34% |
| `equip` | Equip | a bloop as the piece lands, plus a sparkle | 269 | 40% |
| `confirm` | Save / Confirm | a warm double bubble, resolved | 309 | 40% |
| `unlock` | Unlock / New item | a small magical bubbly flourish | 660 | 42% |
| `purchase` | Purchase (focus coins) | a soft original two-note "tink" (not a casino jingle) | 320 | 36% |
| `unavailable` | Unavailable | a very gentle muted "bonk" | 120 | 24% |
| `focus-start` | Focus Start | a calm, intentional short cue | 529 | 34% |
| `focus-complete` | Focus Complete | a warm, satisfying resolve | 780 | 42% |
| `pet-cloudling` | Pet · Cloudling | a soft airy puff and bubble | 169 | 28% |
| `pet-sproutling` | Pet · Sproutling | a tiny leaf pluck and bubble | 169 | 28% |
| `pet-emberling` | Pet · Emberling | a tiny warm sparkle pop | 180 | 28% |
| `rx-wave` | Wave | a tiny friendly bubble pair | 219 | 30% |
| `rx-hop` | Happy Hop | soft springy pops | 340 | 30% |
| `rx-sleepy` | Sleepy | an extremely gentle airy cue | 500 | 18% |
| `rx-cool` | Cool Pose | a quick "fwip" and pop | 179 | 28% |
| `rx-twirl` | Star Twirl | a rising little shimmer | 380 | 28% |
| `rx-pixel` | Pixel Pop | tiny digital-bubble sparkles | 209 | 26% |
| `rx-dream` | Dream Float | a soft floating shimmer | 600 | 24% |
| `rx-victory` | Victory Lap | a short, bright but gentle flourish | 429 | 30% |
| `rx-firefly` | Firefly Hello | tiny warm glimmers | 489 | 24% |

All 26 are **placeholders** (status `placeholder`). Levels are relative (files are normalised to
−1 dBFS; the level is applied at playback, times a master of 90%).

---

## 3. Volume and duration philosophy

- UI chatter (tap, nav, back) is the quietest layer: 26–32%. Rewards sit a little above (36–42%).
  Nothing is above 50% by test.
- Durations: UI ≤ 150 ms, rewards ≤ 700 ms, the completion cue ≤ 800 ms. No loops (tested ≤ 800 ms).
- Files are tiny (2–35 KB, 380 KB total), 22.05 kHz mono 16-bit WAV, bundled with the app.

---

## 4. Focus-session silence rules

Focusling is a focus app, so during an active session:

- no background music, ambience, idle or random pet noises, no repeated attention-grabbing sounds;
- the **timer is silent**;
- **explicit presses** (e.g. Stop, confirm dialog) still get their normal cue at 55% of its level;
- pet, reaction, equip, unlock and purchase sounds are refused by the service;
- **Focus Start** plays once when a session begins (the Start Focus button itself is silent so the two
  never overlap); **Focus Complete** plays once when a completed session's summary appears;
- stopping early plays **nothing**: no failure sound, ever.

Enforced in `SoundGate` (`src/services/audio/soundPolicy.ts`) and tested.

---

## 5. Rapid-tap rules

Fast tapping must never become "POPPOPPOPPOP":

- **One voice per sound:** replaying a sound restarts its player instead of stacking a new one.
- **Retrigger floor:** the same sound can't restart within 70 ms.
- **Burst cap:** at most 2 UI sounds start in any 160 ms window (focus and reward cues are never dropped).
- **Pet taps:** at most one species cue every 0.9 s, however fast; no escalation, no combos, no counters.
- Visual feedback is never delayed or throttled: only audio is limited.

The Audio Lab's "Rapid tap ×10" button demonstrates it.

---

## 6. Where sounds come from (coverage)

- `Pressable` from `@/ui` (every screen uses it; a test forbids raw React Native pressables outside an
  allow-list) plays one cue on a successful press: explicit `sound`, or inferred from the role
  (tab → `nav`, switch → `toggle-on/off`, radio → `select`, Back/Close/Cancel → `back`, else `tap`).
  `sound={null}` marks a deliberate silence. Disabled presses never fire, so they are silent.
- `Button`: primary → `primary`, others → `tap`, Back/Cancel labels → `back`; overridable.
- Settings switches (`SettingRow`): `toggle-on` / `toggle-off`. Tab bars: `nav`.
- Domain moments: `equip` (a piece lands on the pet), `purchase` / `unavailable` (from the purchase
  result), `unlock` (with the reveal's pop), `confirm` (Save look, Room Studio Done, mission
  celebration), focus cues (from state changes in `SoundBridge`), pet cues (ordinary taps on Home),
  reaction accents (with the reaction's first beat).
- Continuous controls (room colour sliders) are silent while dragging; presets use `select`.

Run `node tools/audio-audit.mjs` to regenerate `docs/AUDIO_COVERAGE.md` (every interactive element,
by screen, with intentional silences).

---

## 7. Architecture

```
screens / components ──playSound('equip')──▶ SoundService ──▶ SoundBackend (ExpoSoundBackend | Silent)
                                                  │  SoundGate: setting, focus rules, rate limits
                                                  └─ HapticBackend (light, optional, native only)
config/sounds.ts: semantic IDs → file, level, duration, status, provenance
services/audio/soundAssets.ts: static requires (bundled, never downloaded)
features/sound/SoundBridge.tsx: settings + focus state → service; focus cues
```

- Game logic never plays or knows about sounds.
- **Preloading:** the common UI sounds are loaded at start-up; the rest 1.5 s later. One cached player
  per sound; no repeated decoding; `dispose()` releases players.
- **Preference:** `profile.settings.soundEnabled` (default on, persisted, applies immediately).
  Sound Effects and Reduce Motion are independent; every combination works.
- **Haptics:** the existing Haptics setting now drives light haptics paired with a few cues
  (primary, toggles, select, equip, confirm, purchase, unlock, focus complete); native only.

---

## 8. Platform behaviour

Implemented with **expo-audio ~57.0.5** (the SDK 57 audio module, installed via the SDK's bundled
version map), plus expo-haptics ~57.0.3.

- **Audio session:** `interruptionMode: 'mixWithOthers'` (music and podcasts keep playing, Focusling
  never ducks or stops them), `playsInSilentMode: false` (iOS silent switch mutes Focusling UI sounds),
  `shouldPlayInBackground: false`, `allowsRecording: false`.
- **Config plugin:** playback only: `microphonePermission: false`, `recordAudioAndroid: false`,
  `enableBackgroundPlayback: false` (no microphone or background-audio permissions are added).
- **Web:** HTML audio via expo-audio's web implementation; browsers only allow sound after the first
  user gesture, and there is no silent-switch concept. Haptics are unavailable on web.
- **Android:** the silent-mode behaviour follows the media volume stream; mixing with other audio is
  requested but device/OEM behaviour must be checked on hardware.
- A missing native module (e.g. an old dev client) just means silence; nothing else breaks.
  Adding expo-audio requires a new development build (`eas build --profile development`).

---

## 9. Provenance

Every file in `assets/sfx/` is **original**, synthesised for Focusling by `tools/sfx/generate.py`
from sine tones, exponential pitch sweeps, soft filtered noise and a tiny Karplus-Strong pluck, with
envelopes and a gentle low-pass. **No samples, recordings, libraries or third-party sounds**, and
nothing modelled on a recognisable product sound. The script is deterministic (fixed noise seeds),
so anyone can regenerate the exact files and verify their origin.

---

## 10. Replacing sounds (sound-designer workflow)

1. Design the new sound to the feeling, length and level in §2; keep it one family with the rest.
2. Export 22.05–44.1 kHz mono WAV (or AAC/M4A if the file grows), peak around −1 dBFS, no leading
   silence (latency), no trailing silence beyond the tail.
3. Replace `assets/sfx/<id>.wav` (same name). If the format changes, update the extension in
   `src/services/audio/soundAssets.ts`.
4. In `src/config/sounds.ts`, set `status: 'final'`, update `provenance` (designer, licence) and
   `durationMs`, and rebalance `volume` by ear on a real phone.
5. Preview everything in Developer tools → **Audio Lab**; run `npm test` (registry, sizes, lengths).
6. Listen on physical iOS and Android devices at low and high volume, with music playing, and with
   the silent switch on.

---

## 11. Physical-device checklist (not provable by tests or screenshots)

Perceived loudness at typical volumes · latency from press to sound · rapid tapping feel · mixing with
music/podcasts (no ducking) · iOS silent switch · Android media-volume behaviour · small-speaker
quality (bass-light phones) · Bluetooth headphone latency · whether the sounds actually feel
satisfying and "Focusling".
