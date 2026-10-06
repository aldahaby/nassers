import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import type { StartSource } from '@/core';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { usePlannerStore } from '@/state';
import { LoadingView } from '@/ui';

const SOURCES: readonly StartSource[] = ['widget', 'liveActivity', 'notification', 'planner', 'app', 'manual'];

/**
 * Deep link for one-tap starts, e.g. focusling://planner/start?plan=ID&source=widget.
 * Starts the planned session (no extra confirmation), then shows it.
 */
export default function PlannerStartScreen() {
  const { plan, source } = useLocalSearchParams<{ plan?: string; source?: string }>();
  const hydrated = usePlannerStore((s) => s.hydrated);
  const routes = useAppRoutes();
  const [done, setDone] = useState<'session' | 'planner' | null>(null);

  useEffect(() => {
    if (!hydrated || done || !plan) return;
    const src = SOURCES.includes(source as StartSource) ? (source as StartSource) : 'app';
    void usePlannerStore
      .getState()
      .startPlan(plan, src)
      .then((r) => setDone(r.ok ? 'session' : 'planner'));
  }, [hydrated, plan, source, done]);

  if (!plan) return <Redirect href={routes.planner as Href} />;
  if (done) return <Redirect href={(done === 'session' ? routes.focus : routes.planner) as Href} />;
  return <LoadingView />;
}
