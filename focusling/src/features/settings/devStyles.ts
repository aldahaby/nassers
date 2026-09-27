import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/ui';

/** Shared layout for developer tool panels. */
export const devStyles = StyleSheet.create({
  muted: { ...typography.body, fontSize: 14, color: colors.textMuted },
  status: { ...typography.label, color: colors.primaryDark, fontVariant: ['tabular-nums'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { flexGrow: 1, flexBasis: '45%' },
});
