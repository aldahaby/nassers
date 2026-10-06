import { Switch } from 'react-native';
import { playSound } from '@/services/audio';
import { colors } from '@/ui';

/** A switch with the app's toggle cues (same as Settings rows). */
export function Toggle({ value, onValueChange, accessibilityLabel, disabled }: { value: boolean; onValueChange: (v: boolean) => void; accessibilityLabel: string; disabled?: boolean }) {
  return (
    <Switch
      value={value}
      disabled={disabled}
      onValueChange={(v) => {
        playSound(v ? 'toggle-on' : 'toggle-off');
        onValueChange(v);
      }}
      trackColor={{ true: colors.primary, false: colors.border }}
      thumbColor={colors.white}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
