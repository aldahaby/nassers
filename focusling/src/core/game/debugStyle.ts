import { COLLECTION_LIST, getCollection } from '@/config/collections';
import { DEFAULT_REACTION, REACTIONS } from '@/config/reactions';
import { getShopItem } from '@/config/shopCatalog';
import { getStageDefinitionById } from '../progression/progressionService';
import { collectionItemIds, WEARABLE_SLOTS } from '../cosmetics/cosmeticsService';
import type { GameSave, GrowthStage, Id, PetSpeciesId, Timestamp } from '../models';

/** Developer-only style helpers (the store refuses them unless Developer tools are on). */

function withOwned(save: GameSave, ids: readonly Id[], now: Timestamp): GameSave {
  const items = { ...save.inventory.items };
  for (const id of ids) if (!items[id]) items[id] = { itemId: id, acquiredAt: now, quantity: 1, lastUsedAt: null };
  return { ...save, inventory: { ...save.inventory, items } };
}

function forgetCompletion(save: GameSave, collectionIds: readonly string[]): GameSave {
  const reactionsToLock = collectionIds.map((id) => getCollection(id)?.reaction).filter(Boolean) as string[];
  const unlocked = save.cosmetics.reactions.unlocked.filter((r) => !reactionsToLock.includes(r));
  const equipped = save.cosmetics.reactions.equipped && unlocked.includes(save.cosmetics.reactions.equipped) ? save.cosmetics.reactions.equipped : DEFAULT_REACTION;
  return {
    ...save,
    cosmetics: {
      ...save.cosmetics,
      completedCollections: save.cosmetics.completedCollections.filter((c) => !collectionIds.includes(c)),
      reactions: { unlocked, equipped },
    },
  };
}

/** Own every piece of a collection (completion is then recorded by checkCollections). */
export function debugUnlockCollection(save: GameSave, collectionId: string, now: Timestamp): GameSave {
  if (getCollection(collectionId)?.access === 'premium') return save; // Premium is never owned
  return withOwned(save, collectionItemIds(collectionId), now);
}

/**
 * Own all but one piece, and forget any completion so it can be earned again.
 * The missing piece is a coin piece when there is one, so it can be bought.
 */
export function debugCollectionAlmostDone(save: GameSave, collectionId: string, now: Timestamp): { save: GameSave; missing: Id | null } {
  if (getCollection(collectionId)?.access === 'premium') return { save, missing: null };
  const ids = collectionItemIds(collectionId);
  const missing = ids.find((id) => (getShopItem(id)?.source ?? 'shop') === 'shop') ?? ids[ids.length - 1] ?? null;
  let next = forgetCompletion(withOwned(save, ids.filter((id) => id !== missing), now), [collectionId]);
  if (missing) next = removeItems(next, [missing]);
  return { save: next, missing };
}

function removeItems(save: GameSave, ids: readonly Id[]): GameSave {
  const items = { ...save.inventory.items };
  const equipped = { ...save.inventory.equipped };
  for (const id of ids) {
    delete items[id];
    for (const [slot, eq] of Object.entries(equipped)) if (eq === id) delete equipped[slot as keyof typeof equipped];
  }
  return {
    ...save,
    inventory: { items, equipped },
    cosmetics: { ...save.cosmetics, newItemIds: save.cosmetics.newItemIds.filter((i) => !ids.includes(i)) },
  };
}

/** Lock the three style-system collections again (Focus Club is left alone). */
export function debugResetCollections(save: GameSave): GameSave {
  const ids = COLLECTION_LIST.filter((c) => c.id !== 'focus-club').map((c) => c.id);
  const pieces = ids.flatMap((id) => [...collectionItemIds(id), ...(getCollection(id)?.roomAccent ? [getCollection(id)!.roomAccent!] : [])]);
  return forgetCompletion(removeItems(save, pieces), ids);
}

export function debugUnlockReactions(save: GameSave): GameSave {
  return { ...save, cosmetics: { ...save.cosmetics, reactions: { ...save.cosmetics.reactions, unlocked: REACTIONS.map((r) => r.id) } } };
}

export function debugClearOutfit(save: GameSave): GameSave {
  const equipped = { ...save.inventory.equipped };
  for (const slot of WEARABLE_SLOTS) delete equipped[slot];
  return { ...save, inventory: { ...save.inventory, equipped } };
}

/** Jump the pet to a growth stage (sets lifetime XP to the stage's threshold). */
export function debugSetStage(save: GameSave, stage: GrowthStage): GameSave {
  if (!save.pet) return save;
  return { ...save, pet: { ...save.pet, lifetimeXp: getStageDefinitionById(stage).minXp } };
}

export function debugSetSpecies(save: GameSave, speciesId: PetSpeciesId): GameSave {
  return save.pet ? { ...save, pet: { ...save.pet, speciesId } } : save;
}
