import type { PetSpeciesId } from '@/core/models';

export interface PetSpecies {
  id: PetSpeciesId;
  name: string;
  tagline: string;
  /** Body colours used by the pet renderer. */
  palette: {
    body: string;
    bodyShade: string;
    belly: string;
    accent: string;
    cheek: string;
  };
  suggestedNames: readonly string[];
}

/** The three original starter pets. */
export const PET_SPECIES: Record<PetSpeciesId, PetSpecies> = {
  cloudling: {
    id: 'cloudling',
    name: 'Cloudling',
    tagline: 'A soft, dreamy puff that loves calm, quiet time.',
    palette: {
      body: '#B9A8FF',
      bodyShade: '#9C87F5',
      belly: '#EEE8FF',
      accent: '#FFFFFF',
      cheek: '#FF9EC7',
    },
    suggestedNames: ['Nimbus', 'Puffin', 'Mallow', 'Drift'],
  },
  sproutling: {
    id: 'sproutling',
    name: 'Sproutling',
    tagline: 'A leafy little bean that grows with every good day.',
    palette: {
      body: '#7ED9A5',
      bodyShade: '#5BC286',
      belly: '#E3F9EC',
      accent: '#4BAE6E',
      cheek: '#FFA3A3',
    },
    suggestedNames: ['Basil', 'Pip', 'Clover', 'Sprig'],
  },
  emberling: {
    id: 'emberling',
    name: 'Emberling',
    tagline: 'A warm, bouncy spark full of get-up-and-go.',
    palette: {
      body: '#FFA66E',
      bodyShade: '#F5874A',
      belly: '#FFE9D9',
      accent: '#FFD166',
      cheek: '#FF7B7B',
    },
    suggestedNames: ['Cinder', 'Sunny', 'Toast', 'Blaze'],
  },
};

export const STARTER_SPECIES_ORDER: readonly PetSpeciesId[] = ['cloudling', 'sproutling', 'emberling'];

export const PET_NAME_MAX_LENGTH = 16;
