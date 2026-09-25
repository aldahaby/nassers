import { useMemo } from 'react';
import {
  estimateReward,
  getActiveSessionProgress,
  getEffectiveStreakDays,
  getEquippedBonuses,
  getMood,
  getProgression,
  toDateKey,
  type EquipSlot,
} from '@/core';
import { useNow } from '@/hooks/useNow';
import { useGameStore } from './gameStore';

/**
 * Derived view data for screens. Components use these hooks instead of
 * re-deriving level/stage/mood themselves.
 */
export function usePetView() {
  const pet = useGameStore((s) => s.save?.pet ?? null);
  return useMemo(() => {
    if (!pet) return null;
    return { pet, progression: getProgression(pet.lifetimeXp), mood: getMood(pet.stats) };
  }, [pet]);
}

export function useCoins(): number {
  return useGameStore((s) => s.save?.wallet.coins ?? 0);
}

export function useStreakDays(): number {
  const streak = useGameStore((s) => s.save?.streak);
  const now = useNow(60_000);
  return streak ? getEffectiveStreakDays(streak, toDateKey(now)) : 0;
}

export function useEquipped() {
  return useGameStore((s) => s.save?.inventory.equipped) ?? EMPTY_EQUIPPED;
}

export function useEquippedBonuses() {
  const inventory = useGameStore((s) => s.save?.inventory);
  return useMemo(() => (inventory ? getEquippedBonuses(inventory) : { xpPct: 0, coinPct: 0 }), [inventory]);
}

export function useActiveSession() {
  return useGameStore((s) => s.save?.focus.active ?? null);
}

/** What a session of `minutes` would pay if completed. */
export function useRewardEstimate(minutes: number) {
  const save = useGameStore((s) => s.save);
  const now = useNow(60_000);
  return useMemo(() => (save ? estimateReward(save, minutes, now) : null), [save, minutes, now]);
}

/** Live countdown and projection for the running session; re-renders every second. */
export function useActiveSessionProgress() {
  const save = useGameStore((s) => s.save);
  const now = useNow(1000);
  return useMemo(() => (save ? getActiveSessionProgress(save, now) : null), [save, now]);
}

export function useSessionStreak(): number {
  return useGameStore((s) => s.save?.streak.currentSessionStreak ?? 0);
}

export function useDebugToolsEnabled(): boolean {
  return useGameStore((s) => s.save?.profile.settings.debugToolsEnabled ?? false);
}

const EMPTY_EQUIPPED: Partial<Record<EquipSlot, string>> = {};
