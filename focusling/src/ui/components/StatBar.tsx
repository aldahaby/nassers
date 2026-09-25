import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/ui/theme';

interface Props {
  label: string;
  icon: string;
  value: number;
  max: number;
  color: string;
  /** Optional right-hand text; defaults to "value/max". */
  valueText?: string;
}

/** Labelled progress bar that animates smoothly when its value changes. */
export function StatBar({ label, icon, value, max, color, valueText }: Props) {
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const width = useState(() => new Animated.Value(fraction))[0];

  useEffect(() => {
    // Width can't use the native driver.
    Animated.spring(width, { toValue: fraction, friction: 8, tension: 60, useNativeDriver: false }).start();
  }, [fraction, width]);

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: Math.round(value) }}
    >
      <View style={styles.header}>
        <Text style={styles.label}>
          {icon} {label}
        </Text>
        <Text style={styles.value}>{valueText ?? `${Math.round(value)}/${max}`}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            { backgroundColor: color, width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { ...typography.label, color: colors.text },
  value: { ...typography.label, fontVariant: ['tabular-nums'] },
  track: { height: 14, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
