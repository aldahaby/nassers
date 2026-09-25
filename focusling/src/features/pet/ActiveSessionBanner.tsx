import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { getRemainingMs, type FocusSession } from '@/core';
import { useNow } from '@/hooks/useNow';
import { colors, radius, spacing } from '@/ui';
import { formatCountdown } from '@/utils/format';

/** Shown on the pet screen while a focus session is running. */
export function ActiveSessionBanner({ session }: { session: FocusSession }) {
  const now = useNow(1000);

  return (
    <Pressable style={styles.banner} onPress={() => router.navigate('/(tabs)/focus')} accessibilityRole="button">
      <Text style={styles.text}>⏳ Focusing together · {formatCountdown(getRemainingMs(session, now))} left</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, alignSelf: 'center' },
  text: { color: colors.white, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
