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
    expect(migrated.schemaVersion).toBe(9);
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

describe('v2 → v3 migration', () => {
  it('adds protection settings and marks existing sessions as unprotected', () => {
    const save = adoptPet(createNewSave(T0), 'cloudling', 'Nimbus', T0);
    const v2 = JSON.parse(JSON.stringify(save));
    v2.schemaVersion = 2;
    delete v2.protection;
    v2.focus = {
      active: { id: 'a', plannedDurationMinutes: 30, startedAt: T0, endedAt: null, status: 'active', blockedTargets: [], reward: null },
      history: [{ id: 'h', plannedDurationMinutes: 15, startedAt: T0, endedAt: T0, status: 'completed', blockedTargets: [], reward: null }],
    };
    const migrated = migrateSave(v2);
    expect(migrated.schemaVersion).toBe(9);
    expect(migrated.protection).toEqual({ mode: 'none', surfaces: ['instagramReels'], fallbackBehavior: 'askUser' });
    expect(migrated.focus.active?.protectionMode).toBe('none');
    expect(migrated.focus.history[0]?.protectionMode).toBe('none');
  });
});

describe('v8 → v9 migration (student-only: former Family Mode fields removed)', () => {
  const v8 = (extra: Record<string, unknown>) => {
    const save = adoptPet(createNewSave(T0), 'sproutling', 'Moss', T0);
    const raw = JSON.parse(JSON.stringify({ ...save, wallet: { coins: 250 }, pet: { ...save.pet!, lifetimeXp: 900 }, ...extra }));
    raw.schemaVersion = 8;
    raw.play = { ...raw.play, debugUnlockedDate: '2026-01-05' };
    return raw;
  };

  it('drops mode, family and the Play mission-gate override, and keeps all student progress', () => {
    const before = v8({ mode: 'family', family: { gate: { salt: 's', hash: 'h', iterations: 2000, failedAttempts: 0, lockedUntil: 0 }, child: { nickname: 'Sunny' }, play: { access: 'afterMission' }, setupCompletedAt: T0 } });
    const migrated = migrateSave(before);
    expect(migrated.schemaVersion).toBe(9);
    expect(migrated).not.toHaveProperty('mode');
    expect(migrated).not.toHaveProperty('family');
    expect(migrated.play).not.toHaveProperty('debugUnlockedDate');
    expect(JSON.stringify(migrated)).not.toMatch(/Sunny|afterMission|"gate"/);
    expect(migrated.pet).toMatchObject({ name: 'Moss', lifetimeXp: 900 });
    expect(migrated.wallet.coins).toBe(250);
    expect(migrated.inventory).toEqual(before.inventory);
    expect(migrated.focus).toEqual(before.focus);
    expect(migrated.stats).toEqual(before.stats);
    expect(migrated.missions).toEqual(before.missions);
    expect(migrated.room).toEqual(before.room);
    expect(migrated.profile.onboardingCompletedAt).toBe(before.profile.onboardingCompletedAt);
  });

  it('a pet adopted during an unfinished family setup is kept and onboarding counts as done', () => {
    const before = v8({ mode: 'family', family: { gate: null, child: { nickname: '' }, play: { access: 'always' }, setupCompletedAt: null } });
    before.profile.onboardingCompletedAt = null;
    const migrated = migrateSave(before);
    expect(migrated.pet?.name).toBe('Moss');
    expect(migrated.profile.onboardingCompletedAt).toBe(before.pet.adoptedAt);
  });

  it('a save with no pet stays in onboarding', () => {
    const raw = JSON.parse(JSON.stringify({ ...createNewSave(T0), mode: 'self', family: null }));
    raw.schemaVersion = 8;
    const migrated = migrateSave(raw);
    expect(migrated.pet).toBeNull();
    expect(migrated.profile.onboardingCompletedAt).toBeNull();
  });

  it('new saves have no family fields', () => {
    const fresh = createNewSave(T0);
    expect(fresh).not.toHaveProperty('mode');
    expect(fresh).not.toHaveProperty('family');
  });
});
