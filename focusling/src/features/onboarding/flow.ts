import type { AppMode } from '@/core';
import { useGameStore } from '@/state';

/**
 * Onboarding screens in order, per branch. Used for the progress dots only;
 * navigation itself is explicit in each screen.
 */
const FLOWS: Record<AppMode, readonly string[]> = {
  self: ['welcome', 'who', 'how-it-works', 'choose', 'name'],
  family: ['welcome', 'who', 'family-intro', 'family-pin', 'family-child', 'choose', 'name', 'family-mission'],
};

export function onboardingProgress(screen: string, mode: AppMode): { step: number; total: number } {
  const flow = FLOWS[mode];
  return { step: Math.max(1, flow.indexOf(screen) + 1), total: flow.length };
}

export function useOnboardingProgress(screen: string) {
  const mode = useGameStore((s) => s.save?.mode ?? 'self');
  return onboardingProgress(screen, mode);
}
