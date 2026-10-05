import { ECONOMY } from '@/config/economy';
import { DEFAULT_PROTECTION } from '@/config/protection';
import { createCosmeticsState, grantUnlocks } from '../cosmetics/cosmeticsService';
import { createInventory } from '../inventory/inventoryService';
import { createMissionState } from '../missions/missionService';
import { createPlayStats } from '../play/playService';
import { createId } from '../shared/ids';
import { createStreakState } from '../streaks/streakService';
import { CURRENT_SCHEMA_VERSION, type GameSave, type LifetimeStats, type Timestamp } from '../models';

export function createLifetimeStats(): LifetimeStats {
  return {
    sessionsCompleted: 0,
    sessionsAbandoned: 0,
    totalFocusMinutes: 0,
    lifetimeCoinsEarned: 0,
    longestSessionMinutes: 0,
    itemsPurchased: 0,
    coinsSpent: 0,
    missionsCompleted: 0,
  };
}

/** A fresh save for a first launch, before onboarding. */
export function createNewSave(now: Timestamp, options: { debugToolsEnabled?: boolean } = {}): GameSave {
  const save: GameSave = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    savedAt: now,
    profile: {
      id: createId('user'),
      createdAt: now,
      onboardingCompletedAt: null,
      settings: { hapticsEnabled: true, soundEnabled: true, debugToolsEnabled: options.debugToolsEnabled ?? false },
    },
    pet: null,
    wallet: { coins: ECONOMY.starterCoins },
    inventory: createInventory(),
    focus: { active: null, history: [] },
    stats: createLifetimeStats(),
    streak: createStreakState(),
    daily: {},
    protection: { ...DEFAULT_PROTECTION, surfaces: [...DEFAULT_PROTECTION.surfaces] },
    mode: 'self',
    family: null,
    missions: createMissionState(),
    play: createPlayStats(),
    cosmetics: createCosmeticsState(),
    room: { color: null, theme: null },
  };
  // Starter cosmetics, so the wardrobe is never empty.
  return grantUnlocks(save, now).save;
}
