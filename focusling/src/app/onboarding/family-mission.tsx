import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MISSION_PRESETS } from '@/config/missions';
import { draftFromPreset } from '@/core';
import { PresetOption } from '@/features/missions/PresetOption';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import { useOnboardingProgress } from '@/features/onboarding/flow';
import { useGameStore } from '@/state';
import { colors, spacing, typography } from '@/ui';

/** Last family setup step: pick a first mission, then hand the device to the child. */
export default function FamilyMissionScreen() {
  const family = useGameStore((s) => s.save?.family);
  const pet = useGameStore((s) => s.save?.pet);
  const { addMission, finishFamilySetup } = useGameStore.getState();
  const progress = useOnboardingProgress('family-mission');
  const [selected, setSelected] = useState<string | null>(null);

  if (!family?.gate) return <Redirect href="/onboarding/family-pin" />;
  if (!pet) return <Redirect href="/onboarding/choose" />;

  const finish = (presetId: string | null) => {
    const preset = MISSION_PRESETS.find((p) => p.id === presetId);
    if (preset?.available) addMission(draftFromPreset(preset));
    finishFamilySetup();
    router.replace('/(child)');
  };

  return (
    <OnboardingStep
      {...progress}
      actionLabel={selected ? `Start with this mission` : 'Pick a mission'}
      actionDisabled={!selected}
      onAction={() => finish(selected)}
      secondaryLabel="Skip for now"
      onSecondary={() => finish(null)}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Choose a first mission</Text>
        <Text style={styles.body}>
          {family.child.nickname || 'Your child'} earns bonus coins for {pet.name} when it’s done. You can change missions any time.
        </Text>
      </View>
      <View style={styles.list} accessibilityRole="radiogroup">
        {MISSION_PRESETS.map((preset) => (
          <PresetOption key={preset.id} preset={preset} selected={selected === preset.id} onPress={() => setSelected(preset.id)} />
        ))}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  title: { ...typography.title, textAlign: 'center' },
  body: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 23 },
  list: { gap: spacing.md },
});
