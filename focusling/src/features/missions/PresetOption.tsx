import { StyleSheet, Text, View } from 'react-native';
import { MISSION_REWARD_LEVELS, type MissionPreset } from '@/config/missions';
import { colors, radius, shadow, spacing, typography, Pressable } from '@/ui';
import { formatRecurrence } from './missionCopy';

interface Props {
  preset: MissionPreset;
  selected?: boolean;
  onPress: () => void;
  /** Label for the trailing action, e.g. "Add". Omit for radio-style selection. */
  actionLabel?: string;
}

/** A mission template. Unavailable ones are labelled and can't be picked. */
export function PresetOption({ preset, selected = false, onPress, actionLabel }: Props) {
  const reward = MISSION_REWARD_LEVELS[preset.reward];
  const disabled = !preset.available;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={actionLabel ? 'button' : 'radio'}
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${preset.title}. ${preset.description} ${formatRecurrence(preset.recurrence)}. ${
        disabled ? 'Not available yet.' : `Reward ${reward.coins} coins and ${reward.xp} XP.`
      }${actionLabel && !disabled ? ` ${actionLabel}.` : ''}`}
      style={[styles.option, shadow, selected && styles.selected, disabled && styles.disabled]}
    >
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{preset.title}</Text>
          {disabled && <Text style={styles.soon}>Not available yet</Text>}
        </View>
        <Text style={styles.body}>{preset.description}</Text>
        <Text style={styles.meta}>
          {formatRecurrence(preset.recurrence)}
          {disabled ? '' : ` · +${reward.coins} coins · +${reward.xp} XP`}
        </Text>
      </View>
      {actionLabel ? (
        !disabled && <Text style={styles.action}>{actionLabel}</Text>
      ) : (
        <View style={[styles.radio, selected && styles.radioOn]}>{selected && <Text style={styles.check}>✓</Text>}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: 'transparent',
    minHeight: 64,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  disabled: { backgroundColor: colors.surfaceMuted },
  text: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.heading, fontSize: 17 },
  soon: { ...typography.label, fontSize: 11, backgroundColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2, overflow: 'hidden' },
  body: { ...typography.body, fontSize: 14, color: colors.textMuted },
  meta: { ...typography.label, fontSize: 12 },
  action: { fontWeight: '800', color: colors.primaryDark, fontSize: 15 },
  radio: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  check: { color: colors.white, fontWeight: '900' },
});
