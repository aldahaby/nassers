import type { ReactionDef, ReactionId } from '@/core/models';

/**
 * Reactions: short pet behaviours (1–3 s), not clothing. Starter reactions are
 * owned by everyone; each collection unlocks one when it's completed.
 * Rendering lives in `features/pet/reactions.tsx` (full + Reduce Motion).
 */
export const REACTIONS: readonly ReactionDef[] = [
  { id: 'wave', name: 'Wave', description: 'A friendly little hello.', style: 'wave', unlock: { kind: 'starter' }, durationMs: 1400 },
  { id: 'happy-hop', name: 'Happy Hop', description: 'Two big happy bounces.', style: 'hop', unlock: { kind: 'starter' }, durationMs: 1300 },
  { id: 'sleepy', name: 'Sleepy', description: 'A cosy little snooze.', style: 'sleepy', unlock: { kind: 'starter' }, durationMs: 2200 },
  { id: 'cool-pose', name: 'Cool Pose', description: 'A confident lean and a wink.', style: 'cool', unlock: { kind: 'starter' }, durationMs: 1500 },
  { id: 'star-twirl', name: 'Star Twirl', description: 'A spin with a trail of stars.', style: 'twirl', unlock: { kind: 'collection', collectionId: 'focus-club' }, durationMs: 1400 },
  { id: 'pixel-pop', name: 'Pixel Pop', description: 'Chunky pixels burst out, then a playful pose.', style: 'pixel-pop', unlock: { kind: 'collection', collectionId: 'midnight-arcade' }, durationMs: 1400 },
  { id: 'dream-float', name: 'Dream Float', description: 'Drifts up among tiny stars, then settles.', style: 'dream-float', unlock: { kind: 'collection', collectionId: 'dreamwave' }, durationMs: 2200 },
  { id: 'victory-lap', name: 'Victory Lap', description: 'A quick lap with speed lines and a winner’s hop.', style: 'victory-lap', unlock: { kind: 'collection', collectionId: 'cloud-racer' }, durationMs: 1800 },
];

/** What a new pet uses before the player picks a favourite. */
export const DEFAULT_REACTION: ReactionId = 'happy-hop';

export const STARTER_REACTIONS: readonly ReactionId[] = REACTIONS.filter((r) => r.unlock.kind === 'starter').map((r) => r.id);

/** Tapping the pet performs the favourite reaction on every Nth tap (never during focus). */
export const REACTION_TAP_EVERY = 4;

const BY_ID = new Map(REACTIONS.map((r) => [r.id, r]));
export function getReaction(id: string): ReactionDef | undefined {
  return BY_ID.get(id);
}
