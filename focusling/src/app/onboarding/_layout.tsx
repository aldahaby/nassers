import { Redirect, Stack } from 'expo-router';
import { useGameStore } from '@/state';
import { colors } from '@/ui';

export default function OnboardingLayout() {
  const hasPet = useGameStore((s) => Boolean(s.save?.pet));
  if (hasPet) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
