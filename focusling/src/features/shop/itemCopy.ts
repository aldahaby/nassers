import { slotLabel, type CatalogItem } from '@/config/shopCatalog';
import { ECONOMY } from '@/config/economy';

const pct = (value: number | undefined) => Math.round((value ?? 0) * 100);

/** "Cosmetic · Head", "Interactive · Toy"… Everything is derived from the catalog config. */
export function itemKindLabel(item: CatalogItem): string {
  switch (item.category) {
    case 'accessory':
      return `Cosmetic · worn on the ${slotLabel(item.equipSlot!).toLowerCase()}`;
    case 'decoration':
      return `Cosmetic · room, ${slotLabel(item.equipSlot!).toLowerCase()}`;
    case 'toy':
      return 'Interactive · toy';
    case 'food':
      return 'Interactive · food';
  }
}

/** Plain-language list of what an item does. */
export function itemEffects(item: CatalogItem, petName: string): string[] {
  switch (item.category) {
    case 'accessory':
      return [
        `${petName} wears it where you can see it`,
        `+${pct(item.passiveBonus?.xpPct)}% XP from focus while worn`,
        `+${item.happinessBonus} happiness when ${petName} first gets it`,
      ];
    case 'decoration':
      return [
        `Goes in the room behind ${petName}`,
        `+${pct(item.passiveBonus?.coinPct)}% coins from focus while placed`,
        `+${item.happinessBonus} happiness when it arrives`,
      ];
    case 'toy':
      return [
        `Play together any time`,
        `+${item.happinessBonus} happiness, at most once every ${item.playCooldownMinutes} min`,
        `+${item.happinessBonus} happiness when ${petName} first gets it`,
      ];
    case 'food':
      return [`+${item.healthBonus} health, +${item.happinessBonus} happiness`, 'Used up when eaten · optional treat'];
  }
}

export const BONUS_CAP_NOTE = `Item bonuses add up to at most +${pct(ECONOMY.itemBonusCaps.xpPct)}% XP and +${pct(ECONOMY.itemBonusCaps.coinPct)}% coins.`;

/** Short status for an owned item. */
export function ownedStatus(item: CatalogItem, opts: { equipped: boolean; quantity: number; cooldownMs: number }): string {
  switch (item.category) {
    case 'accessory':
      return opts.equipped ? `Wearing · ${slotLabel(item.equipSlot!)}` : 'In your closet';
    case 'decoration':
      return opts.equipped ? `In your room · ${slotLabel(item.equipSlot!)}` : 'In storage';
    case 'toy':
      return opts.cooldownMs > 0
        ? `Played recently · happiness again in ${Math.ceil(opts.cooldownMs / 60_000)} min`
        : 'Ready to play';
    case 'food':
      return `You have ${opts.quantity}`;
  }
}
