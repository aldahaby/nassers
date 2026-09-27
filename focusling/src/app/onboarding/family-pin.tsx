import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PinPad } from '@/features/family/PinPad';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import { useOnboardingProgress } from '@/features/onboarding/flow';
import { useGameStore } from '@/state';
import { colors, spacing, typography } from '@/ui';

/** Create the parent PIN: enter twice. Stored salted and hashed, never as the digits. */
export default function FamilyPinScreen() {
  const family = useGameStore((s) => s.save?.mode === 'family');
  const setParentPin = useGameStore((s) => s.setParentPin);
  const progress = useOnboardingProgress('family-pin');
  const [first, setFirst] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!family) return <Redirect href="/onboarding/who" />;

  const onComplete = (pin: string) => {
    if (first === null) {
      setFirst(pin);
      setValue('');
      setError(null);
      return;
    }
    if (pin !== first) {
      setFirst(null);
      setValue('');
      setError("Those PINs didn't match. Let's try again.");
      return;
    }
    const result = setParentPin(pin);
    if (!result.ok) {
      setError('Please use 4 digits.');
      return;
    }
    router.push('/onboarding/family-child');
  };

  return (
    <OnboardingStep {...progress} actionLabel="" onAction={() => {}} hideAction>
      <View style={styles.header}>
        <Text style={styles.title}>{first === null ? 'Create a parent PIN' : 'Enter it once more'}</Text>
        <Text style={styles.body}>
          {first === null
            ? 'Pick 4 digits your child doesn’t know. You’ll use it to open the grown-up area.'
            : 'Just to be sure.'}
        </Text>
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error ?? ' '}
        </Text>
      </View>
      <PinPad value={value} onChange={setValue} onComplete={onComplete} />
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.sm },
  title: { ...typography.title, textAlign: 'center' },
  body: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  error: { ...typography.label, color: colors.danger, minHeight: 18, textAlign: 'center' },
});
