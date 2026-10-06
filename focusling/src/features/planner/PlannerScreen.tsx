import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { Pressable, Screen, colors, spacing, typography } from '@/ui';

/** A pushed planner screen: back chevron, title, optional subtitle. */
export function PlannerScreen({ title, subtitle, children, width }: { title: string; subtitle?: string; children: ReactNode; width?: 'narrow' | 'wide' }) {
  const routes = useAppRoutes();
  return (
    <Screen scroll width={width}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace(routes.planner as Href))} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.text}>
          <Text style={typography.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 34, fontWeight: '700', color: colors.primaryDark, marginTop: -4 },
  text: { flex: 1 },
  subtitle: { ...typography.label },
});
