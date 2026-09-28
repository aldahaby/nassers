import { COLLECTION_LIST, getCollection } from '@/config/collections';
import { COSMETICS } from '@/config/cosmetics';
import { DEFAULT_REACTION, getReaction, STARTER_REACTIONS } from '@/config/reactions';
import { CATALOG, EARNED_ITEMS, getShopItem } from '@/config/shopCatalog';
import { fail, ok, type Result } from '../shared/result';
import { getProgression } from '../progression/progressionService';
import { createId } from '../shared/ids';
import type {
  AccessorySlot,
  CosmeticsState,
  GameSave,
  Id,
  ReactionId,
  SavedLook,
  ShopItem,
  Timestamp,
  UnlockRule,
} from '../models';

const STAGE_ORDER = ['baby', 'young', 'adult', 'evolved'] as const;
export const WEARABLE_SLOTS: readonly AccessorySlot[] = ['head', 'face', 'neck', 'charm', 'aura'];

export function createCosmeticsState(): CosmeticsState {
  return {
    newItemIds: [],
    looks: Array.from({ length: COSMETICS.maxLooks }, () => null),
    completedCollections: [],
    reactions: { unlocked: [...STARTER_REACTIONS], equipped: DEFAULT_REACTION },
  };
}

export function itemSource(item: ShopItem) {
  return item.source ?? 'shop';
}

export function isWearable(item: ShopItem): boolean {
  return item.equipSlot !== undefined && (WEARABLE_SLOTS as readonly string[]).includes(item.equipSlot);
}

export interface UnlockProgress {
  current: number;
  target: number;
  done: boolean;
}

/** How far the save is toward a milestone. Always derived from real stats. */
export function unlockProgress(save: GameSave, rule: UnlockRule): UnlockProgress {
  const make = (current: number, target: number) => ({ current: Math.min(current, target), target, done: current >= target });
  switch (rule.kind) {
    case 'sessions':
      return make(save.stats.sessionsCompleted, rule.count);
    case 'focusMinutes':
      return make(save.stats.totalFocusMinutes, rule.minutes);
    case 'missions':
      return make(save.stats.missionsCompleted, rule.count);
    case 'dayStreak':
      return make(Math.max(save.streak.bestDays, save.streak.currentDays), rule.days);
    case 'stage': {
      const stage = save.pet ? getProgression(save.pet.lifetimeXp).stage : 'baby';
      return make(STAGE_ORDER.indexOf(stage), STAGE_ORDER.indexOf(rule.stage));
    }
  }
}

function qualifies(save: GameSave, item: ShopItem): boolean {
  if (item.source === 'starter') return true;
  return item.source === 'earned' && item.unlock !== undefined && unlockProgress(save, item.unlock).done;
}

/**
 * Grant every starter/earned item the save now qualifies for and doesn't own.
 * Idempotent: owned items are skipped, so an item can only be granted once no
 * matter how often this runs (after sessions, on launch, after reloads).
 */
export function grantUnlocks(save: GameSave, now: Timestamp): { save: GameSave; unlocked: Id[] } {
  const unlocked = EARNED_ITEMS.filter((item) => !save.inventory.items[item.id] && qualifies(save, item)).map((i) => i.id);
  if (unlocked.length === 0) return { save, unlocked };
  const items = { ...save.inventory.items };
  for (const id of unlocked) items[id] = { itemId: id, acquiredAt: now, quantity: 1, lastUsedAt: null };
  return {
    save: {
      ...save,
      inventory: { ...save.inventory, items },
      cosmetics: { ...save.cosmetics, newItemIds: [...new Set([...save.cosmetics.newItemIds, ...unlocked])] },
    },
    unlocked,
  };
}

/** The locked earned item closest to unlocking, for an honest "next up" line. */
export function nextUnlock(save: GameSave): { item: ShopItem; progress: UnlockProgress } | null {
  let best: { item: ShopItem; progress: UnlockProgress; ratio: number } | null = null;
  for (const item of EARNED_ITEMS) {
    if (item.source !== 'earned' || !item.unlock || save.inventory.items[item.id]) continue;
    const progress = unlockProgress(save, item.unlock);
    if (progress.done) continue;
    const ratio = progress.target > 0 ? progress.current / progress.target : 0;
    if (!best || ratio > best.ratio) best = { item, progress, ratio };
  }
  return best && { item: best.item, progress: best.progress };
}

export function markItemsSeen(save: GameSave, ids: readonly Id[]): GameSave {
  if (!ids.some((id) => save.cosmetics.newItemIds.includes(id))) return save;
  return { ...save, cosmetics: { ...save.cosmetics, newItemIds: save.cosmetics.newItemIds.filter((id) => !ids.includes(id)) } };
}

