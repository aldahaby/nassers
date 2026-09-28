import { useEffect } from 'react';
import { playSound } from '@/services/audio';
import { StyleSheet, Text, View } from 'react-native';
import type { MissionCompletion } from '@/core';
import { colors, radius, spacing, typography, Pressable } from '@/ui';

interface Props {
  completion: MissionCompletion;
  petName: string;
  onDismiss: () => void;
}

/** Calm mission celebration: one line, the reward, and a thank-you. No confetti. */
export function MissionCelebrationCard({ completion, petName, onDismiss }: Props) {
  // A warm resolve as the card appears (once per card).
  useEffect(() => {
    playSound('confirm');
  }, []);
  return (
    <View style={styles.card} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={styles.text}>
        <Text style={styles.title}>{completion.title} complete!</Text>
        <Text style={styles.reward}>
          +{completion.coins} coins  +{completion.xp} XP
        </Text>
        <Text style={styles.body}>{petName} is proud of you.</Text>
      </View>
      <Pressable onPress={onDismiss} style={styles.close} accessibilityRole="button" accessibilityLabel="Dismiss">
        <Text style={styles.closeText}>OK</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.successSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.successBorder,
  },
  text: { flex: 1, gap: 2 },
  title: { ...typography.heading, fontSize: 18 },
  reward: { ...typography.number, color: colors.success },
  body: { ...typography.label },
  close: { minWidth: 56, minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontWeight: '800', color: colors.primaryDark },
});
