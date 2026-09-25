import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { getProgression } from '@/core';
import { colors, radius, spacing, typography } from '@/ui';

interface Props {
  xpBefore: number;
  xpAfter: number;
  delay?: number;
  instant?: boolean;
}

/** Levels the fill animates through before jumping straight to the result. */
const MAX_ANIMATED_LEVELS = 3;

function fractionOf(xp: number): number {
  const p = getProgression(xp);
  return p.xpForNextLevel ? p.xpIntoLevel / p.xpForNextLevel : 1;
}

/**
 * XP bar that fills from the old value to the new one, rolling over (and
 * bumping the level label) each time it passes a level boundary.
 */
export function XpGainBar({ xpBefore, xpAfter, delay = 0, instant = false }: Props) {
  const before = getProgression(xpBefore);
  const after = getProgression(xpAfter);
  const [level, setLevel] = useState(instant ? after.level : before.level);
  const [fill] = useState(() => new Animated.Value(instant ? fractionOf(xpAfter) : fractionOf(xpBefore)));

  useEffect(() => {
    if (instant) return;
    let cancelled = false;
    const crossings = after.level - before.level;
    const animated = Math.min(crossings, MAX_ANIMATED_LEVELS);

    const to = (value: number, duration: number, wait = 0) =>
      Animated.timing(fill, { toValue: value, duration, delay: wait, easing: Easing.out(Easing.quad), useNativeDriver: false });

    const step = (i: number) => {
      if (cancelled) return;
      if (i >= animated) {
        setLevel(after.level);
        if (crossings > animated) fill.setValue(0);
        to(fractionOf(xpAfter), 700, i === 0 ? delay : 0).start();
        return;
      }
      to(1, 550, i === 0 ? delay : 0).start(({ finished }) => {
        if (!finished || cancelled) return;
        setLevel(before.level + i + 1);
        fill.setValue(0);
        step(i + 1);
      });
    };
    step(0);
    return () => {
      cancelled = true;
      fill.stopAnimation();
    };
  }, [after.level, before.level, delay, fill, instant, xpAfter]);

  const gained = xpAfter - xpBefore;
  return (
    <View style={styles.wrap} accessible accessibilityLabel={`Level ${after.level}. Plus ${gained} XP.`}>
      <View style={styles.header}>
        <Text style={styles.level}>⭐ Level {level}</Text>
        <Text style={styles.gain}>+{gained} XP</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
      <Text style={styles.caption}>
        {after.xpForNextLevel
          ? `${after.xpIntoLevel} / ${after.xpForNextLevel} XP to level ${after.level + 1}`
          : 'Max level reached'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  level: { ...typography.heading, fontSize: 17 },
  gain: { fontSize: 16, fontWeight: '900', color: colors.xp, fontVariant: ['tabular-nums'] },
  track: { height: 16, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.xp },
  caption: { ...typography.label, fontSize: 12, fontVariant: ['tabular-nums'] },
});
