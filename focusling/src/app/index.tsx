import { Redirect } from 'expo-router';
import { useGameStore } from '@/state';

/** Entry: new players go to onboarding, returning players to their pet. */
export default function Index() {
  const hasPet = useGameStore((s) => Boolean(s.save?.pet));
  return <Redirect href={hasPet ? '/(tabs)' : '/onboarding'} />;
}
