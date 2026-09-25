import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, radius, spacing } from '@/ui';

const TOTAL_STEPS = 4;

interface Props {
  step: number;
  actionLabel: string;
  actionDisabled?: boolean;
  onAction: () => void;
  children: ReactNode;
}

/** Shared onboarding frame: progress dots, scrollable content, pinned primary action. */
export function OnboardingStep({ step, actionLabel, actionDisabled, onAction, children }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.dots} accessibilityLabel={`Step ${step} of ${TOTAL_STEPS}`}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <View key={i} style={[styles.dot, i < step && styles.dotActive]} />
          ))}
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        <View style={styles.footer}>
          <Button label={actionLabel} onPress={onAction} disabled={actionDisabled} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingTop: spacing.md },
  dot: { width: 28, height: 6, borderRadius: radius.pill, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary },
  content: { flexGrow: 1, padding: spacing.xl, gap: spacing.xl },
  footer: { padding: spacing.xl, paddingTop: spacing.sm },
});
