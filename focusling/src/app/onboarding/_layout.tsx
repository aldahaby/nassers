import { Redirect, Stack } from 'expo-router';
import { useGameStore } from '@/state';
import { colors } from '@/ui';

export default function OnboardingLayout() {
  const onboarded = useGameStore((s) => Boolean(s.save?.pet && s.save.profile.onboardingCompletedAt));
  const family = useGameStore((s) => s.save?.mode === 'family');
  if (onboarded) return <Redirect href={family ? '/(child)' : '/(tabs)'} />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
