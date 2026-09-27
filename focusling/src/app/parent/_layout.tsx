import { Redirect, Stack } from 'expo-router';
import { useGameStore } from '@/state';
import { colors } from '@/ui';

/**
 * Parent area. Only reachable after the Parent Gate (or the developer
 * shortcut, which exists only while Developer tools are on). The unlocked state
 * lives in memory, so reopening the app always asks for the PIN again.
 */
export default function ParentLayout() {
  const family = useGameStore((s) => s.save?.mode === 'family');
  const onboarded = useGameStore((s) => Boolean(s.save?.profile.onboardingCompletedAt && s.save?.pet));
  const unlocked = useGameStore((s) => s.familyView === 'parent');

  if (!onboarded) return <Redirect href="/onboarding" />;
  if (!family) return <Redirect href="/(tabs)" />;
  if (!unlocked) return <Redirect href="/parent-gate" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }} />;
}
