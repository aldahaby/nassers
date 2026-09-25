import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { colors, radius, shadow, spacing, useNativeDriver } from '@/ui/theme';

/** A small bubble that pops in whenever `text` changes. */
export function SpeechBubble({ text }: { text: string | null }) {
  const anim = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    anim.setValue(0);
    if (text) Animated.spring(anim, { toValue: 1, friction: 5, tension: 140, useNativeDriver }).start();
  }, [text, anim]);

  if (!text) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.bubble, shadow, { opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}
    >
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: '80%',
  },
  text: { fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'center' },
});
