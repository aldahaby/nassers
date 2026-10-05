import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import type { AppMode } from '@/core';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import { useOnboardingProgress } from '@/features/onboarding/flow';
import { useGameStore } from '@/state';
import { colors, radius, shadow, spacing, typography, Pressable } from '@/ui';

const SELF = { mode: 'self' as AppMode, icon: '🙋', title: 'For me', body: 'I want help spending less time scrolling.' };
const FAMILY = { mode: 'family' as AppMode, title: 'For my child', body: 'Set up Family Mode with a parent PIN on this device.' };

/**
 * The onboarding branch. Focusling leads with "For me"; Family Mode stays one
 * clear (smaller) step away for parents setting it up for a child.
 */
export default function WhoScreen() {
  const chooseMode = useGameStore((s) => s.chooseMode);
  const progress = useOnboardingProgress('who');

  const pick = (mode: AppMode) => {
    chooseMode(mode);
    router.push(mode === 'family' ? '/onboarding/family-intro' : '/onboarding/how-it-works');
  };

  return (
    <OnboardingStep {...progress} actionLabel="" onAction={() => {}} hideAction>
      <Text style={styles.title}>Who is Focusling for?</Text>
      <View style={styles.list} >
        <Pressable
          onPress={() => pick(SELF.mode)}
          accessibilityRole="button"
          accessibilityLabel={`${SELF.title}. ${SELF.body}`}
          style={({ pressed }) => [styles.option, shadow, pressed && styles.pressed]}
        >
          <Text style={styles.icon}>{SELF.icon}</Text>
          <View style={styles.text}>
            <Text style={typography.heading}>{SELF.title}</Text>
            <Text style={styles.body}>{SELF.body}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <Pressable
          onPress={() => pick(FAMILY.mode)}
          accessibilityRole="button"
          accessibilityLabel={`${FAMILY.title}. ${FAMILY.body}`}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <View style={styles.text}>
            <Text style={styles.secondaryTitle}>{FAMILY.title}</Text>
            <Text style={styles.secondaryBody}>{FAMILY.body}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, textAlign: 'center', marginTop: spacing.xl },
  list: { gap: spacing.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 96,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border },
  secondaryTitle: { ...typography.heading, fontSize: 16 },
  secondaryBody: { ...typography.body, fontSize: 14, color: colors.textMuted },
  pressed: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  icon: { fontSize: 36 },
  text: { flex: 1, gap: 4 },
  body: { ...typography.body, fontSize: 15, color: colors.textMuted },
  chevron: { fontSize: 28, color: colors.textMuted, fontWeight: '700' },
});
