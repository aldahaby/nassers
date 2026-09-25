import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '@/state';
import { colors, radius, spacing, typography } from '@/ui';
import { MODE_LABEL } from './protectionCopy';

/** One calm line on the focus setup screen; details live on the Protection screen. */
export function ProtectionSummaryRow() {
  const mode = useGameStore((s) => s.save?.protection.mode ?? 'none');
  const count = useGameStore((s) => s.protection?.selectedTargetCount ?? 0);
  const on = mode !== 'none';

  return (
    <Pressable style={styles.row} onPress={() => router.push('/protection')} accessibilityRole="button" accessibilityLabel="Focus protection settings">
      <View style={styles.text}>
        <Text style={styles.eyebrow}>FOCUS PROTECTION</Text>
        <Text style={styles.title}>{on ? `Instagram · ${MODE_LABEL[mode]}` : 'Off'}</Text>
        <Text style={styles.meta}>
          {on ? (count > 0 ? `${count} app${count === 1 ? '' : 's'} protected` : 'Choose the app to protect') : 'Focus on the honor system'}
        </Text>
      </View>
      <Text style={styles.change}>{on ? 'Change' : 'Set up'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 2, borderColor: colors.border },
  text: { flex: 1, gap: 2 },
  eyebrow: { ...typography.label, fontSize: 11, letterSpacing: 0.8 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  meta: { ...typography.label, fontWeight: '600', fontSize: 12 },
  change: { fontSize: 15, fontWeight: '800', color: colors.primaryDark },
});
