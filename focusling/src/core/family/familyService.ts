import { CHILD_NICKNAME_MAX_LENGTH } from '@/config/family';
import type { AppMode, FamilySettings, GameSave, ParentGate, PlaySettings, Timestamp } from '../models';

export function createFamilySettings(): FamilySettings {
  return { gate: null, child: { nickname: '' }, play: { access: 'always' }, setupCompletedAt: null };
}

export function chooseAppMode(save: GameSave, mode: AppMode): GameSave {
  return { ...save, mode, family: mode === 'family' ? (save.family ?? createFamilySettings()) : null };
}

export function setParentGate(save: GameSave, gate: ParentGate): GameSave {
  return { ...save, family: { ...(save.family ?? createFamilySettings()), gate } };
}

export function cleanNickname(nickname: string): string {
  return nickname.trim().slice(0, CHILD_NICKNAME_MAX_LENGTH);
}

export function setChildNickname(save: GameSave, nickname: string): GameSave {
  return { ...save, family: { ...(save.family ?? createFamilySettings()), child: { nickname: cleanNickname(nickname) } } };
}

export function setPlaySettings(save: GameSave, patch: Partial<PlaySettings>): GameSave {
  const family = save.family ?? createFamilySettings();
  return { ...save, family: { ...family, play: { ...family.play, ...patch } } };
}

/** Family setup is complete once there's a PIN, a nickname and a pet. */
export function completeFamilySetup(save: GameSave, now: Timestamp): GameSave {
  const family = save.family ?? createFamilySettings();
  return {
    ...save,
    family: { ...family, setupCompletedAt: now },
    profile: { ...save.profile, onboardingCompletedAt: save.profile.onboardingCompletedAt ?? now },
  };
}

export function isFamilySetupReady(save: GameSave): boolean {
  return Boolean(save.family?.gate && save.family.child.nickname && save.pet);
}
