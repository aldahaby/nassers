import { migrateSave } from '../save/migrations';
import { adoptPet } from '../game/gameEngine';
import { createNewSave } from '../save/createNewSave';

const T0 = new Date(2026, 0, 5, 9, 0).getTime();

describe('save migrations', () => {
  it('upgrades a v1 save: renamed items, retired "ears" slot, purchase stats', () => {
    const current = adoptPet(createNewSave(T0), 'cloudling', 'Nimbus', T0);
    const v1 = JSON.parse(JSON.stringify(current));
    v1.schemaVersion = 1;
    delete v1.stats.itemsPurchased;
    delete v1.stats.coinsSpent;
    v1.inventory = {
      items: {
        'acc-headphones': { itemId: 'acc-headphones', quantity: 1, acquiredAt: T0, lastUsedAt: null },
        'food-veggie-bowl': { itemId: 'food-veggie-bowl', quantity: 2, acquiredAt: T0, lastUsedAt: null },
      },
      equipped: { ears: 'acc-headphones' },
    };

    const migrated = migrateSave(v1);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.inventory.equipped).toEqual({ head: 'acc-headphones' });
    expect(migrated.inventory.items['food-fruit-bowl']).toMatchObject({ itemId: 'food-fruit-bowl', quantity: 2 });
    expect(migrated.inventory.items['food-veggie-bowl']).toBeUndefined();
    expect(migrated.stats).toMatchObject({ itemsPurchased: 2, coinsSpent: 0 });
  });

  it('drops equipped entries that are unknown, unowned or in the wrong slot', () => {
    const save = adoptPet(createNewSave(T0), 'cloudling', 'Nimbus', T0);
    const raw = JSON.parse(JSON.stringify(save));
    raw.inventory = {
      items: { 'acc-cap': { itemId: 'acc-cap', quantity: 1, acquiredAt: T0, lastUsedAt: null } },
      equipped: { head: 'acc-cap', face: 'acc-sunglasses', wall: 'acc-cap', neck: 'nonsense' },
    };
    expect(migrateSave(raw).inventory.equipped).toEqual({ head: 'acc-cap' });
  });
});
