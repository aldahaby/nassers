import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/ui';

/** Back-to-dashboard header for parent sub-screens. */
export function ParentHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const back = () => (router.canGoBack() ? router.back() : router.replace('/parent'));
  return (
    <View style={styles.header}>
      <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back to dashboard" hitSlop={12}>
        <Text style={styles.back}>‹ Dashboard</Text>
      </Pressable>
      <Text style={typography.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  back: { ...typography.label, fontSize: 16, color: colors.primaryDark, paddingVertical: spacing.xs },
  subtitle: { ...typography.body, fontSize: 15, color: colors.textMuted },
});
