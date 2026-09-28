import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { playSound } from '@/services/audio';
import { useSessionCompleteRedirect } from '@/hooks/useSessionCompleteRedirect';
import { useGameStore } from '@/state';
import { TabIcon, colors, type TabIconName } from '@/ui';

const TABS: readonly { name: string; title: string; icon: TabIconName }[] = [
  { name: 'index', title: 'Pet', icon: 'pet' },
  { name: 'missions', title: 'Missions', icon: 'missions' },
  { name: 'play', title: 'Play', icon: 'play' },
  { name: 'shop', title: 'Shop', icon: 'shop' },
];

/**
 * Child View: the pet game only. No settings, no protection controls; the
 * parent area sits behind the Parent Gate.
 */
export default function ChildLayout() {
  const onboarded = useGameStore((s) => Boolean(s.save?.pet && s.save.profile.onboardingCompletedAt));
  const family = useGameStore((s) => s.save?.mode === 'family');
  const parentView = useGameStore((s) => s.familyView === 'parent');
  useSessionCompleteRedirect();

  if (!onboarded) return <Redirect href="/onboarding" />;
  if (!family) return <Redirect href="/(tabs)" />;
  if (parentView) return <Redirect href="/parent" />;

  return (
    <Tabs
      // A light "plip" when switching tabs (the tab bar is outside our Pressable).
      screenListeners={{ tabPress: () => void playSound('nav') }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontWeight: '800', fontSize: 12 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 68, paddingTop: 6 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{ title: tab.title, tabBarIcon: ({ color }) => <TabIcon name={tab.icon} color={color} size={28} /> }}
        />
      ))}
      {/* Reachable from the pet screen and missions, but not a tab. */}
      <Tabs.Screen name="focus" options={{ href: null, title: 'Focus' }} />
    </Tabs>
  );
}
