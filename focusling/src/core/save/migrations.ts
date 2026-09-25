import { DEFAULT_PROTECTION } from '@/config/protection';
import { getShopItem } from '@/config/shopCatalog';
import { CURRENT_SCHEMA_VERSION, type GameSave } from '../models';

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
};

export class SaveMigrationError extends Error {}

/** Drop equipped entries that point at unknown, unowned or wrong-slot items. */
function sanitizeEquipped(save: GameSave): GameSave {
  const equipped: GameSave['inventory']['equipped'] = {};
  for (const [slot, itemId] of Object.entries(save.inventory.equipped)) {
    const item = itemId ? getShopItem(itemId) : undefined;
    if (item && item.equipSlot === slot && (save.inventory.items[item.id]?.quantity ?? 0) > 0) {
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
  return sanitizeEquipped(save as unknown as GameSave);
}
