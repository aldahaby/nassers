import { Redirect, Stack } from 'expo-router';
import { useGameStore } from '@/state';
import { colors } from '@/ui';

export default function OnboardingLayout() {
  const onboarded = useGameStore((s) => Boolean(s.save?.pet && s.save.profile.onboardingCompletedAt));
  if (onboarded) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
