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
  // Studyling Start & Lock: protection was asked for but didn't start. Say so plainly.
  if (session.protectionMode === 'none' && session.study?.protectionRequested && session.study.protectionResult === 'failed') {
    const label = 'Protection isn’t on for this session. Your study time still counts.';
    return (
      <View style={[styles.pill, styles.pending]} accessibilityRole="text" accessibilityLabel={label}>
        <Text style={[styles.label, styles.pendingLabel]}>Not protected · {label}</Text>
      </View>
    );
  }
  if (session.protectionMode === 'none' || notice) return null;
  const active = isProtectionActiveFor(status, session.id);
  // The web/dev mock never blocks anything: never claim it did.
  const simulated = status?.platform === 'mock';
  const label = active
    ? simulated
      ? session.protectionMode === 'selective'
        ? 'Reels protection simulated (nothing is blocked on this device)'
        : 'Instagram block simulated (nothing is blocked on this device)'
      : session.protectionMode === 'selective'
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
