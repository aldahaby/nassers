import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PET_NAME_MAX_LENGTH, PET_SPECIES } from '@/config/pets';
import type { PetSpeciesId } from '@/core';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import { useGameStore } from '@/state';
import { AnimatedPet, colors, radius, spacing, typography } from '@/ui';

function isSpecies(value: unknown): value is PetSpeciesId {
  return typeof value === 'string' && value in PET_SPECIES;
}

export default function NamePetScreen() {
  const { species } = useLocalSearchParams<{ species?: string }>();
  const adoptPet = useGameStore((s) => s.adoptPet);
  const [name, setName] = useState('');

  if (!isSpecies(species)) return <Redirect href="/onboarding/choose" />;
  const def = PET_SPECIES[species];
  const trimmed = name.trim();

  const adopt = () => {
    if (!trimmed) return;
    adoptPet(species, trimmed);
    router.replace('/(tabs)');
  };

  return (
    <OnboardingStep step={4} actionLabel={trimmed ? `Say hi to ${trimmed}` : 'Name your pet'} actionDisabled={!trimmed} onAction={adopt}>
      <View style={styles.hero}>
        <AnimatedPet speciesId={species} stage="baby" mood="joyful" size={180} />
        <Text style={styles.title}>{"What's their name?"}</Text>
      </View>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={`Name your ${def.name}`}
        placeholderTextColor={colors.textMuted}
        maxLength={PET_NAME_MAX_LENGTH}
        autoFocus
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={adopt}
        style={styles.input}
        accessibilityLabel="Pet name"
      />
      <View style={styles.suggestions}>
        {def.suggestedNames.map((suggestion) => (
          <Pressable key={suggestion} onPress={() => setName(suggestion)} style={styles.suggestion} accessibilityRole="button">
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </Pressable>
        ))}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.md },
  title: { ...typography.title, textAlign: 'center' },
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
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  suggestion: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  suggestionText: { fontWeight: '700', color: colors.primaryDark },
});
