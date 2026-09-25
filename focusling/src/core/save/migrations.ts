import { CURRENT_SCHEMA_VERSION, type GameSave } from '../models';

/**
 * Upgrades an older save to the current schema. Each entry migrates from
 * version N to N+1. Add one whenever GameSave changes shape.
 */
const MIGRATIONS: Record<number, (save: Record<string, unknown>) => Record<string, unknown>> = {
  // 1: (save) => ({ ...save, newField: default, schemaVersion: 2 }),
};

export class SaveMigrationError extends Error {}

export function migrateSave(raw: unknown): GameSave {
  if (!raw || typeof raw !== 'object') throw new SaveMigrationError('Save data is not an object');
  let save = raw as Record<string, unknown>;
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
  return save as unknown as GameSave;
}
