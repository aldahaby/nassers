import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PlannerBridge } from '@/features/planner/PlannerBridge';
import { EntitlementBridge } from '@/features/premium/EntitlementBridge';
import { SoundBridge } from '@/features/sound/SoundBridge';
import { StyleCelebrationModal } from '@/features/style/StyleCelebrationModal';
import { useGameLifecycle } from '@/hooks/useGameLifecycle';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useGameStore } from '@/state';
import { ErrorView, LoadingView, colors } from '@/ui';

/** Root: loads the save before any screen renders, then hands off to the router. */
export default function RootLayout() {
  const status = useGameStore((s) => s.status);
  const error = useGameStore((s) => s.error);
  const hydrate = useGameStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  useGameLifecycle();
  // Planner screens: calm fades under Reduce Motion instead of sliding.
  const reduced = useReducedMotion();
  const slide = reduced ? ('fade' as const) : ('slide_from_right' as const);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {status === 'error' ? (
        <ErrorView message={error ?? 'Could not load your save.'} onRetry={() => void hydrate()} />
      ) : status !== 'ready' ? (
        <LoadingView />
      ) : (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="inventory" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="protection" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="missions" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="wardrobe" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="room-studio" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="premium" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="collection/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="games/memory-garden" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="games/toy-toss" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="planner/import" options={{ animation: slide }} />
          <Stack.Screen name="planner/review" options={{ animation: slide }} />
          <Stack.Screen name="planner/manual" options={{ animation: slide }} />
          <Stack.Screen name="planner/week" options={{ animation: slide }} />
          <Stack.Screen name="planner/settings" options={{ animation: slide }} />
          <Stack.Screen name="planner/assignment/[id]" options={{ animation: slide }} />
          <Stack.Screen name="planner/retrieval" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="planner/start" options={{ animation: 'fade' }} />
          <Stack.Screen name="parent-gate" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="parent" options={{ animation: 'fade' }} />
          <Stack.Screen
            name="session-complete"
            options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
          />
        </Stack>
      )}
      {status === 'ready' && <StyleCelebrationModal />}
      {status === 'ready' && <SoundBridge />}
      {status === 'ready' && <EntitlementBridge />}
      {status === 'ready' && <PlannerBridge />}
    </SafeAreaProvider>
  );
}
