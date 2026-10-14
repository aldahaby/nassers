/**
 * Onboarding screens in order. Used for the progress dots only; navigation
 * itself is explicit in each screen.
 */
const FLOW: readonly string[] = ['welcome', 'how-it-works', 'choose', 'name'];

export function onboardingProgress(screen: string): { step: number; total: number } {
  return { step: Math.max(1, FLOW.indexOf(screen) + 1), total: FLOW.length };
}

export function useOnboardingProgress(screen: string) {
  return onboardingProgress(screen);
}
