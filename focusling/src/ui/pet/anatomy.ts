import type { PetSpeciesId } from '@/core';

/**
 * Anchor points shared by every species so accessories line up on any pet.
 * All coordinates are in the pet's 200×200 SVG space.
 */
export interface PetAnatomy {
  /** Topmost point of the head, where hats sit. */
  headTop: number;
  eyeY: number;
  eyeDx: number;
  mouthY: number;
  neckY: number;
  /** Half-width of the head at eye level, where headphones sit. */
  headHalfWidth: number;
}

export const ANATOMY: Record<PetSpeciesId, PetAnatomy> = {
  cloudling: { headTop: 66, eyeY: 110, eyeDx: 22, mouthY: 133, neckY: 158, headHalfWidth: 60 },
  sproutling: { headTop: 62, eyeY: 110, eyeDx: 21, mouthY: 133, neckY: 160, headHalfWidth: 55 },
  emberling: { headTop: 62, eyeY: 114, eyeDx: 21, mouthY: 137, neckY: 160, headHalfWidth: 56 },
};
