import { useEffect } from 'react';
import { AppState } from 'react-native';
import { services } from '@/services';
import { useGameStore } from '@/state';

const REFRESH_INTERVAL_MS = 15_000;

/**
 * Keeps game state in step with real time and the OS:
 *  - refreshes on foreground (decay, sessions that finished while away);
 *  - refreshes periodically so a session completes even if no screen is ticking;
 *  - abandons the active session when the Screen Time service reports a violation.
 */
export function useGameLifecycle() {
  const ready = useGameStore((s) => s.status === 'ready');

  useEffect(() => {
    if (!ready) return;
    const { refresh } = useGameStore.getState();
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    const unsubscribe = services.screenTime.subscribe((event) => {
      const active = useGameStore.getState().save?.focus.active;
      if (active && event.sessionId === active.id) useGameStore.getState().endFocus('abandoned');
    });
    return () => {
      appStateSub.remove();
      clearInterval(interval);
      unsubscribe();
    };
  }, [ready]);
}
