import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import type { AppMode } from '@/core';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import { useOnboardingProgress } from '@/features/onboarding/flow';
import { useGameStore } from '@/state';
import { colors, radius, shadow, spacing, typography, Pressable } from '@/ui';

const OPTIONS: readonly { mode: AppMode; icon: string; title: string; body: string }[] = [
  { mode: 'self', icon: '🙋', title: 'For me', body: 'I want help spending less time scrolling.' },
  { mode: 'family', icon: '👨‍👧', title: 'For my child', body: 'I want to help my child build healthier screen habits.' },
];

/** The onboarding branch: self-improvement or a parent setting up Family Mode. */
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
      <View style={styles.list} accessibilityRole="radiogroup">
        {OPTIONS.map((option) => (
          <Pressable
            key={option.mode}
            onPress={() => pick(option.mode)}
            accessibilityRole="button"
            accessibilityLabel={`${option.title}. ${option.body}`}
            style={({ pressed }) => [styles.option, shadow, pressed && styles.pressed]}
          >
            <Text style={styles.icon}>{option.icon}</Text>
            <View style={styles.text}>
              <Text style={typography.heading}>{option.title}</Text>
              <Text style={styles.body}>{option.body}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
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
  pressed: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  icon: { fontSize: 36 },
  text: { flex: 1, gap: 4 },
  body: { ...typography.body, fontSize: 15, color: colors.textMuted },
  chevron: { fontSize: 28, color: colors.textMuted, fontWeight: '700' },
});
