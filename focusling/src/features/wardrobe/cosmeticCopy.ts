import { cosmeticName } from '@/config/cosmetics';
import { ACCESSORY_SLOTS } from '@/config/shopCatalog';
import type { AccessorySlot, ShopItem, UnlockProgress, UnlockRule } from '@/core';
import { plural } from '@/utils/format';

export { cosmeticName };

/** What it takes to earn an item, in plain words. */
export function describeUnlock(rule: UnlockRule): string {
  switch (rule.kind) {
    case 'sessions':
      return rule.count === 1 ? 'Finish your first focus session' : `Finish ${rule.count} focus sessions`;
    case 'focusMinutes':
      return rule.minutes % 60 === 0 ? `Focus for ${plural(rule.minutes / 60, 'hour')} in total` : `Focus for ${rule.minutes} minutes in total`;
    case 'missions':
      return `Complete ${plural(rule.count, 'mission')}`;
    case 'dayStreak':
      return `Focus ${rule.days} days in a row`;
    case 'stage':
      return rule.stage === 'young' ? 'Grow up for the first time' : `Reach the ${rule.stage[0]!.toUpperCase()}${rule.stage.slice(1)} stage`;
  }
}

/** Short progress readout, e.g. "1 of 3" or "35 of 120 min". */
export function describeProgress(rule: UnlockRule, progress: UnlockProgress): string {
  if (rule.kind === 'focusMinutes') return `${progress.current} of ${progress.target} min`;
  if (rule.kind === 'stage') return progress.done ? 'Done' : 'Not yet';
  return `${progress.current} of ${progress.target}`;
}

/** How an owned item was obtained, for the reveal ("Earned: …"). */
export function describeEarned(item: ShopItem): string {
  if (item.source === 'starter') return 'Every Focusling starts with one';
  if (item.source === 'earned' && item.unlock) return `Earned: ${describeUnlock(item.unlock).toLowerCase()}`;
  return 'From the shop';
}

export function slotName(slot: AccessorySlot): string {
  return ACCESSORY_SLOTS[slot];
}

/** Screen-reader label for a wardrobe tile. */
export function tileLabel(item: ShopItem, state: string, progress: UnlockProgress | null): string {
  const base = `${cosmeticName(item).replace(' · ', ', ')}. ${slotName(item.equipSlot as AccessorySlot)}.`;
  switch (state) {
    case 'equipped':
      return `${base} Wearing. Double tap to take it off.`;
    case 'owned':
      return `${base} Owned. Double tap to wear.`;
    case 'buyable':
      return `${base} In the shop for ${item.price} coins. Double tap to try it on.`;
    default:
      return `${base} Locked. ${item.unlock ? describeUnlock(item.unlock) : ''}${
        item.unlock && progress ? `, ${describeProgress(item.unlock, progress)}` : ''
      }. Double tap to try it on.`;
  }
}
