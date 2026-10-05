import type { FriendCodeModel, FriendProfilePreview, StudentPromoEligibility } from '../models';
import { createNewSave } from '../save/createNewSave';

describe('future-only contracts (Friends, student promo)', () => {
  it('nothing about friends or student verification is stored in the save', () => {
    const save = JSON.stringify(createNewSave(Date.now()));
    for (const key of ['friend', 'friendCode', 'studentPromo', 'student', 'verification', 'idImage']) expect(save.toLowerCase()).not.toContain(key.toLowerCase());
  });

  it('the contracts compile and carry no ID image field', () => {
    const code: FriendCodeModel = { code: 'K7Q2-9XPM', ownerUserId: 'u1', createdAt: '2026-10-05', status: 'active' };
    const preview: FriendProfilePreview = { userId: 'u1', petName: 'Nimbus', species: 'cloudling', growthStage: 'adult', equippedCosmeticIds: [], roomColor: '#FDE9D2' };
    const promo: StudentPromoEligibility = { status: 'unverified' };
    expect(code.status).toBe('active');
    expect(preview.species).toBe('cloudling');
    expect(Object.keys(promo)).not.toContain('studentIdImage');
  });
});