/** Save what's worn in the wearable slots into look slot `index`. */
export function saveLook(save: GameSave, index: number, now: Timestamp, name?: string): GameSave {
  if (index < 0 || index >= COSMETICS.maxLooks) return save;
  const previous = save.cosmetics.looks[index];
  const equipped: SavedLook['equipped'] = {};
  for (const slot of WEARABLE_SLOTS) {
    const id = save.inventory.equipped[slot];
    if (id) equipped[slot] = id;
  }
  const looks = [...save.cosmetics.looks];
  looks[index] = { id: createId('look'), name: name ?? previous?.name, equipped, savedAt: now };
  return { ...save, cosmetics: { ...save.cosmetics, looks } };
}

export const LOOK_NAME_MAX_LENGTH = 20;

export function renameLook(save: GameSave, index: number, name: string): GameSave {
  const look = save.cosmetics.looks[index];
  if (!look) return save;
  const clean = name.trim().slice(0, LOOK_NAME_MAX_LENGTH);
  const looks = [...save.cosmetics.looks];
  looks[index] = { ...look, name: clean || undefined };
  return { ...save, cosmetics: { ...save.cosmetics, looks } };
}

export function lookName(look: SavedLook, index: number): string {
  return look.name || `Look ${index + 1}`;
}

/** Wear a saved look. Wearable slots not in the look are cleared; room decor is untouched. */
export function applyLook(save: GameSave, index: number): GameSave {
  const look = save.cosmetics.looks[index];
  return look ? wearOutfit(save, look.equipped) : save;
}

/**
 * Wear an outfit: wearable slots become exactly the outfit's owned, valid pieces
 * (unknown, legacy or unowned ids are skipped), conflicts resolved in slot
 * order. Room decor is untouched.
 */
export function wearOutfit(save: GameSave, outfit: Partial<Record<AccessorySlot, Id>>): GameSave {
  let equipped = { ...save.inventory.equipped };
  for (const slot of WEARABLE_SLOTS) delete equipped[slot];
  for (const slot of WEARABLE_SLOTS) {
    const id = outfit[slot];
    const item = id ? getShopItem(id) : undefined;
    if (id && item?.equipSlot === slot && (save.inventory.items[id]?.quantity ?? 0) > 0) equipped = withEquipped(equipped, id);
  }
  return { ...save, inventory: { ...save.inventory, equipped } };
}

/**
 * Put `itemId` in its slot, quietly taking off anything it can't be worn with:
 * items in slots it excludes, and items that exclude its slot.
 */
export function withEquipped(equipped: GameSave['inventory']['equipped'], itemId: Id): GameSave['inventory']['equipped'] {
  const item = getShopItem(itemId);
  if (!item?.equipSlot) return equipped;
  const next = { ...equipped };
  for (const [slot, otherId] of Object.entries(next)) {
    if (!otherId || slot === item.equipSlot) continue;
    const other = getShopItem(otherId);
    const blocked = item.excludes?.includes(slot as AccessorySlot) || other?.excludes?.includes(item.equipSlot as AccessorySlot);
    if (blocked) delete next[slot as keyof typeof next];
  }
  next[item.equipSlot] = itemId;
  return next;
}

/** Items that equipping `itemId` would take off (for a gentle "swapped" note). */
export function conflictsFor(equipped: GameSave['inventory']['equipped'], itemId: Id): Id[] {
  const after = withEquipped(equipped, itemId);
  const item = getShopItem(itemId);
  return Object.entries(equipped)
    .filter(([slot, id]) => id && slot !== item?.equipSlot && !(slot in after))
    .map(([, id]) => id as Id);
}

// ── Collections ──────────────────────────────────────────────────────────────

/** The wearable pieces of a collection (room accents don't count toward completion). */
export function collectionItemIds(collectionId: string): Id[] {
  return CATALOG.filter((i) => i.collection === collectionId && isWearable(i)).map((i) => i.id);
}

export interface CollectionProgress {
  owned: number;
  total: number;
  complete: boolean;
  /** Recorded (and rewarded) completion. */
  celebrated: boolean;
}

export function collectionProgress(save: GameSave, collectionId: string): CollectionProgress {
  const ids = collectionItemIds(collectionId);
  const owned = ids.filter((id) => (save.inventory.items[id]?.quantity ?? 0) > 0).length;
  return {
    owned,
    total: ids.length,
    complete: ids.length > 0 && owned === ids.length,
    celebrated: save.cosmetics.completedCollections.includes(collectionId),
  };
}

