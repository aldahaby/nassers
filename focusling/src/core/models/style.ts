import type { Id } from './common';
import type { AccessorySlot } from './inventory';

/**
 * Style system: collections and reactions. Static definitions live in
 * `config/collections.ts` and `config/reactions.ts`; this file holds the types.
 */

export type ReactionId = string;

/** How a pet reaction is performed. Each style has a full and a Reduce Motion rendering. */
export type ReactionStyle = 'wave' | 'hop' | 'sleepy' | 'cool' | 'twirl' | 'pixel-pop' | 'dream-float' | 'victory-lap' | 'firefly';

/**
 * A presentation-only grouping of reactions: how the pet expresses itself.
 * No stats, no bonuses, no quiz; it only changes copy and grouping.
 */
export type PersonalityId = 'calm' | 'hype' | 'dreamy' | 'cool';

export type ReactionUnlock = { kind: 'starter' } | { kind: 'collection'; collectionId: string };

export interface ReactionDef {
  id: ReactionId;
  name: string;
  description: string;
  style: ReactionStyle;
  personality: PersonalityId;
  unlock: ReactionUnlock;
  /** Full-motion length. Reduce Motion versions are shorter or equal. */
  durationMs: number;
}

/**
 * How long a collection is offered. Every collection so far is permanent; a
 * future seasonal window needs its own product decision (Family Mode, no FOMO).
 */
export type CollectionAvailability = { kind: 'permanent' };

/**
 * Who owns a collection's design. All current collections are first-party.
 * A licensed collaboration would add a `licensed` variant carrying the partner,
 * attribution text, licence reference, territories and post-term rules (see
 * docs/COSMETICS.md). Nothing here assumes every collection is first-party.
 */
export type CollectionOrigin = { kind: 'first-party'; designer: string };

export interface CollectionPalette {
  primary: string;
  secondary: string;
  accent: string;
  /** Dark tone for badges and headers. */
  ink: string;
  /** Soft background for the collection's stage. */
  wash: string;
}

export interface CosmeticCollection {
  id: string;
  name: string;
  /** One short line of personality copy. */
  tagline: string;
  description: string;
  /** Art-direction keywords (docs and QA, not shown as-is). */
  theme: string;
  palette: CollectionPalette;
  /** Badge artwork key (`ui/style/CollectionBadge.tsx`). */
  badge: string;
  /** The curated outfit. Separate from the player's personal saved Looks. */
  featuredLook: Partial<Record<AccessorySlot, Id>>;
  /** Unlocked once, when every piece of the collection is owned. */
  reaction: ReactionId;
  /** Optional matching room decoration (sold in the Shop; not part of completion). */
  roomAccent?: Id;
  availability: CollectionAvailability;
  origin: CollectionOrigin;
  /** Display order in the collection browser. */
  order: number;
}
