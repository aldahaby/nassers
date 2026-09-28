import { adoptPet } from '../game/gameEngine';
import { normalizeRoomColor, setRoomColor } from '../room/roomService';
import { migrateSave } from '../save/migrations';
import { createNewSave } from '../save/createNewSave';
import type { GameSave } from '../models';

const T0 = new Date(2026, 8, 28, 10, 0).getTime();
const fresh = (): GameSave => adoptPet(createNewSave(T0), 'cloudling', 'Nimbus', T0);

describe('room colour', () => {
  it('new saves start in the default room', () => {
    expect(createNewSave(T0).room).toEqual({ color: null });
  });

  it('accepts any valid colour (stored uppercase), free and without any gate', () => {
    const save = fresh();
    const coinsBefore = save.wallet.coins;
    for (const c of ['#ffffff', '#000000', '#FF0000', '#00ff00', '#0000FF', '#FFFF00', '#800080', '#808080', '#3a7bd5']) {
      const next = setRoomColor(save, c);
      expect(next.room.color).toBe(c.toUpperCase());
      expect(next.wallet.coins).toBe(coinsBefore);
      expect(next.stats).toBe(save.stats);
    }
  });

  it('ignores invalid colours and resets with null', () => {
    const blue = setRoomColor(fresh(), '#CFE4FA');
    for (const bad of ['blue', '#12', '#GGGGGG', 'rgb(0,0,0)', '']) expect(setRoomColor(blue, bad)).toBe(blue);
    expect(setRoomColor(blue, null).room.color).toBeNull();
  });

  it('never touches placed decorations or outfits', () => {
    const save = fresh();
    const decorated = { ...save, inventory: { ...save.inventory, equipped: { ...save.inventory.equipped, wall: 'decor-star-garland' } } };
    const next = setRoomColor(decorated, '#1E2447');
    expect(next.inventory).toBe(decorated.inventory);
  });

  it('normalises stored values', () => {
    expect(normalizeRoomColor('#abcdef')).toBe('#ABCDEF');
    expect(normalizeRoomColor(42)).toBeNull();
    expect(normalizeRoomColor('#abc')).toBeNull();
  });
});

describe('v6 → v7 migration', () => {
  it('adds the default room and keeps everything else', () => {
    const current = fresh();
    const v6 = JSON.parse(JSON.stringify({ ...current, schemaVersion: 6 })) as Record<string, unknown>;
    delete v6.room;
    const migrated = migrateSave(v6);
    expect(migrated.schemaVersion).toBe(7);
    expect(migrated.room).toEqual({ color: null });
    expect(migrated.pet).toEqual(current.pet);
    expect(migrated.inventory).toEqual(current.inventory);
    expect(migrated.cosmetics).toEqual(current.cosmetics);
  });

  it('keeps a saved room colour across loads and drops a corrupted one', () => {
    const saved = setRoomColor(fresh(), '#1E2447');
    expect(migrateSave(JSON.parse(JSON.stringify(saved))).room.color).toBe('#1E2447');
    const corrupted = { ...JSON.parse(JSON.stringify(saved)), room: { color: 'not-a-colour' } };
    expect(migrateSave(corrupted).room.color).toBeNull();
  });
});
