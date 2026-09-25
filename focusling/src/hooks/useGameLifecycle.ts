import { useEffect } from 'react';
import { AppState } from 'react-native';
import { services } from '@/services';
import { useGameStore } from '@/state';

const REFRESH_INTERVAL_MS = 15_000;

/**
 * Keeps game state in step with real time and the OS:
 *  - refreshes on foreground (decay, sessions that finished while away) and
 *    reconciles the game session with native protection state;
 *  - refreshes periodically so a session completes even if no screen is ticking;
 *  - forwards native protection events (status, interventions, capture stops).
 *    Interventions never end or penalise a session.
 */
export function useGameLifecycle() {
  const ready = useGameStore((s) => s.status === 'ready');

  useEffect(() => {
    if (!ready) return;
    const { refresh, refreshProtection, handleProtectionEvent } = useGameStore.getState();
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
        void refreshProtection();
      }
    });
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    const unsubscribe = services.protection.subscribe(handleProtectionEvent);
    return () => {
      appStateSub.remove();
      clearInterval(interval);
      unsubscribe();
    };
  }, [ready]);
}
