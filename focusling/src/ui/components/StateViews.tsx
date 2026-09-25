import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/ui/theme';
import { Button } from './Button';

export function LoadingView({ message = 'Waking your pet…' }: { message?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.body}>{message}</Text>
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emoji}>🌧️</Text>
      <Text style={typography.heading}>Something went wrong</Text>
      <Text style={styles.body}>{message}</Text>
      <Button label="Try again" onPress={onRetry} />
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emoji}>{icon}</Text>
      <Text style={[typography.heading, styles.text]}>{title}</Text>
      <Text style={[styles.body, styles.text]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background },
  emoji: { fontSize: 52 },
  body: { ...typography.body, color: colors.textMuted },
  text: { textAlign: 'center' },
});
