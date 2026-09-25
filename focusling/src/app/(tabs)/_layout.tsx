import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { useGameStore } from '@/state';
import { TabIcon, colors, type TabIconName } from '@/ui';

const TABS: readonly { name: string; title: string; icon: TabIconName }[] = [
  { name: 'index', title: 'Pet', icon: 'pet' },
  { name: 'focus', title: 'Focus', icon: 'focus' },
  { name: 'shop', title: 'Shop', icon: 'shop' },
  { name: 'stats', title: 'Stats', icon: 'stats' },
  { name: 'settings', title: 'Settings', icon: 'settings' },
];

export default function TabsLayout() {
  const hasPet = useGameStore((s) => Boolean(s.save?.pet));
  const hasSummary = useGameStore((s) => s.lastSummary !== null);

  // Whenever a session ends (timer, early end, or while the app was closed), show the results.
  useEffect(() => {
    if (hasPet && hasSummary) router.push('/session-complete');
  }, [hasPet, hasSummary]);

  if (!hasPet) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontWeight: '800', fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 64, paddingTop: 6 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{ title: tab.title, tabBarIcon: ({ color }) => <TabIcon name={tab.icon} color={color} /> }}
        />
      ))}
    </Tabs>
  );
}
