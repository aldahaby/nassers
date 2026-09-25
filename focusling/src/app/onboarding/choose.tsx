import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PET_SPECIES, STARTER_SPECIES_ORDER } from '@/config/pets';
import type { PetSpeciesId } from '@/core';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import { PetArt, colors, radius, shadow, spacing, typography } from '@/ui';

export default function ChoosePetScreen() {
  const [selected, setSelected] = useState<PetSpeciesId | null>(null);

  return (
    <OnboardingStep
      step={3}
      actionLabel={selected ? `Adopt ${PET_SPECIES[selected].name}` : 'Pick a friend'}
      actionDisabled={!selected}
      onAction={() => selected && router.push({ pathname: '/onboarding/name', params: { species: selected } })}
    >
      <Text style={styles.title}>Choose your starter</Text>
      <View style={styles.list}>
        {STARTER_SPECIES_ORDER.map((id) => {
          const species = PET_SPECIES[id];
          const isSelected = selected === id;
          return (
            <Pressable
              key={id}
              onPress={() => setSelected(id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${species.name}. ${species.tagline}`}
              style={[styles.option, shadow, isSelected && { borderColor: species.palette.bodyShade, backgroundColor: species.palette.belly }]}
            >
              <PetArt speciesId={id} stage="baby" mood={isSelected ? 'joyful' : 'content'} size={96} />
              <View style={styles.text}>
                <Text style={typography.heading}>{species.name}</Text>
                <Text style={styles.body}>{species.tagline}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, textAlign: 'center' },
  list: { gap: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  text: { flex: 1, gap: 2 },
  body: { ...typography.body, fontSize: 14, color: colors.textMuted },
});
