import { StyleSheet, Text, View } from 'react-native';
import type { PetStats, ProgressionState } from '@/core';
import { Card, StatBar, colors, spacing, typography } from '@/ui';

interface Props {
  stats: PetStats;
  progression: ProgressionState;
}

export function PetStatsCard({ stats, progression }: Props) {
  const { xpIntoLevel, xpForNextLevel, level, lifetimeXp } = progression;
  return (
    <Card>
      <StatBar label="Happiness" icon="💖" value={stats.happiness} max={100} color={colors.happiness} />
      <StatBar label="Health" icon="🍀" value={stats.health} max={100} color={colors.health} />
      {xpForNextLevel !== null ? (
        <StatBar
          label={`XP to level ${level + 1}`}
          icon="✨"
          value={xpIntoLevel}
          max={xpForNextLevel}
          color={colors.xp}
        />
      ) : (
        <View style={styles.max}>
          <Text style={typography.label}>✨ Max level: {lifetimeXp} XP</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  max: { paddingVertical: spacing.xs },
});
