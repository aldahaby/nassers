import { StyleSheet, Text, View } from 'react-native';
import { PARENT_GATE } from '@/config/family';
import { colors, shadow, spacing, Pressable } from '@/ui';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Called once the PIN has all its digits. */
  onComplete?: (pin: string) => void;
  disabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

/** Large, accessible number pad with filled-dot feedback. Digits are never shown. */
export function PinPad({ value, onChange, onComplete, disabled = false }: Props) {
  const length = PARENT_GATE.pinLength;

  const press = (key: (typeof KEYS)[number]) => {
    if (disabled) return;
    if (key === 'del') return onChange(value.slice(0, -1));
    if (!key || value.length >= length) return;
    const next = value + key;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.dots} accessible accessibilityLabel={`${value.length} of ${length} digits entered`}>
        {Array.from({ length }, (_, i) => (
          <View key={i} style={[styles.dot, i < value.length && styles.dotFilled]} />
        ))}
      </View>
      <View style={styles.grid}>
        {KEYS.map((key, i) =>
          key === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <Pressable
              key={i}
              onPress={() => press(key)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={key === 'del' ? 'Delete digit' : key}
              style={({ pressed }) => [styles.key, styles.keyButton, shadow, pressed && styles.keyPressed, disabled && styles.keyDisabled]}
            >
              <Text style={[styles.keyText, key === 'del' && styles.delText]}>{key === 'del' ? '⌫' : key}</Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const KEY = 72;

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xl },
  dots: { flexDirection: 'row', gap: spacing.lg },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.primaryDark },
  dotFilled: { backgroundColor: colors.primaryDark },
  grid: { width: KEY * 3 + spacing.lg * 2, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  key: { width: KEY, height: KEY, borderRadius: KEY / 2, alignItems: 'center', justifyContent: 'center' },
  keyButton: { backgroundColor: colors.surface },
  keyPressed: { backgroundColor: colors.primarySoft },
  keyDisabled: { opacity: 0.4 },
  keyText: { fontSize: 28, fontWeight: '800', color: colors.text },
  delText: { fontSize: 24, color: colors.textMuted },
});
