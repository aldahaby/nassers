import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { CHILD_NICKNAME_MAX_LENGTH } from '@/config/family';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import { useOnboardingProgress } from '@/features/onboarding/flow';
import { useGameStore } from '@/state';
import { colors, radius, spacing, typography } from '@/ui';

/** A nickname is the only thing Focusling stores about the child. */
export default function FamilyChildScreen() {
  const family = useGameStore((s) => s.save?.family);
  const setChildNickname = useGameStore((s) => s.setChildNickname);
  const progress = useOnboardingProgress('family-child');
  const [nickname, setNickname] = useState(family?.child.nickname ?? '');

  if (!family) return <Redirect href="/onboarding/who" />;
  if (!family.gate) return <Redirect href="/onboarding/family-pin" />;
  const trimmed = nickname.trim();

  const next = () => {
    if (!trimmed) return;
    setChildNickname(trimmed);
    router.push('/onboarding/choose');
  };

  return (
    <OnboardingStep {...progress} actionLabel="Next" actionDisabled={!trimmed} onAction={next}>
      <View style={styles.header}>
        <Text style={styles.title}>{"What should we call your child?"}</Text>
        <Text style={styles.body}>A nickname is perfect. Focusling doesn’t need their real name, age, school or location.</Text>
      </View>
      <TextInput
        value={nickname}
        onChangeText={setNickname}
        placeholder="Nickname"
        placeholderTextColor={colors.textMuted}
        maxLength={CHILD_NICKNAME_MAX_LENGTH}
        autoFocus
        autoCapitalize="words"
        autoComplete="off"
        returnKeyType="next"
        onSubmitEditing={next}
        style={styles.input}
        accessibilityLabel="Child nickname"
      />
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  title: { ...typography.title, textAlign: 'center' },
  body: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 23 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
});
