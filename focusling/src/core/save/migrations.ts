import { DEFAULT_PROTECTION } from '@/config/protection';
import { getShopItem } from '@/config/shopCatalog';
import { CURRENT_SCHEMA_VERSION, type GameSave } from '../models';
import { normalizeRoomColor } from '../room/roomService';

type RawSave = Record<string, unknown>;
type RawRecord = Record<string, unknown>;

/** Item ids renamed between catalog versions. */
const RENAMED_ITEMS: Record<string, string> = { 'food-veggie-bowl': 'food-fruit-bowl' };

/**
 * Upgrades an older save to the current schema. Each entry migrates from
 * version N to N+1. Add one whenever GameSave changes shape.
 */
const MIGRATIONS: Record<number, (save: RawSave) => RawSave> = {
  // v1 → v2: shop milestone. Purchase stats, renamed items, headphones moved from
  // the retired "ears" slot to "head".
  1: (save) => {
    const inventory = (save.inventory ?? { items: {}, equipped: {} }) as { items: RawRecord; equipped: RawRecord };
    const items: RawRecord = {};
    for (const [id, entry] of Object.entries(inventory.items ?? {})) {
      const newId = RENAMED_ITEMS[id] ?? id;
      items[newId] = { ...(entry as RawRecord), itemId: newId };
    }
    const equipped: RawRecord = { ...(inventory.equipped ?? {}) };
    if (typeof equipped.ears === 'string') {
      if (!equipped.head) equipped.head = equipped.ears;
      delete equipped.ears;
    }
    const stats = (save.stats ?? {}) as RawRecord;
    return {
      ...save,
      inventory: { items, equipped },
      stats: { itemsPurchased: Object.keys(items).length, coinsSpent: 0, ...stats },
      schemaVersion: 2,
    };
  },
  // v2 → v3: focus protection settings; sessions remember their protection mode.
  2: (save) => {
    const focus = (save.focus ?? { active: null, history: [] }) as { active: RawRecord | null; history: RawRecord[] };
    const withMode = (s: RawRecord) => ({ protectionMode: 'none', ...s });
    return {
      ...save,
      protection: { ...DEFAULT_PROTECTION, surfaces: [...DEFAULT_PROTECTION.surfaces] },
      focus: { active: focus.active ? withMode(focus.active) : null, history: (focus.history ?? []).map(withMode) },
      schemaVersion: 3,
    };
  },
  // v3 → v4: Family Mode, Missions and Play. Every existing save is a self-use save;
  // nothing else changes (pet, coins, inventory, history, settings, protection).
  3: (save) => {
    const daily = Object.fromEntries(
      Object.entries((save.daily ?? {}) as Record<string, RawRecord>).map(([k, d]) => [
        k,
        { missionsCompleted: 0, missionCoinsEarned: 0, ...d },
      ]),
    );
    return {
      ...save,
      daily,
      mode: 'self',
      family: null,
      missions: { items: [], progress: {} },
      play: { date: null, coinsEarned: 0, happinessEarned: 0, completions: {}, rewardedRounds: [], debugUnlockedDate: null },
      schemaVersion: 4,
    };
  },
  // v4 → v5: cosmetics (new-item badges, saved looks) and a lifetime missions count.
  // Accessories become stat-neutral in config; owned and equipped items are untouched.
  // Starter/earned items a save already qualifies for are granted on load (grantUnlocks).
  4: (save) => {
    const daily = Object.values((save.daily ?? {}) as Record<string, { missionsCompleted?: number }>);
    const stats = (save.stats ?? {}) as RawRecord;
    return {
      ...save,
      stats: { missionsCompleted: daily.reduce((n, d) => n + (d.missionsCompleted ?? 0), 0), ...stats },
      cosmetics: { newItemIds: [], looks: [null, null, null] },
      schemaVersion: 5,
    };
  },
  // v5 → v6: style system. Records collection completions and reactions (starter
  // reactions for everyone; favourite = Happy Hop). Owned/equipped cosmetics and
  // saved Looks are untouched. Completions already earned are recorded on load
  // by checkCollections.
  5: (save) => {
    const cosmetics = (save.cosmetics ?? {}) as RawRecord;
    return {
      ...save,
      cosmetics: {
        newItemIds: [],
        looks: [null, null, null],
        ...cosmetics,
        completedCollections: [],
        reactions: { unlocked: ['wave', 'happy-hop', 'sleepy', 'cool-pose'], equipped: 'happy-hop' },
      },
      schemaVersion: 6,
    };
  },
  // v6 → v7: room identity. Everyone starts in the default room; nothing else changes.
  6: (save) => ({ ...save, room: { color: null }, schemaVersion: 7 }),
  // v7 → v8: Premium groundwork. Adds an (empty) room theme preference. No
  // entitlement is ever stored in the save; owned items and equipment are untouched.
  7: (save) => ({ ...save, room: { ...((save.room as RawRecord) ?? { color: null }), theme: null }, schemaVersion: 8 }),
};

export class SaveMigrationError extends Error {}

/** Drop equipped entries that point at unknown, unowned or wrong-slot items. */
function sanitizeEquipped(save: GameSave): GameSave {
  const equipped: GameSave['inventory']['equipped'] = {};
  for (const [slot, itemId] of Object.entries(save.inventory.equipped)) {
    const item = itemId ? getShopItem(itemId) : undefined;
    // Premium pieces aren't owned; they stay equipped and are shown only while
    // Premium is active (see effectiveEquipped). Owned items are kept as before.
    if (item && item.equipSlot === slot && ((save.inventory.items[item.id]?.quantity ?? 0) > 0 || item.access === 'premium')) {
      equipped[slot as keyof typeof equipped] = item.id;
    }
  }
  return { ...save, inventory: { ...save.inventory, equipped } };
}

export function migrateSave(raw: unknown): GameSave {
  if (!raw || typeof raw !== 'object') throw new SaveMigrationError('Save data is not an object');
  let save = raw as RawSave;
  let version = typeof save.schemaVersion === 'number' ? save.schemaVersion : 0;

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new SaveMigrationError(`Save is from a newer app version (schema ${version})`);
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new SaveMigrationError(`No migration from schema ${version}`);
    save = migrate(save);
    version += 1;
  }
  if (!save.profile || !save.wallet || !save.inventory || !save.focus || !save.stats || !save.streak) {
    throw new SaveMigrationError('Save is missing required sections');
  }
  const room = (save.room ?? {}) as RawRecord;
  return sanitizeEquipped({
    ...(save as unknown as GameSave),
    room: { color: normalizeRoomColor(room.color), theme: typeof room.theme === 'string' ? room.theme : null },
  });
}
