import { StyleSheet, View } from 'react-native';
import { StatChip, colors, spacing } from '@/ui';

interface Props {
  coins: number;
  streakDays: number;
  level: number;
}

export function PetTopBar({ coins, streakDays, level }: Props) {
  return (
    <View style={styles.row}>
      <StatChip icon="⭐" value={`Lv ${level}`} color={colors.primaryDark} accessibilityLabel={`Level ${level}`} />
      <View style={styles.right}>
        <StatChip icon="🔥" value={streakDays} color={colors.streak} accessibilityLabel={`${streakDays} day streak`} />
        <StatChip icon="🪙" value={coins} color={colors.coinDark} accessibilityLabel={`${coins} coins`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  right: { flexDirection: 'row', gap: spacing.sm },
});
