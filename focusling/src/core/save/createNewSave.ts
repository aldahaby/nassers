import { ECONOMY } from '@/config/economy';
import { createInventory } from '../inventory/inventoryService';
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
  };
}

/** A fresh save for a first launch, before onboarding. */
export function createNewSave(now: Timestamp, options: { debugToolsEnabled?: boolean } = {}): GameSave {
  return {
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
  };
}
