/**
 * Developer-only helpers for testing the focus loop quickly. Only reachable from
 * UI that is hidden unless the "Developer tools" setting is on.
 */
import { GROWTH_STAGES } from '@/config/progression';
import { SHOP_ITEMS } from '@/config/shopCatalog';
import { MINUTE_MS } from '../shared/dates';
import { getProgression, totalXpForLevel } from '../progression/progressionService';
import type { GameSave, Timestamp } from '../models';

export type XpPrimeTarget = 'levelUp' | 'nextStage' | 'evolution';

export function debugGrant(save: GameSave, grant: { coins?: number; xp?: number }): GameSave {
  return {
    ...save,
    wallet: { coins: save.wallet.coins + (grant.coins ?? 0) },
    pet: save.pet ? { ...save.pet, lifetimeXp: save.pet.lifetimeXp + (grant.xp ?? 0) } : null,
  };
}

/**
 * Put the pet 1 XP short of a milestone, so the next rewarded session crosses it.
 * Never lowers XP; returns the save unchanged if the milestone is already behind.
 */
export function debugPrimeXp(save: GameSave, target: XpPrimeTarget): GameSave {
  if (!save.pet) return save;
  const current = getProgression(save.pet.lifetimeXp);
  let goal: number | null;
  if (target === 'levelUp') goal = totalXpForLevel(current.level + 1);
  else if (target === 'nextStage') goal = current.nextStageAtXp;
  else goal = GROWTH_STAGES[GROWTH_STAGES.length - 1]!.minXp;

  if (goal === null || goal - 1 <= save.pet.lifetimeXp) return save;
  return { ...save, pet: { ...save.pet, lifetimeXp: goal - 1 } };
}

/** Move the active session's start back so only `remainingMs` is left. */
export function debugSetRemaining(save: GameSave, remainingMs: number, now: Timestamp): GameSave {
  const session = save.focus.active;
  if (!session) return save;
  const startedAt = now + remainingMs - session.plannedDurationMinutes * MINUTE_MS;
  return { ...save, focus: { ...save.focus, active: { ...session, startedAt } } };
}

// ── Inventory debug helpers (no coins are spent) ─────────────────────────────

/** How many of each food "unlock all" hands out. */
const DEBUG_FOOD_STACK = 5;

function withItems(save: GameSave, quantities: Record<string, number>, now: Timestamp): GameSave {
  const items: GameSave['inventory']['items'] = {};
  for (const [itemId, quantity] of Object.entries(quantities)) {
    if (quantity > 0) items[itemId] = { itemId, quantity, acquiredAt: now, lastUsedAt: null };
  }
  return { ...save, inventory: { ...save.inventory, items } };
}

/** Remove every owned item and everything equipped. */
export function debugClearInventory(save: GameSave): GameSave {
  return { ...save, inventory: { items: {}, equipped: {} } };
}

/** Own every item (a stack of each food). Keeps what's equipped. */
export function debugUnlockAll(save: GameSave, now: Timestamp): GameSave {
  const quantities = Object.fromEntries(SHOP_ITEMS.map((item) => [item.id, item.consumable ? DEBUG_FOOD_STACK : 1]));
  return withItems(save, quantities, now);
}

/** Own exactly one of every item. Keeps what's equipped. */
export function debugOwnOneOfEach(save: GameSave, now: Timestamp): GameSave {
  return withItems(save, Object.fromEntries(SHOP_ITEMS.map((item) => [item.id, 1])), now);
}

/** Take off every accessory and remove every decoration. Ownership is kept. */
export function debugResetEquipped(save: GameSave): GameSave {
  return { ...save, inventory: { ...save.inventory, equipped: {} } };
}

/** Own and equip the first item of every slot, for previewing cosmetics. */
export function debugDressUp(save: GameSave, now: Timestamp): GameSave {
  const unlocked = debugUnlockAll(save, now);
  const equipped: GameSave['inventory']['equipped'] = {};
  for (const item of SHOP_ITEMS) {
    if (item.equipSlot && !equipped[item.equipSlot]) equipped[item.equipSlot] = item.id;
  }
  return { ...unlocked, inventory: { ...unlocked.inventory, equipped } };
}
