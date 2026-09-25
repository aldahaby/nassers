import { useMemo } from 'react';
import { getEffectiveStreakDays, getEquippedBonuses, getMood, getProgression, toDateKey } from '@/core';
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

const EMPTY_EQUIPPED = {};
