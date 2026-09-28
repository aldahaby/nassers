import type { PetSpeciesId } from '@/core';

/**
 * Per-species rendering language (docs/ART_DIRECTION.md, "Species language").
 * Colours that are about *how* a species is drawn, not what it is: kept apart
 * from `config/pets.ts` so an illustrator can retune them without touching data.
 */
export interface SpeciesArt {
  /** The feeling the drawing aims for. */
  feel: string;
  /** Tint reflected in the bottom of the eyes (ties the face to the body). */
  eyeTint: string;
  /** Soft edge light along the top of the body. */
  rim: string;
  /** Shadow tone in creases and under lobes (cool for clouds, warm for embers). */
  crease: string;
  /** Lightest point of the body gradient. */
  highlight: string;
  /** Surface cues this species uses (for docs, QA and tests). */
  cues: readonly string[];
  /** What makes a naked Evolved pet feel special. */
  evolvedFlourish: string;
}

export const SPECIES_ART: Record<PetSpeciesId, SpeciesArt> = {
  cloudling: {
    feel: 'soft, airy, squishy, dreamy',
    eyeTint: '#9C87F5',
    rim: '#FFFFFF',
    crease: '#7F6BE0',
    highlight: '#E4DCFF',
    cues: ['layered cloud lobes', 'cool creases between puffs', 'edge highlights on puffs', 'cloud-shaped belly'],
    evolvedFlourish: 'an iridescent rim along the top puffs and a small star on the belly moon',
  },
  sproutling: {
    feel: 'fresh, organic, curious, growing',
    eyeTint: '#3FA56A',
    rim: '#F2FFF6',
    crease: '#3E9E68',
    highlight: '#B7F0CC',
    cues: ['veined leaves with a lighter tip', 'stem that grows from the head', 'seed-coat side lines', 'dewdrop highlight'],
    evolvedFlourish: 'a bloom at the sprout tip and softly glowing leaf edges',
  },
  emberling: {
    feel: 'warm, energetic, glowing, cozy',
    eyeTint: '#FF8A3D',
    rim: '#FFF1C9',
    crease: '#E0663A',
    highlight: '#FFD0A8',
    cues: ['three-layer flame (red, gold, cream core)', 'warm inner body glow', 'tiny floating embers', 'tail wisp'],
    evolvedFlourish: 'two small flamelets beside the crest and a golden core glow',
  },
};
