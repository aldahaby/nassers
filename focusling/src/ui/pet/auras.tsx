import { useEffect, useState, type ReactElement } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { ItemPalette } from '@/core';
import { motion, useNativeDriver } from '@/ui/theme';
import { sparklePath } from './focusClubArt';

export type Spot = { x: number; y: number; s: number };

/**
 * Aura composition rule (docs/ART_DIRECTION.md): an aura frames the pet, it
 * never sits on it. Every particle centre lies outside the "pet ellipse" (body,
 * face and worn pieces), no particle enters the crest column above the head
 * (sprout, flame, hats), and every particle stays inside the 200×200 box.
 * Tested for every aura layout in `ui/__tests__/artRegistry.test.ts`.
 */
export const AURA_FRAME = {
  pet: { cx: 100, cy: 120, rx: 72, ry: 68 },
  crest: { x1: 78, x2: 122, yMax: 72 },
  box: { min: 0, max: 200 },
  /** Particle box = 24 × spot scale × this (pet units). */
  particleScale: 1.45,
} as const;

/** Where aura particles sit around the pet, in the pet's 200×200 space (clear of the face). */
const SPOTS: readonly Spot[] = [
  { x: 30, y: 76, s: 1 },
  { x: 170, y: 64, s: 0.85 },
  { x: 20, y: 132, s: 0.75 },
  { x: 180, y: 124, s: 1 },
  { x: 34, y: 36, s: 0.7 },
  { x: 168, y: 32, s: 0.8 },
];

type Particle = (p: ItemPalette, i: number) => ReactElement;

/** Speed lines trail behind (left) with a couple of puffs ahead. */
const SPEED_SPOTS: readonly Spot[] = [
  { x: 20, y: 88, s: 1.1 },
  { x: 19, y: 128, s: 1 },
  { x: 26, y: 162, s: 0.9 },
  { x: 184, y: 150, s: 0.75 },
  { x: 40, y: 50, s: 0.8 },
  { x: 180, y: 96, s: 0.7 },
];

/** Fireflies gather on one side (controlled asymmetry), with one stray on the other. */
const FIREFLY_SPOTS: readonly Spot[] = [
  { x: 172, y: 72, s: 1 },
  { x: 182, y: 112, s: 0.8 },
  { x: 160, y: 32, s: 0.85 },
  { x: 178, y: 152, s: 0.7 },
  { x: 26, y: 100, s: 0.75 },
];

/** Pixel hearts: fewer, smaller hearts so the pet stays the focus. */
const HEART_SPOTS: readonly Spot[] = [
  { x: 30, y: 76, s: 0.9 },
  { x: 172, y: 62, s: 0.75 },
  { x: 180, y: 128, s: 0.85 },
  { x: 36, y: 38, s: 0.6 },
];

/** Auras that need their own layout. */
const AURA_SPOTS: Record<string, readonly Spot[]> = { 'aura-speed': SPEED_SPOTS, 'aura-firefly': FIREFLY_SPOTS, 'aura-pixel-hearts': HEART_SPOTS };
export const auraSpotsFor = (key: string): readonly Spot[] => AURA_SPOTS[key] ?? SPOTS;
const spotsFor = auraSpotsFor;

