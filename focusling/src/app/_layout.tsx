import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useGameLifecycle } from '@/hooks/useGameLifecycle';
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
          <Stack.Screen
            name="session-complete"
            options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
          />
        </Stack>
      )}
    </SafeAreaProvider>
  );
}
