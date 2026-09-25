import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { colors, radius, shadow, spacing, useNativeDriver } from '@/ui/theme';

interface Props {
  icon: string;
  value: string | number;
  color: string;
  accessibilityLabel: string;
}

/** Compact pill for top-bar numbers. Pops when its value changes. */
export function StatChip({ icon, value, color, accessibilityLabel }: Props) {
  const pop = useState(() => new Animated.Value(1))[0];
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pop.setValue(1.25);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 200, useNativeDriver }).start();
  }, [value, pop]);

  return (
    <Animated.View
      style={[styles.chip, shadow, { transform: [{ scale: pop }] }]}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  icon: { fontSize: 16 },
  value: { fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] },
});
