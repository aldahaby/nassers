import { router } from 'expo-router';
import { useEffect } from 'react';
import { useGameStore } from '@/state';

/** Whenever a session ends (timer, early end, or while the app was closed), show the results. */
export function useSessionCompleteRedirect() {
  const hasPet = useGameStore((s) => Boolean(s.save?.pet));
  const hasSummary = useGameStore((s) => s.lastSummary !== null);
  useEffect(() => {
    if (hasPet && hasSummary) router.push('/session-complete');
  }, [hasPet, hasSummary]);
}
