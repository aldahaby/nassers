import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { colors, radius, spacing, useNativeDriver } from '@/ui/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  icon?: string;
  style?: ViewStyle;
  accessibilityHint?: string;
}

/** Chunky, springy game-style button. */
export function Button({ label, onPress, variant = 'primary', disabled = false, icon, style, accessibilityHint }: Props) {
  const scale = useState(() => new Animated.Value(1))[0];
  const press = (to: number) => Animated.spring(scale, { toValue: to, friction: 5, tension: 300, useNativeDriver }).start();
  const v = VARIANTS[variant];

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => press(0.95)}
        onPressOut={() => press(1)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityHint={accessibilityHint}
        style={[styles.base, { backgroundColor: v.bg, borderBottomColor: v.edge }, disabled && styles.disabled]}
      >
        <Text style={[styles.label, { color: v.fg }]}>
          {icon ? `${icon}  ` : ''}
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const VARIANTS: Record<Variant, { bg: string; fg: string; edge: string }> = {
  primary: { bg: colors.primary, fg: colors.white, edge: colors.primaryDark },
  secondary: { bg: colors.primarySoft, fg: colors.primaryDark, edge: '#D6CCFF' },
  ghost: { bg: 'transparent', fg: colors.primaryDark, edge: 'transparent' },
  danger: { bg: colors.danger, fg: colors.white, edge: '#C94052' },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
  },
  label: { fontSize: 17, fontWeight: '800', letterSpacing: 0.2, textAlign: 'center' },
  disabled: { opacity: 0.45 },
});