/** One particle drawn in a local 24×24 box. */
const PARTICLES: Record<string, Particle> = {
  'aura-pixel-burst': (p, i) =>
    i % 3 === 0 ? (
      <G>
        <Rect x={6} y={6} width={12} height={12} fill={p.primary} />
        <Rect x={6} y={6} width={4} height={4} fill="#FFFFFF" opacity={0.8} />
      </G>
    ) : i % 3 === 1 ? (
      <G>
        <Rect x={9} y={3} width={6} height={18} fill={p.secondary} />
        <Rect x={3} y={9} width={18} height={6} fill={p.secondary} />
      </G>
    ) : (
      <Rect x={8} y={8} width={8} height={8} fill={p.accent} />
    ),
  'aura-dream': (p, i) =>
    i % 3 === 0 ? (
      <Path d={sparklePath(12, 12, 10)} fill={p.primary} stroke="#9C82E8" strokeWidth={0.8} />
    ) : i % 3 === 1 ? (
      <G>
        <Circle cx={8} cy={14} r={5} fill="#FFFFFF" stroke={p.secondary} strokeWidth={1} />
        <Circle cx={14} cy={11} r={6.5} fill="#FFFFFF" stroke={p.secondary} strokeWidth={1} />
        <Circle cx={19} cy={15} r={4} fill="#FFFFFF" stroke={p.secondary} strokeWidth={1} />
        <Rect x={8} y={14} width={11} height={5} fill="#FFFFFF" />
      </G>
    ) : (
      <G>
        <Circle cx={12} cy={12} r={7} fill={p.accent} opacity={0.35} stroke={p.accent} strokeWidth={1.4} />
        <Circle cx={9.5} cy={9.5} r={1.8} fill="#FFFFFF" />
      </G>
    ),
  'aura-speed': (p, i) =>
    i === 3 || i === 5 ? (
      <G>
        <Circle cx={9} cy={14} r={5} fill={p.primary} stroke={p.secondary} strokeWidth={1.2} />
        <Circle cx={15} cy={12} r={6} fill={p.primary} stroke={p.secondary} strokeWidth={1.2} />
      </G>
    ) : (
      <G>
        <Path d="M3 8 L21 8" stroke={p.secondary} strokeWidth={2.6} strokeLinecap="round" />
        <Path d="M8 13 L22 13" stroke={p.accent} strokeWidth={2.6} strokeLinecap="round" />
        <Path d="M5 18 L16 18" stroke={p.secondary} strokeWidth={2.2} strokeLinecap="round" opacity={0.7} />
      </G>
    ),
  'aura-sparkle': (p, i) => <Path d={sparklePath(12, 12, 10)} fill={i % 2 ? p.accent : p.primary} stroke={p.secondary} strokeWidth={1} />,
  'aura-sleepy-stars': (p, i) =>
    i % 3 === 2 ? (
      <Path d="M6 7 L17 7 L7 17 L18 17" stroke={p.secondary} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    ) : (
      <Path d={sparklePath(12, 12, 8)} fill={p.primary} stroke={p.secondary} strokeWidth={1} />
    ),
  'aura-firefly': (p, i) => (
    <G>
      {/* A soft glow, a bright tail and two tiny wings: flat shapes, no blur. */}
      <Circle cx={12} cy={13} r={10.5} fill={p.primary} opacity={0.22} />
      <Circle cx={12} cy={13} r={6.8} fill={p.primary} opacity={0.4} />
      <Ellipse cx={9} cy={8.5} rx={3.2} ry={2} fill="#FFFFFF" opacity={0.75} transform="rotate(-30 9 8.5)" />
      <Ellipse cx={15} cy={8.5} rx={3.2} ry={2} fill="#FFFFFF" opacity={0.75} transform="rotate(30 15 8.5)" />
      <Circle cx={12} cy={14} r={4.2} fill={i % 2 ? p.accent : p.primary} stroke={p.secondary} strokeWidth={1.1} />
      <Circle cx={12} cy={9.6} r={1.8} fill={p.secondary} />
    </G>
  ),
  'aura-pixel-hearts': (p) => (
    <G>
      {/* A 5×5 pixel heart, 3-unit cells (about 15 units wide), centred. */}
      {[
        [1, 0], [3, 0],
        [0, 1], [1, 1], [2, 1], [3, 1], [4, 1],
        [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
        [1, 3], [2, 3], [3, 3],
        [2, 4],
      ].map(([x, y]) => (
        <Rect key={`${x}-${y}`} x={4.5 + x! * 3} y={4.5 + y! * 3} width={3} height={3} fill={x === 1 && y === 1 ? p.accent : p.primary} />
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
      {spotsFor(artKey).map((spot, i) => (
        <G key={i} transform={`translate(${spot.x - 12 * spot.s * 1.5} ${spot.y - 12 * spot.s * 1.5}) scale(${spot.s * 1.5})`}>
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
  const spots = spotsFor(artKey);
  const [phases] = useState(() => spots.map(() => new Animated.Value(1)));

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
      {spots.map((spot, i) => {
        const phase = phases[i];
        // Layouts differ per aura; PetArt remounts on change, this guard just keeps a stray render safe.
        if (!phase) return null;
        // Kept small so the aura supports the pet instead of competing with it.
        const box = 24 * spot.s * unit * AURA_FRAME.particleScale;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: spot.x * unit - box / 2,
              top: spot.y * unit - box / 2,
              width: box,
              height: box,
              opacity: phase,
              transform: [{ translateY: phase.interpolate({ inputRange: [0.25, 1], outputRange: [3 * unit, 0] }) }],
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
