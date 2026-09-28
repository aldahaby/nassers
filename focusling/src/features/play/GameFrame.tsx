import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { colors, radius, spacing, typography, Pressable } from '@/ui';

interface Props {
  title: string;
  /** Round progress in words, e.g. "2 of 4 pairs". */
  progress: string;
  children: ReactNode;
}

/** Full-screen, centred game frame with a calm header and an always-visible way out. */
export function GameFrame({ title, progress, children }: Props) {
  const routes = useAppRoutes();
  const exit = () => (router.canGoBack() ? router.back() : router.replace(routes.play as Href));
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.column}>
        <View style={styles.header}>
          <Pressable onPress={exit} style={styles.exit} accessibilityRole="button" accessibilityLabel="Leave game" hitSlop={8}>
            <Text style={styles.exitText}>✕</Text>
          </Pressable>
          <View style={styles.titles}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <Text style={styles.progress} accessibilityLiveRegion="polite">
              {progress}
            </Text>
          </View>
          <View style={styles.exit} />
        </View>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  column: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  exit: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  exitText: { fontSize: 22, fontWeight: '800', color: colors.textMuted },
  titles: { flex: 1, alignItems: 'center' },
  title: { ...typography.heading },
  progress: { ...typography.label },
});
