import { Redirect, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { MissionManager } from '@/features/missions/MissionManager';
import { useAppMode } from '@/state';
import { Button, Screen, colors, spacing, typography, Pressable } from '@/ui';

/** Self mode missions: pick templates or make your own. */
export default function MissionsScreen() {
  const mode = useAppMode();
  if (mode === 'family') return <Redirect href="/(child)/missions" />;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={typography.title} accessibilityRole="header">
          Missions
        </Text>
        <Text style={styles.muted}>Small daily goals that pay bonus coins on top of your focus rewards.</Text>
      </View>
      <Button label="Start focusing" icon="⏳" onPress={() => router.navigate('/(tabs)/focus')} />
      <MissionManager audience="self" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  back: { ...typography.label, fontSize: 16, color: colors.primaryDark, paddingVertical: spacing.xs },
  muted: { ...typography.body, fontSize: 15, color: colors.textMuted },
});
