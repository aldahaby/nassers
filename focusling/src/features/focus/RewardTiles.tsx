import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '@/ui';

export interface RewardTile {
  icon: string;
  value: string;
  label: string;
  color: string;
}

/** A row of equal-width value tiles (coins, XP, streak…). */
export function RewardTiles({ tiles }: { tiles: RewardTile[] }) {
  return (
    <View style={styles.row}>
      {tiles.map((tile) => (
        <View key={tile.label} style={styles.tile} accessible accessibilityLabel={`${tile.label}: ${tile.value}`}>
          <Text style={styles.icon}>{tile.icon}</Text>
          <Text style={[styles.value, { color: tile.color }]}>{tile.value}</Text>
          <Text style={styles.label}>{tile.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, alignItems: 'center', gap: 2 },
  icon: { fontSize: 22 },
  value: { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  label: { ...typography.label, fontSize: 12, textAlign: 'center' },
});
