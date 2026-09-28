import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { getReaction } from '@/config/reactions';
import { REACTION_SOUNDS } from '@/config/sounds';
import { playSound } from '@/services/audio';
import type { ReactionStyle } from '@/core';
import { useNativeDriver } from '@/ui';
import { sparklePath, starPath } from '@/ui/pet/focusClubArt';
import type { FaceExpression } from '@/ui/pet/PetFace';

/**
 * Reactions: short, original pet behaviours. Each style has two renderings:
 * - full: body motion (hop, sway, float, dash, spin) plus a small effect;
 * - Reduce Motion: the same face and the same effect, faded in place, with at
 *   most a gentle scale. Personality stays; movement doesn't.
 * Every animation is a finite timing (no loops), and ends by itself.
 */

const FACE: Record<ReactionStyle, Exclude<FaceExpression, 'blink'>> = {
  wave: 'delighted',
  hop: 'excited',
  sleepy: 'sleepy',
  cool: 'wink',
  twirl: 'excited',
  'pixel-pop': 'wink',
  'dream-float': 'sleepy',
  'victory-lap': 'proud',
  firefly: 'curious',
};

export interface Performance {
  style: ReactionStyle;
  /** Changes every time a reaction plays (lets effects re-mount cleanly). */
  run: number;
}

export function useReactionPerformer(size: number, reducedMotion: boolean, onHop: () => void) {
  const [values] = useState(() => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    rotate: new Animated.Value(0),
    scale: new Animated.Value(1),
    fx: new Animated.Value(0),
  }));
  const [performing, setPerforming] = useState<Performance | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const runs = useRef(0);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const play = useCallback(
    (reactionId: string) => {
      const def = getReaction(reactionId);
      if (!def) return;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      const { x, y, rotate, scale, fx } = values;
      [x, y, rotate].forEach((v) => {
        v.stopAnimation();
        v.setValue(0);
      });
      scale.setValue(1);
      fx.setValue(0);
      runs.current += 1;
      setPerforming({ style: def.style, run: runs.current });
      // A short accent with the first beat of the motion (never during focus: the service refuses).
      playSound(REACTION_SOUNDS[def.style]);
      const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
      const t = (v: Animated.Value, toValue: number, duration: number, easing = Easing.inOut(Easing.quad)) =>
        Animated.timing(v, { toValue, duration, easing, useNativeDriver });
      const duration = reducedMotion ? Math.min(def.durationMs, 1400) : def.durationMs;

      // The effect layer always runs (it's how Reduce Motion keeps the feeling).
      t(fx, 1, duration, Easing.out(Easing.cubic)).start();

      if (reducedMotion) {
        Animated.sequence([t(scale, 1.04, 220), t(scale, 1, 320)]).start();
        // The calm "happy" beat: AnimatedPet shows a delighted face and fading hearts, no hop.
        if (def.style === 'hop' || def.style === 'twirl' || def.style === 'victory-lap') onHop();
      } else {
        const s = size;
        switch (def.style) {
          case 'wave':
            Animated.sequence([t(rotate, 1, 180), t(rotate, -1, 260), t(rotate, 1, 260), t(rotate, 0, 200)]).start();
            break;
          case 'hop':
            onHop();
            later(560, onHop);
            break;
          case 'sleepy':
            Animated.sequence([t(scale, 0.96, 500), Animated.delay(1100), t(scale, 1, 500)]).start();
            Animated.sequence([t(rotate, 0.5, 600), Animated.delay(900), t(rotate, 0, 500)]).start();
            break;
          case 'cool':
            Animated.sequence([t(rotate, 0.7, 260, Easing.out(Easing.back(2))), Animated.delay(900), t(rotate, 0, 300)]).start();
            break;
          case 'twirl':
            Animated.sequence([t(y, -s * 0.06, 180), t(rotate, 4, 800, Easing.inOut(Easing.cubic)), t(y, 0, 220)]).start();
            later(1100, onHop);
            break;
          case 'pixel-pop':
            Animated.sequence([t(scale, 0.9, 120), t(scale, 1.08, 160, Easing.out(Easing.back(2))), t(scale, 1, 200)]).start();
            Animated.sequence([Animated.delay(420), t(rotate, -0.8, 220), Animated.delay(500), t(rotate, 0, 240)]).start();
            break;
          case 'dream-float':
            Animated.sequence([t(y, -s * 0.09, 800, Easing.inOut(Easing.sin)), Animated.delay(500), t(y, 0, 800, Easing.inOut(Easing.sin))]).start();
            Animated.sequence([t(rotate, 0.4, 700), t(rotate, -0.4, 700), t(rotate, 0, 600)]).start();
            break;
          case 'firefly':
            // A slow, small wave: calmer than Wave, so the fireflies carry it.
            Animated.sequence([t(rotate, 0.5, 400), t(rotate, -0.4, 500), t(rotate, 0.3, 450), t(rotate, 0, 400)]).start();
            break;
          case 'victory-lap':
            Animated.sequence([
              t(x, s * 0.22, 260, Easing.out(Easing.quad)),
              t(x, -s * 0.22, 420, Easing.inOut(Easing.quad)),
              t(x, 0, 280, Easing.out(Easing.back(1.4))),
            ]).start();
            later(1000, onHop);
            break;
        }
      }
      later(duration + 80, () => setPerforming(null));
    },
    [onHop, reducedMotion, size, values],
  );

  const transform = [
    { translateX: values.x },
    { translateY: values.y },
    // rotate: -1..1 ≈ ±12°, a full twirl uses 4 (= 360°).
    { rotate: values.rotate.interpolate({ inputRange: [-1, 0, 1, 4], outputRange: ['-12deg', '0deg', '12deg', '360deg'] }) },
    { scale: values.scale },
  ];

  return { play, performing, transform, fx: values.fx, face: performing ? FACE[performing.style] : null };
}

