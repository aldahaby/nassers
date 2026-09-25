import { StyleSheet, Text, View } from 'react-native';
import { isProtectionActiveFor, type FocusSession } from '@/core';
import { useGameStore } from '@/state';
import { colors, radius, spacing } from '@/ui';

/**
 * "Reels protection active" appears only when native status confirms it for
 * this session ID. JavaScript state alone never turns it on.
 */
export function ProtectionStatusPill({ session }: { session: FocusSession }) {
  const status = useGameStore((s) => s.protection);
  const notice = useGameStore((s) => s.protectionNotice);
  if (session.protectionMode === 'none' || notice) return null;
  const active = isProtectionActiveFor(status, session.id);
  const label = active
    ? session.protectionMode === 'selective'
      ? 'Reels protection active'
      : 'Instagram blocked for this session'
    : 'Checking protection…';
  return (
    <View style={[styles.pill, !active && styles.pending]} accessibilityRole="text" accessibilityLabel={label}>
      <Text style={[styles.label, !active && styles.pendingLabel]}>🛡 {label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { backgroundColor: '#E3F9EC', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  pending: { backgroundColor: colors.surfaceMuted },
  label: { fontSize: 13, fontWeight: '800', color: '#2E9E62' },
  pendingLabel: { color: colors.textMuted },
});
