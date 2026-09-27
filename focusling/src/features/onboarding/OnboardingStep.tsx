import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, radius, spacing } from '@/ui';

interface Props {
  step: number;
  total: number;
  actionLabel: string;
  actionDisabled?: boolean;
  onAction: () => void;
  /** Optional quieter second action under the primary one. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Hide the pinned primary action (screens whose choices are the action). */
  hideAction?: boolean;
  children: ReactNode;
}

/** Shared onboarding frame: progress dots, scrollable content, pinned primary action. */
export function OnboardingStep({ step, total, actionLabel, actionDisabled, onAction, secondaryLabel, onSecondary, hideAction, children }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.dots} accessibilityLabel={`Step ${step} of ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[styles.dot, total > 5 && styles.dotSmall, i < step && styles.dotActive]} />
          ))}
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {!hideAction || secondaryLabel ? (
          <View style={styles.footer}>
            {!hideAction && <Button label={actionLabel} onPress={onAction} disabled={actionDisabled} />}
            {secondaryLabel && onSecondary && <Button label={secondaryLabel} variant="ghost" onPress={onSecondary} />}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingTop: spacing.md },
  dot: { width: 28, height: 6, borderRadius: radius.pill, backgroundColor: colors.border },
  dotSmall: { width: 20 },
  dotActive: { backgroundColor: colors.primary },
  content: { flexGrow: 1, padding: spacing.xl, gap: spacing.xl, width: '100%', maxWidth: 640, alignSelf: 'center' },
  footer: { padding: spacing.xl, paddingTop: spacing.sm, gap: spacing.sm, width: '100%', maxWidth: 640, alignSelf: 'center' },
});
