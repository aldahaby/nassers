import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { useGameStore, usePlannerStore } from '@/state';

/** How often the planner re-checks missed plans, reminders and the widget while the app is open. */
const REFRESH_MS = 5 * 60_000;

/**
 * Starts the planner once the game save is loaded, follows notification
 * actions (Start & Lock opens the running session), and keeps reminder
 * support, pending reminders and the widget snapshot fresh. No UI.
 */
export function PlannerBridge() {
  const gameReady = useGameStore((s) => s.status === 'ready');
  const nav = usePlannerStore((s) => s.pendingNavigation);
  const routes = useAppRoutes();

  useEffect(() => {
    if (gameReady) void usePlannerStore.getState().hydrate();
  }, [gameReady]);

  useEffect(() => {
    if (!nav) return;
    usePlannerStore.getState().consumeNavigation();
    router.navigate((nav.to === 'session' ? routes.focus : routes.planner) as Href);
  }, [nav, routes]);

  useEffect(() => {
    const id = setInterval(() => void usePlannerStore.getState().refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  return null;
}
