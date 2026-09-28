import { useEffect, useState, type ReactElement } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import type { ItemPalette } from '@/core';
import { motion, useNativeDriver } from '@/ui/theme';
import { sparklePath } from './focusClubArt';

/** Where aura particles sit around the pet, in the pet's 200×200 space. */
const SPOTS: readonly { x: number; y: number; s: number }[] = [
  { x: 30, y: 76, s: 1 },
  { x: 170, y: 64, s: 0.85 },
  { x: 20, y: 132, s: 0.75 },
  { x: 180, y: 124, s: 1 },
  { x: 52, y: 38, s: 0.7 },
  { x: 150, y: 30, s: 0.8 },
];

type Particle = (p: ItemPalette, i: number) => ReactElement;

/** One particle drawn in a local 24×24 box. */
const PARTICLES: Record<string, Particle> = {
  'aura-sparkle': (p, i) => <Path d={sparklePath(12, 12, 10)} fill={i % 2 ? p.accent : p.primary} stroke={p.secondary} strokeWidth={1} />,
  'aura-sleepy-stars': (p, i) =>
    i % 3 === 2 ? (
      <Path d="M6 7 L17 7 L7 17 L18 17" stroke={p.secondary} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    ) : (
      <Path d={sparklePath(12, 12, 8)} fill={p.primary} stroke={p.secondary} strokeWidth={1} />
    ),
  'aura-pixel-hearts': (p) => (
    <G>
      {/* A 5×5 pixel heart. */}
      {[
        [1, 0], [3, 0],
        [0, 1], [1, 1], [2, 1], [3, 1], [4, 1],
        [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
        [1, 3], [2, 3], [3, 3],
        [2, 4],
      ].map(([x, y]) => (
        <Rect key={`${x}-${y}`} x={2 + x! * 4} y={3 + y! * 4} width={4} height={4} fill={x === 1 && y === 1 ? p.accent : p.primary} />
      ))}
    </G>
  ),
};

export function hasAuraArt(key: string): boolean {
  return key in PARTICLES;
}

/** Static aura for icons: every particle at full opacity in pet space. */
export function AuraIcon({ artKey, palette, size }: { artKey: string; palette: ItemPalette; size: number }) {
  const particle = PARTICLES[artKey];
  if (!particle) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {SPOTS.map((spot, i) => (
        <G key={i} transform={`translate(${spot.x - 12 * spot.s * 1.8} ${spot.y - 12 * spot.s * 1.8}) scale(${spot.s * 1.8})`}>
          {particle(palette, i)}
        </G>
      ))}
    </Svg>
  );
}

interface LayerProps {
  artKey: string;
  palette: ItemPalette;
  /** The pet's rendered size (its 200-unit box). */
  size: number;
  /** Gentle twinkle. Off for Reduce Motion, focus sessions and thumbnails. */
  animated: boolean;
  /** Softer during focus sessions. */
  dim?: boolean;
}

/**
 * Emotion aura around the pet. Particles twinkle slowly out of phase; with
 * `animated` off they're simply shown (the Reduce Motion alternative).
 */
export function AuraLayer({ artKey, palette, size, animated, dim = false }: LayerProps) {
  const particle = PARTICLES[artKey];
  const [phases] = useState(() => SPOTS.map(() => new Animated.Value(1)));

  useEffect(() => {
    if (!animated) {
      phases.forEach((v) => v.setValue(1));
      return;
    }
    const loops = phases.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 260),
          Animated.timing(v, { toValue: 0.25, duration: motion.ambient, easing: Easing.inOut(Easing.sin), useNativeDriver }),
          Animated.timing(v, { toValue: 1, duration: motion.ambient, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [animated, phases]);

  if (!particle) return null;
  const unit = size / 200;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: dim ? 0.55 : 1 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {SPOTS.map((spot, i) => {
        const box = 24 * spot.s * 0.9 * unit * 1.9;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: spot.x * unit - box / 2,
              top: spot.y * unit - box / 2,
              width: box,
              height: box,
              opacity: phases[i],
              transform: [{ translateY: phases[i]!.interpolate({ inputRange: [0.25, 1], outputRange: [3 * unit, 0] }) }],
            }}
          >
            <Svg width={box} height={box} viewBox="0 0 24 24">
              {particle(palette, i)}
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
}
