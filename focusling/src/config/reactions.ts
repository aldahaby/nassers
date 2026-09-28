import type { PersonalityId, ReactionDef, ReactionId } from '@/core/models';

/**
 * Reactions: short pet behaviours (1–3 s), not clothing. Starter reactions are
 * owned by everyone; each collection unlocks one when it's completed.
 * Rendering lives in `features/pet/reactions.tsx` (full + Reduce Motion).
 */
export const REACTIONS: readonly ReactionDef[] = [
  { id: 'wave', name: 'Wave', description: 'A friendly little hello.', style: 'wave', personality: 'calm', unlock: { kind: 'starter' }, durationMs: 1400 },
  { id: 'happy-hop', name: 'Happy Hop', description: 'Two big happy bounces.', style: 'hop', personality: 'hype', unlock: { kind: 'starter' }, durationMs: 1300 },
  { id: 'sleepy', name: 'Sleepy', description: 'A cosy little snooze.', style: 'sleepy', personality: 'calm', unlock: { kind: 'starter' }, durationMs: 2200 },
  { id: 'cool-pose', name: 'Cool Pose', description: 'A confident lean and a wink.', style: 'cool', personality: 'cool', unlock: { kind: 'starter' }, durationMs: 1500 },
  { id: 'star-twirl', name: 'Star Twirl', description: 'A spin with a trail of stars.', style: 'twirl', personality: 'dreamy', unlock: { kind: 'collection', collectionId: 'focus-club' }, durationMs: 1400 },
  { id: 'pixel-pop', name: 'Pixel Pop', description: 'Chunky pixels burst out, then a playful pose.', style: 'pixel-pop', personality: 'cool', unlock: { kind: 'collection', collectionId: 'midnight-arcade' }, durationMs: 1400 },
  { id: 'dream-float', name: 'Dream Float', description: 'Drifts up among tiny stars, then settles.', style: 'dream-float', personality: 'dreamy', unlock: { kind: 'collection', collectionId: 'dreamwave' }, durationMs: 2200 },
  { id: 'victory-lap', name: 'Victory Lap', description: 'A quick lap with speed lines and a winner’s hop.', style: 'victory-lap', personality: 'hype', unlock: { kind: 'collection', collectionId: 'cloud-racer' }, durationMs: 1800 },
  { id: 'firefly-hello', name: 'Firefly Hello', description: 'A slow wave while a few fireflies blink hello.', style: 'firefly', personality: 'calm', unlock: { kind: 'collection', collectionId: 'moss-club' }, durationMs: 2000 },
];

export interface PersonalityDef {
  id: PersonalityId;
  name: string;
  /** One short line about how this kind of Focusling expresses itself. */
  line: string;
  /** Soft colour for chips and the Reactions tab header. */
  tint: string;
  ink: string;
}

/**
 * Personality families: presentation only (grouping, copy and tap lines).
 * Picking a favourite reaction shows which family it belongs to; there are no
 * stats, scores, quizzes or reward effects attached.
 */
export const PERSONALITIES: readonly PersonalityDef[] = [
  { id: 'calm', name: 'Calm', line: 'Soft hellos and slow blinks.', tint: '#E4F1E0', ink: '#2F4A2E' },
  { id: 'hype', name: 'Hype', line: 'Big bounces, big cheers.', tint: '#FFE6D6', ink: '#8A3413' },
  { id: 'dreamy', name: 'Dreamy', line: 'Floaty, starry, a little faraway.', tint: '#EEE6FF', ink: '#4C3A8A' },
  { id: 'cool', name: 'Cool', line: 'A wink, a pose, no rush.', tint: '#DDF3FB', ink: '#16425A' },
];

/** What the pet says when tapped, by the personality of its favourite reaction. */
export const PERSONALITY_TAP_LINES: Record<PersonalityId, readonly string[]> = {
  calm: ['Hi. Nice and slow.', 'I like it quiet like this.', 'Breathe in… and out.'],
  hype: ['Let’s gooo!', 'Again! Again!', 'You’re doing great!'],
  dreamy: ['I was dreaming about stars.', 'Everything feels floaty today.', 'Look, a cloud shaped like you.'],
  cool: ['Looking sharp.', 'No big deal. Just cool.', 'We got this.'],
};

const PERSONALITY_BY_ID = new Map(PERSONALITIES.map((p) => [p.id, p]));
export function getPersonality(id: PersonalityId): PersonalityDef {
  return PERSONALITY_BY_ID.get(id) ?? PERSONALITIES[0]!;
}

/** What a new pet uses before the player picks a favourite. */
export const DEFAULT_REACTION: ReactionId = 'happy-hop';

export const STARTER_REACTIONS: readonly ReactionId[] = REACTIONS.filter((r) => r.unlock.kind === 'starter').map((r) => r.id);

/** Tapping the pet performs the favourite reaction on every Nth tap (never during focus). */
export const REACTION_TAP_EVERY = 4;

const BY_ID = new Map(REACTIONS.map((r) => [r.id, r]));
export function getReaction(id: string): ReactionDef | undefined {
  return BY_ID.get(id);
}
