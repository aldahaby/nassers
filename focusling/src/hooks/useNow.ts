import { useEffect, useState } from 'react';
import { appClock } from '@/services/clock';

/**
 * Current time as state, re-rendering every `intervalMs`. Keeps render functions
 * pure. Reads the app clock, so Planner QA's simulated time shows everywhere.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => appClock.now());
  useEffect(() => {
    const id = setInterval(() => setNow(appClock.now()), intervalMs);
    const off = appClock.subscribe(() => setNow(appClock.now()));
    return () => {
      clearInterval(id);
      off();
    };
  }, [intervalMs]);
  return now;
}
