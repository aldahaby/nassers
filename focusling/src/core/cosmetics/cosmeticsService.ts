import { COSMETICS } from '@/config/cosmetics';
import { CATALOG, EARNED_ITEMS, getShopItem } from '@/config/shopCatalog';
import { getProgression } from '../progression/progressionService';
import { createId } from '../shared/ids';
import type {
  AccessorySlot,
  CosmeticsState,
  GameSave,
  Id,
  SavedLook,
  ShopItem,
  Timestamp,
  UnlockRule,
} from '../models';

const STAGE_ORDER = ['baby', 'young', 'adult', 'evolved'] as const;
export const WEARABLE_SLOTS: readonly AccessorySlot[] = ['head', 'face', 'neck', 'charm', 'aura'];

export function createCosmeticsState(): CosmeticsState {
  return { newItemIds: [], looks: Array.from({ length: COSMETICS.maxLooks }, () => null) };
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
export function saveLook(save: GameSave, index: number, now: Timestamp): GameSave {
  if (index < 0 || index >= COSMETICS.maxLooks) return save;
  const equipped: SavedLook['equipped'] = {};
  for (const slot of WEARABLE_SLOTS) {
    const id = save.inventory.equipped[slot];
    if (id) equipped[slot] = id;
  }
  const looks = [...save.cosmetics.looks];
  looks[index] = { id: createId('look'), equipped, savedAt: now };
  return { ...save, cosmetics: { ...save.cosmetics, looks } };
}

/** Wear a saved look. Wearable slots not in the look are cleared; room decor is untouched. */
export function applyLook(save: GameSave, index: number): GameSave {
  const look = save.cosmetics.looks[index];
  if (!look) return save;
  const equipped = { ...save.inventory.equipped };
  for (const slot of WEARABLE_SLOTS) {
    const id = look.equipped[slot];
    const item = id ? getShopItem(id) : undefined;
    if (id && item?.equipSlot === slot && (save.inventory.items[id]?.quantity ?? 0) > 0) equipped[slot] = id;
    else delete equipped[slot];
  }
  return { ...save, inventory: { ...save.inventory, equipped } };
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
