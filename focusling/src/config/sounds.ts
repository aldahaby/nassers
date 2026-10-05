import type { ReactionStyle } from '@/core/models';

/**
 * Focusling's micro-sound palette (docs/AUDIO_DIRECTION.md). The app asks for
 * semantic sounds ("tap", "equip", "focus-complete"); this table maps each to
 * an asset, a mix level and its provenance. A sound designer replaces a sound
 * by replacing its file (same name) and updating `status` / `provenance` here.
 */

export type SoundId =
  | 'tap'
  | 'primary'
  | 'nav'
  | 'back'
  | 'toggle-on'
  | 'toggle-off'
  | 'select'
  | 'equip'
  | 'confirm'
  | 'unlock'
  | 'purchase'
  | 'unavailable'
  | 'focus-start'
  | 'focus-complete'
  | 'pet-cloudling'
  | 'pet-sproutling'
  | 'pet-emberling'
  | 'rx-wave'
  | 'rx-hop'
  | 'rx-sleepy'
  | 'rx-cool'
  | 'rx-twirl'
  | 'rx-pixel'
  | 'rx-dream'
  | 'rx-victory'
  | 'rx-firefly';

export type SoundGroup = 'ui' | 'reward' | 'focus' | 'pet' | 'reaction';

export interface SoundDef {
  id: SoundId;
  label: string;
  /** The intended feeling (creative direction, not a literal sample). */
  feeling: string;
  group: SoundGroup;
  /** File in assets/sfx/ (without extension). */
  file: string;
  /** Approximate length in ms (from tools/sfx/generate.py). */
  durationMs: number;
  /** Relative mix level 0–1 (files are normalised; loudness lives here). */
  volume: number;
  status: 'placeholder' | 'final';
  provenance: string;
  /** Minimum ms before this cue can restart (defaults to SOUND_RULES.retriggerMs). */
  retriggerMs?: number;
}

/** Every cue has exactly one voice: replaying restarts it, it never stacks. */
export const VOICES_PER_CUE = 1;

const GENERATED = 'Original, synthesised for Focusling by tools/sfx/generate.py (sine, sweep, soft noise and pluck models; no samples or third-party audio).';

const def = (id: SoundId, label: string, feeling: string, group: SoundGroup, durationMs: number, volume: number, retriggerMs?: number): SoundDef => ({
  id,
  label,
  feeling,
  group,
  file: id,
  durationMs,
  volume,
  status: 'placeholder',
  provenance: GENERATED,
  retriggerMs,
});

export const SOUNDS: readonly SoundDef[] = [
  def('tap', 'Standard Tap', 'a tiny soft bubble pop', 'ui', 69, 0.32),
  def('primary', 'Primary', 'a rounder, satisfying "bloop"', 'ui', 129, 0.42),
  def('nav', 'Navigation', 'a very short, light "plip"', 'ui', 49, 0.26),
  def('back', 'Back / Close', 'a softer, downward "pup"', 'ui', 80, 0.28),
  def('toggle-on', 'Toggle On', 'a tiny rising bubble', 'ui', 114, 0.32),
  def('toggle-off', 'Toggle Off', 'a tiny falling bubble', 'ui', 114, 0.3),
  def('select', 'Select', 'a soft pop with a tiny sparkle', 'ui', 144, 0.34),
  def('equip', 'Equip', 'a bloop as the piece lands, plus a little sparkle', 'reward', 269, 0.4, 200),
  def('confirm', 'Save / Confirm', 'a warm double bubble, resolved', 'reward', 309, 0.4, 250),
  def('unlock', 'Unlock / New item', 'a small magical bubbly flourish', 'reward', 660, 0.42, 600),
  def('purchase', 'Purchase (focus coins)', 'a soft, original two-note "tink", never a casino jingle', 'reward', 320, 0.36, 250),
  def('unavailable', 'Unavailable', 'a very gentle, muted "bonk"', 'ui', 120, 0.24),
  def('focus-start', 'Focus Start', 'a calm, intentional short cue', 'focus', 529, 0.34, 500),
  def('focus-complete', 'Focus Complete', 'a warm, satisfying resolve', 'focus', 780, 0.42, 700),
  def('pet-cloudling', 'Pet · Cloudling', 'a soft airy puff and bubble', 'pet', 169, 0.28),
  def('pet-sproutling', 'Pet · Sproutling', 'a tiny leaf pluck and bubble', 'pet', 169, 0.28),
  def('pet-emberling', 'Pet · Emberling', 'a tiny warm sparkle pop', 'pet', 180, 0.28),
  def('rx-wave', 'Reaction · Wave', 'a tiny friendly bubble pair', 'reaction', 219, 0.3),
  def('rx-hop', 'Reaction · Happy Hop', 'soft springy pops', 'reaction', 340, 0.3),
  def('rx-sleepy', 'Reaction · Sleepy', 'an extremely gentle airy cue', 'reaction', 500, 0.18),
  def('rx-cool', 'Reaction · Cool Pose', 'a quick "fwip" and pop', 'reaction', 179, 0.28),
  def('rx-twirl', 'Reaction · Star Twirl', 'a rising little shimmer', 'reaction', 380, 0.28),
  def('rx-pixel', 'Reaction · Pixel Pop', 'tiny digital-bubble sparkles', 'reaction', 209, 0.26),
  def('rx-dream', 'Reaction · Dream Float', 'a soft floating shimmer', 'reaction', 600, 0.24),
  def('rx-victory', 'Reaction · Victory Lap', 'a short, bright but gentle flourish', 'reaction', 429, 0.3),
  def('rx-firefly', 'Reaction · Firefly Hello', 'tiny warm glimmers', 'reaction', 489, 0.24),
];

const BY_ID = new Map(SOUNDS.map((s) => [s.id, s]));
export function getSound(id: SoundId): SoundDef {
  return BY_ID.get(id)!;
}

/** The accent each reaction style plays (short, once, never during focus). */
export const REACTION_SOUNDS: Record<ReactionStyle, SoundId> = {
  wave: 'rx-wave',
  hop: 'rx-hop',
  sleepy: 'rx-sleepy',
  cool: 'rx-cool',
  twirl: 'rx-twirl',
  'pixel-pop': 'rx-pixel',
  'dream-float': 'rx-dream',
  'victory-lap': 'rx-victory',
  firefly: 'rx-firefly',
};

/**
 * Rules that keep sound calm (docs/AUDIO_DIRECTION.md):
 * - rapid taps never pile up (per-sound retrigger floor + a global cap);
 * - during an active focus session only explicit presses (very soft) and the
 *   start/complete cues are allowed: no pet, reaction or reward sounds;
 * - one pet sound at most every `petMinMs`, however fast someone taps.
 */
export const SOUND_RULES = {
  masterVolume: 0.9,
  /** The same sound can't restart sooner than this. */
  retriggerMs: 70,
  /** At most `burstMax` sounds start within `burstWindowMs`. */
  burstWindowMs: 160,
  burstMax: 2,
  /** Pet taps: one sound at most this often. */
  petMinMs: 900,
  /** Explicit presses during focus play at this fraction of their level. */
  focusVolume: 0.55,
  /** Sounds allowed during an active focus session. */
  focusAllowed: ['tap', 'primary', 'nav', 'back', 'toggle-on', 'toggle-off', 'select', 'confirm', 'unavailable', 'focus-start', 'focus-complete'] as readonly SoundId[],
} as const;
