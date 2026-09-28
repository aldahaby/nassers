import { createContext, useContext, useId } from 'react';

/**
 * SVG gradient ids must be unique per drawing on web: two screens can be
 * mounted at once (a hidden one behind a pushed one), and `url(#id)` resolves
 * to the first matching element in the whole document. Each PetArt / ItemArt
 * gets a scope; gradient ids end with it.
 *
 * - Components (MaterialDefs, PetBody, PetFace, crests) read the scope from context.
 * - Art functions that build `url(#…)` strings inline read `currentArtScope()`,
 *   which the owning PetArt/ItemArt sets synchronously just before it calls them.
 */
export const ArtScope = createContext('');
let current = '';

/** Marks `scope` as the one inline art functions use (called just before they run). */
function enterArtScope(scope: string) {
  current = scope;
}

/** Call at the top of a component that renders art; returns its scope and makes it current. */
export function useNewArtScope(): string {
  const scope = useId().replace(/[^a-zA-Z0-9]/g, '');
  enterArtScope(scope);
  return scope;
}

export const currentArtScope = () => current;
export const useArtScope = () => useContext(ArtScope);
