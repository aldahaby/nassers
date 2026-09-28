import { Redirect } from 'expo-router';
import { useSessionCompleteRedirect } from '@/hooks/useSessionCompleteRedirect';
import { Tabs } from 'expo-router/js-tabs';
import { playSound } from '@/services/audio';
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
  const onboarded = useGameStore((s) => Boolean(s.save?.pet && s.save.profile.onboardingCompletedAt));
  const family = useGameStore((s) => s.save?.mode === 'family');
  useSessionCompleteRedirect();

  if (!onboarded) return <Redirect href="/onboarding" />;
  if (family) return <Redirect href="/(child)" />;

  return (
    <Tabs
      // A light "plip" when switching tabs (the tab bar is outside our Pressable).
      screenListeners={{ tabPress: () => void playSound('nav') }}
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