/** The effect drawn around the pet for a reaction. Moves only when motion is allowed. */
export function ReactionEffect({ performance, fx, size, reducedMotion }: { performance: Performance; fx: Animated.Value; size: number; reducedMotion: boolean }) {
  const m = reducedMotion ? 0 : 1;
  const fade = fx.interpolate({ inputRange: [0, 0.12, 0.75, 1], outputRange: [0, 1, 1, 0] });
  // Reduce Motion: each piece appears where it would have ended up, and fades in place.
  const piece = (key: string | number, left: number, top: number, box: number, dx: number, dy: number, child: ReactNode, extraScale = false) => (
    <Animated.View
      key={key}
      style={{
        position: 'absolute',
        left: left + (reducedMotion ? dx : 0) - box / 2,
        top: top + (reducedMotion ? dy : 0) - box / 2,
        width: box,
        height: box,
        opacity: fade,
        transform: [
          { translateX: fx.interpolate({ inputRange: [0, 1], outputRange: [0, dx * m] }) },
          { translateY: fx.interpolate({ inputRange: [0, 1], outputRange: [0, dy * m] }) },
          ...(extraScale && !reducedMotion ? [{ scale: fx.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 1.2, 1] }) }] : []),
        ],
      }}
    >
      <Svg width={box} height={box} viewBox="0 0 24 24">
        {child}
      </Svg>
    </Animated.View>
  );
  const s = size;
  const c = { x: s * 0.55, y: s * 0.5 };
  let pieces: ReactNode[] = [];

  switch (performance.style) {
    case 'wave':
      pieces = [0, 1, 2].map((i) =>
        piece(i, c.x + s * 0.44, c.y - s * 0.18 + i * 10, 22, 6, -4, <Path d={`M6 ${4 + i} Q14 12 6 ${20 - i}`} stroke="#7B5CFF" strokeWidth={2.6} fill="none" strokeLinecap="round" />),
      );
      break;
    case 'hop':
      pieces = [];
      break;
    case 'sleepy':
      pieces = [0, 1].map((i) =>
        piece(i, c.x + s * 0.3 + i * 12, c.y - s * 0.3 - i * 14, 18 + i * 4, 10, -s * 0.18, <Path d="M6 7 L17 7 L7 17 L18 17" stroke="#7E62D6" strokeWidth={2.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />),
      );
      break;
    case 'cool':
      pieces = [piece('glint', c.x + s * 0.28, c.y - s * 0.28, 26, 0, 0, <Path d={sparklePath(12, 12, 11)} fill="#FFD166" stroke="#E8A93A" strokeWidth={1} />, true)];
      break;
    case 'twirl':
      pieces = [0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return piece(i, c.x, c.y, 18, Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.42, <Path d={starPath(12, 12, 10)} fill="#FFD166" stroke="#E8A93A" strokeWidth={1} />);
      });
      break;
    case 'pixel-pop':
      pieces = ['#5CF0FF', '#8B5CFF', '#FF4FD8', '#5CF0FF', '#8B5CFF', '#FF4FD8'].map((color, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        return piece(i, c.x, c.y, 16, Math.cos(a) * s * 0.52, Math.sin(a) * s * 0.44, <Rect x={4} y={4} width={16} height={16} fill={color} />);
      });
      break;
    case 'dream-float':
      pieces = [
        [-0.38, -0.2],
        [0.4, -0.28],
        [-0.3, 0.2],
        [0.36, 0.16],
      ].map(([dx, dy], i) =>
        piece(i, c.x + s * dx!, c.y + s * dy!, 16 + (i % 2) * 6, 0, -8, i % 2 ? <Path d={sparklePath(12, 12, 10)} fill="#CDB8FF" /> : <Circle cx={12} cy={12} r={6} fill="#FFC4E1" opacity={0.8} />),
      );
      break;
    case 'firefly':
      // Fireflies drift up one side (asymmetric, like the Moss Club aura) and blink.
      // Reduce Motion: they appear in place and fade, no drifting.
      pieces = [
        [0.3, 0.06, 0],
        [0.38, -0.1, 1],
        [0.24, -0.2, 2],
        [-0.34, -0.02, 3],
      ].map(([dx, dy, i]) =>
        piece(
          i!,
          c.x + s * dx!,
          c.y + s * dy!,
          Math.round(s * (i! % 2 ? 0.1 : 0.12)),
          i! % 2 ? -4 : 5,
          -s * 0.06,
          <G>
            <Circle cx={12} cy={12} r={10} fill="#E9F27A" opacity={0.4} />
            <Circle cx={12} cy={12} r={4.6} fill="#F6FB9E" stroke="#6E9B4E" strokeWidth={1.2} />
          </G>,
        ),
      );
      break;
    case 'victory-lap':
      pieces = [0, 1, 2].map((i) =>
        piece(i, c.x - s * 0.5, c.y - s * 0.12 + i * s * 0.14, 30, -12, 0, <G><Path d="M2 12 L22 12" stroke={i === 1 ? '#2E5BD6' : '#FF8A3D'} strokeWidth={3} strokeLinecap="round" /></G>),
      );
      break;
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces}
    </View>
  );
}
