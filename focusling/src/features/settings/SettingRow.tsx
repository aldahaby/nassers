import { StyleSheet, Switch, Text, View } from 'react-native';
import { playSound } from '@/services/audio';
import { colors, typography } from '@/ui';

export function SettingRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={typography.body}>{label}</Text>
      <Switch
        value={value}
        onValueChange={(v) => {
          playSound(v ? 'toggle-on' : 'toggle-off');
          onChange(v);
        }} trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.white} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
});
