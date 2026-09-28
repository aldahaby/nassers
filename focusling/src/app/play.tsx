import { Redirect, router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { PlayHub } from '@/features/play/PlayHub';
import { useAppMode } from '@/state';
import { Screen, colors, spacing, typography, Pressable } from '@/ui';

/** Self mode Play (Family Mode uses the Child View tab). */
export default function PlayScreen() {
  const mode = useAppMode();
  if (mode === 'family') return <Redirect href="/(child)/play" />;
  return (
    <Screen scroll>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <PlayHub />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { ...typography.label, fontSize: 16, color: colors.primaryDark, paddingVertical: spacing.xs },
});
