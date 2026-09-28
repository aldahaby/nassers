import { useMemo } from 'react';
import { PLAY_ECONOMY } from '@/config/play';
import {
  emptyDailyStats,
  estimateReward,
  getCurrentMission,
  getMissionViews,
  getPlayAccess,
  playStatsFor,
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

export type HomeHref = '/onboarding' | '/(tabs)' | '/(child)';

/** Where "home" is: onboarding until it's done, then the self tabs or the child view. */
export function useHomeHref(): HomeHref {
  const onboarded = useGameStore((s) => Boolean(s.save?.profile.onboardingCompletedAt && s.save?.pet));
  const family = useGameStore((s) => s.save?.mode === 'family');
  if (!onboarded) return '/onboarding';
  return family ? '/(child)' : '/(tabs)';
}

export function useAppMode() {
  return useGameStore((s) => s.save?.mode ?? 'self');
}

export function useIsChildView(): boolean {
  return useGameStore((s) => s.save?.mode === 'family' && s.familyView === 'child');
}

/** Today's missions; re-evaluated each minute so day changes show up. */
export function useMissionViews() {
  const save = useGameStore((s) => s.save);
  const now = useNow(60_000);
  return useMemo(() => (save ? getMissionViews(save, now) : []), [save, now]);
}

export function useCurrentMission() {
  const save = useGameStore((s) => s.save);
  const now = useNow(60_000);
  return useMemo(() => (save ? getCurrentMission(save, now) : null), [save, now]);
}

export function usePlayToday() {
  const save = useGameStore((s) => s.save);
  const now = useNow(60_000);
  return useMemo(() => {
    if (!save) return null;
    const stats = playStatsFor(save.play, now);
    return {
      coinsEarned: stats.coinsEarned,
      cap: PLAY_ECONOMY.dailyCoinCap,
      capReached: stats.coinsEarned >= PLAY_ECONOMY.dailyCoinCap,
      completions: stats.completions,
      access: getPlayAccess(save, now),
    };
  }, [save, now]);
}

const EMPTY_EQUIPPED: Partial<Record<EquipSlot, string>> = {};

/** Today's aggregate focus numbers (no per-app or content detail exists to show). */
export function useTodayStats() {
  const daily = useGameStore((s) => s.save?.daily);
  const now = useNow(60_000);
  return useMemo(() => {
    const key = toDateKey(now);
    return daily?.[key] ?? emptyDailyStats(key);
  }, [daily, now]);
}

/** The user's free room colour (null = default Focusling room). */
export function useRoomColor(): string | null {
  return useGameStore((s) => s.save?.room?.color ?? null);
}