/** Wear a collection's curated Look (the owned pieces of it). Personal Looks are untouched. */
export function wearCollectionLook(save: GameSave, collectionId: string): GameSave {
  const collection = getCollection(collectionId);
  return collection ? wearOutfit(save, collection.featuredLook) : save;
}

export interface StyleRewards {
  save: GameSave;
  /** Newly granted starter/earned items. */
  unlocked: Id[];
  /** Collections completed for the first time. */
  completedCollections: string[];
  /** Reactions unlocked by those completions. */
  unlockedReactions: ReactionId[];
}

/**
 * Record collections that are now complete and unlock their reactions. Each
 * collection completes once (it's remembered), so reloads, re-runs and later
 * purchases never repeat the reward. Also ensures starter reactions exist.
 */
export function checkCollections(save: GameSave): Omit<StyleRewards, 'unlocked'> {
  let reactions = save.cosmetics.reactions;
  const missingStarters = STARTER_REACTIONS.filter((id) => !reactions.unlocked.includes(id));
  if (missingStarters.length) reactions = { ...reactions, unlocked: [...reactions.unlocked, ...missingStarters] };

  const completed: string[] = [];
  const unlockedReactions: ReactionId[] = [];
  for (const collection of COLLECTION_LIST) {
    if (save.cosmetics.completedCollections.includes(collection.id)) continue;
    if (!collectionProgress(save, collection.id).complete) continue;
    completed.push(collection.id);
    if (!reactions.unlocked.includes(collection.reaction)) {
      reactions = { ...reactions, unlocked: [...reactions.unlocked, collection.reaction] };
      unlockedReactions.push(collection.reaction);
    }
  }
  if (!completed.length && reactions === save.cosmetics.reactions) return { save, completedCollections: [], unlockedReactions: [] };
  return {
    save: {
      ...save,
      cosmetics: {
        ...save.cosmetics,
        reactions,
        completedCollections: [...save.cosmetics.completedCollections, ...completed],
      },
    },
    completedCollections: completed,
    unlockedReactions,
  };
}

/** Everything the style system awards after a state change: unlocks, then completions. */
export function processStyleRewards(save: GameSave, now: Timestamp): StyleRewards {
  const granted = grantUnlocks(save, now);
  const checked = checkCollections(granted.save);
  return { ...checked, unlocked: granted.unlocked };
}

// ── Reactions ────────────────────────────────────────────────────────────────

export type ReactionError = 'unknown-reaction' | 'locked';

export function isReactionUnlocked(save: GameSave, id: ReactionId): boolean {
  return save.cosmetics.reactions.unlocked.includes(id);
}

/** Choose the favourite reaction. Locked reactions can be previewed, never equipped. */
export function equipReaction(save: GameSave, id: ReactionId): Result<GameSave, ReactionError> {
  if (!getReaction(id)) return fail('unknown-reaction');
  if (!isReactionUnlocked(save, id)) return fail('locked');
  return ok({ ...save, cosmetics: { ...save.cosmetics, reactions: { ...save.cosmetics.reactions, equipped: id } } });
}

/** The reaction the pet should use on its own, if any. */
export function favoriteReaction(save: GameSave): ReactionId | null {
  const id = save.cosmetics.reactions.equipped;
  return id && isReactionUnlocked(save, id) && getReaction(id) ? id : null;
}

export function clearLook(save: GameSave, index: number): GameSave {
  const looks = [...save.cosmetics.looks];
  if (index < 0 || index >= looks.length) return save;
  looks[index] = null;
  return { ...save, cosmetics: { ...save.cosmetics, looks } };
}

export type WardrobeState = 'equipped' | 'owned' | 'earnable' | 'buyable';

export interface WardrobeEntry {
  item: ShopItem;
  state: WardrobeState;
  isNew: boolean;
  /** For earnable items. */
  progress: UnlockProgress | null;
}

/** Every wearable with its state: collection pieces first, then classic shop accessories. */
export function getWardrobe(save: GameSave): WardrobeEntry[] {
  const wearables = CATALOG.filter(isWearable);
  const ordered = [...wearables.filter((i) => i.collection), ...wearables.filter((i) => !i.collection)];
  return ordered.map((item) => {
    const owned = (save.inventory.items[item.id]?.quantity ?? 0) > 0;
    const equipped = owned && save.inventory.equipped[item.equipSlot!] === item.id;
    const state: WardrobeState = equipped ? 'equipped' : owned ? 'owned' : itemSource(item) === 'shop' ? 'buyable' : 'earnable';
    return {
      item,
      state,
      isNew: save.cosmetics.newItemIds.includes(item.id),
      progress: state === 'earnable' && item.unlock ? unlockProgress(save, item.unlock) : null,
    };
  });
}
