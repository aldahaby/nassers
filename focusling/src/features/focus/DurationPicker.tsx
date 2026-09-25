import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FOCUS_CONFIG } from '@/config/focus';
import { colors, radius, spacing, typography } from '@/ui';

interface Props {
  minutes: number;
  custom: boolean;
  onSelectPreset: (minutes: number) => void;
  onSelectCustom: () => void;
  onChangeCustom: (minutes: number) => void;
}

/** Preset length chips plus a "Custom" chip that reveals a ±5 minute stepper. */
export function DurationPicker({ minutes, custom, onSelectPreset, onSelectCustom, onChangeCustom }: Props) {
  const { presetDurationsMinutes, customStepMinutes, minCustomMinutes, maxCustomMinutes } = FOCUS_CONFIG;
  const step = (delta: number) =>
    onChangeCustom(Math.min(maxCustomMinutes, Math.max(minCustomMinutes, minutes + delta)));

  return (
    <View style={styles.wrap}>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {presetDurationsMinutes.map((preset) => (
          <Chip
            key={preset}
            label={`${preset}`}
            unit="min"
            selected={!custom && minutes === preset}
            onPress={() => onSelectPreset(preset)}
          />
        ))}
        <Chip label="Custom" selected={custom} onPress={onSelectCustom} />
      </View>
      {custom && (
        <View style={styles.stepper}>
          <StepButton label="−" onPress={() => step(-customStepMinutes)} disabled={minutes <= minCustomMinutes} hint="Five minutes less" />
          <View style={styles.stepValue} accessible accessibilityLabel={`${minutes} minutes`}>
            <Text style={styles.stepNumber}>{minutes}</Text>
            <Text style={typography.label}>minutes</Text>
          </View>
          <StepButton label="+" onPress={() => step(customStepMinutes)} disabled={minutes >= maxCustomMinutes} hint="Five minutes more" />
        </View>
      )}
    </View>
  );
}

function Chip({ label, unit, selected, onPress }: { label: string; unit?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={unit ? `${label} minutes` : label}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
      {unit && <Text style={[styles.chipUnit, selected && styles.chipLabelSelected]}>{unit}</Text>}
    </Pressable>
  );
}

function StepButton({ label, onPress, disabled, hint }: { label: string; onPress: () => void; disabled: boolean; hint: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={hint}
      style={[styles.stepButton, disabled && styles.disabled]}
    >
      <Text style={styles.stepButtonLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  chip: {
    minWidth: 60,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { fontSize: 18, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'] },
  chipUnit: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  chipLabelSelected: { color: colors.white },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  stepButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonLabel: { fontSize: 26, fontWeight: '900', color: colors.primaryDark, lineHeight: 30 },
  stepValue: { alignItems: 'center', minWidth: 80 },
  stepNumber: { fontSize: 34, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'] },
  disabled: { opacity: 0.35 },
});
