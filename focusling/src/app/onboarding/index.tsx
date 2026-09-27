import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import { useOnboardingProgress } from '@/features/onboarding/flow';
import { AnimatedPet, colors, spacing, typography } from '@/ui';

export default function WelcomeScreen() {
  const progress = useOnboardingProgress('welcome');
  return (
    <OnboardingStep {...progress} actionLabel="Let's go" onAction={() => router.push('/onboarding/who')}>
      <View style={styles.hero}>
        <View style={styles.row}>
          <AnimatedPet speciesId="sproutling" stage="young" mood="joyful" size={110} />
          <AnimatedPet speciesId="cloudling" stage="adult" mood="joyful" size={140} />
          <AnimatedPet speciesId="emberling" stage="young" mood="joyful" size={110} />
        </View>
        <Text style={styles.title}>Welcome to Focusling</Text>
        <Text style={styles.body}>
          A tiny friend who grows when the phone goes down. Less scrolling, more real life, and a happier pet.
        </Text>
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  title: { ...typography.title, fontSize: 32, textAlign: 'center' },
  body: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 24 },
});
