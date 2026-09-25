import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { getShopItem, type ToyPlayStyle } from '@/config/shopCatalog';
import type { EquipSlot, GrowthStage, PetMood, PetSpeciesId } from '@/core';
import type { PetReaction } from '@/state';
import { AnimatedPet, ItemArt, colors, useNativeDriver } from '@/ui';

interface Props {
  speciesId: PetSpeciesId;
  stage: GrowthStage;
  mood: PetMood;
  equipped: Partial<Record<EquipSlot, string>>;
  size: number;
  expression?: 'auto' | 'focused';
  /** Queued reaction from the store; played when this screen is focused. */
  reaction: PetReaction | null;
  onReactionStart: (reaction: PetReaction) => void;
  onPress?: () => void;
  /** Extra hop triggers from the parent (e.g. welcome back). */
  cheerKey?: number;
  accessibilityLabel?: string;
}

type Playing = { reaction: PetReaction; style: ToyPlayStyle | 'eat' | 'show' };

const REACTION_MS: Record<Playing['style'], number> = {
  bounce: 1900,
  hug: 2300,
  spin: 1900,
  bubbles: 2300,
  eat: 2100,
  show: 1400,
};

/**
 * The pet plus whatever it's doing: bouncing a ball, hugging the bear, twirling
 * the star, chasing bubbles, eating, or showing off a new item.
 */
export function PetReactionStage({
  speciesId,
  stage,
  mood,
  equipped,
  size,
  expression = 'auto',
  reaction,
  onReactionStart,
  onPress,
  cheerKey: parentCheer = 0,
  accessibilityLabel,
}: Props) {
  const focused = useIsFocused();
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [cheer, setCheer] = useState(0);
  const [chomp, setChomp] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [prop] = useState(() => ({ x: new Animated.Value(0), y: new Animated.Value(0), scale: new Animated.Value(0), spin: new Animated.Value(0) }));
  const [petTilt] = useState(() => new Animated.Value(0));
  const [sparkle] = useState(() => new Animated.Value(0));
  const [bubbles] = useState(() => Array.from({ length: 9 }, () => new Animated.Value(0)));

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const run = useCallback(
    (next: Playing) => {
      const s = size;
      prop.x.setValue(0);
      prop.y.setValue(0);
      prop.scale.setValue(0);
      prop.spin.setValue(0);
      petTilt.setValue(0);
      sparkle.setValue(0);
      bubbles.forEach((b) => b.setValue(0));
      const t = (v: Animated.Value, toValue: number, duration: number, easing = Easing.inOut(Easing.quad)) =>
        Animated.timing(v, { toValue, duration, easing, useNativeDriver });

      switch (next.style) {
        case 'bounce': {
          // The ball rolls in from the right and bounces three times; the pet hops along.
          prop.x.setValue(s * 0.7);
          prop.scale.setValue(1);
          Animated.parallel([
            t(prop.x, s * 0.42, 1500, Easing.out(Easing.quad)),
            Animated.sequence(
              [0.5, 0.36, 0.22].flatMap((h) => [
                t(prop.y, -s * h, 250, Easing.out(Easing.quad)),
                t(prop.y, 0, 250, Easing.in(Easing.quad)),
              ]),
            ),
          ]).start();
          [0, 500, 1000].forEach((ms) => later(ms + 200, () => setCheer((c) => c + 1)));
          later(1650, () => t(prop.scale, 0, 250).start());
          break;
        }
        case 'hug': {
          // The bear slides in, the pet leans in for a hug, hearts, then the bear waves off.
          prop.x.setValue(-s * 0.75);
          prop.scale.setValue(1);
          Animated.sequence([
            t(prop.x, -s * 0.36, 500, Easing.out(Easing.back(1.4))),
            Animated.delay(1300),
            Animated.parallel([t(prop.x, -s * 0.75, 400), t(prop.scale, 0, 400)]),
          ]).start();
          Animated.sequence([Animated.delay(450), t(petTilt, -1, 350), Animated.delay(900), t(petTilt, 0, 350)]).start();
          later(700, () => setCheer((c) => c + 1));
          break;
        }
        case 'spin': {
          // The star pops above the pet's head and twirls; the pet wiggles.
          prop.y.setValue(-s * 0.72);
          Animated.parallel([
            Animated.sequence([t(prop.scale, 1, 300, Easing.out(Easing.back(2))), Animated.delay(1200), t(prop.scale, 0, 300)]),
            t(prop.spin, 2, 1700, Easing.inOut(Easing.cubic)),
            Animated.sequence(
              [0.6, -0.6, 0.6, -0.6, 0].map((v) => t(petTilt, v, 260)),
            ),
          ]).start();
          later(1300, () => setCheer((c) => c + 1));
          break;
        }
        case 'bubbles': {
          // Bubbles drift up around the pet, who looks up delighted and hops at the end.
          Animated.stagger(
            130,
            bubbles.map((b) => t(b, 1, 1400, Easing.out(Easing.quad))),
          ).start();
          later(1500, () => setCheer((c) => c + 1));
          break;
        }
        case 'eat': {
          // The food appears just under the pet's mouth and disappears in three bites.
          prop.y.setValue(0);
          Animated.sequence([
            t(prop.scale, 1, 250, Easing.out(Easing.back(2))),
            Animated.delay(250),
            t(prop.scale, 0.7, 120),
            Animated.delay(330),
            t(prop.scale, 0.4, 120),
            Animated.delay(330),
            t(prop.scale, 0, 160),
          ]).start();
          [450, 900, 1350].forEach((ms) => {
            later(ms, () => setChomp(true));
            later(ms + 180, () => setChomp(false));
          });
          later(1650, () => setCheer((c) => c + 1));
          break;
        }
        case 'show': {
          // A new item: a happy hop and a ring of sparkles.
          setCheer((c) => c + 1);
          t(sparkle, 1, 1100, Easing.out(Easing.cubic)).start();
          break;
        }
      }
      later(REACTION_MS[next.style], () => setPlaying(null));
    },
    [bubbles, later, petTilt, prop, size, sparkle],
  );

  // Pick up a queued reaction once this screen is visible.
  useEffect(() => {
    if (!reaction || !focused) return;
    const item = getShopItem(reaction.itemId);
    const style: Playing['style'] =
      reaction.kind === 'toy' ? (item?.playStyle ?? 'bounce') : reaction.kind === 'food' ? 'eat' : 'show';
    const next = { reaction, style };
    onReactionStart(reaction);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const start = setTimeout(() => {
      setPlaying(next);
      run(next);
    }, 250);
    timers.current.push(start);
  }, [reaction, focused, onReactionStart, run]);

  const faceExpression = playing
    ? playing.style === 'eat'
      ? chomp
        ? 'eating'
        : 'delighted'
      : 'delighted'
    : expression;
  const propItem = playing && playing.style !== 'show' && playing.style !== 'bubbles' ? playing.reaction.itemId : null;
  const propSize = size * (playing?.style === 'hug' ? 0.46 : playing?.style === 'eat' ? 0.24 : 0.28);

  return (
    <View style={{ width: size * 1.1, height: size * 1.1 }}>
      <Animated.View
        style={{
          transform: [
            { rotate: petTilt.interpolate({ inputRange: [-1, 1], outputRange: ['-12deg', '12deg'] }) },
          ],
        }}
      >
        <AnimatedPet
          speciesId={speciesId}
          stage={stage}
          mood={mood}
          equipped={equipped}
          size={size}
          expression={faceExpression}
          cheerKey={cheer + parentCheer}
          onPress={onPress}
          accessibilityLabel={accessibilityLabel}
        />
      </Animated.View>

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {propItem && (
          <Animated.View
            style={{
              position: 'absolute',
              left: size * 0.55 - propSize / 2,
              bottom: size * 0.06,
              width: propSize,
              height: propSize,
              transform: [
                { translateX: prop.x },
                { translateY: prop.y },
                { scale: prop.scale },
                { rotate: prop.spin.interpolate({ inputRange: [0, 2], outputRange: ['0deg', '720deg'] }) },
              ],
            }}
          >
            <ItemArt itemId={propItem} size={propSize} />
          </Animated.View>
        )}

        {playing?.style === 'bubbles' &&
          bubbles.map((b, i) => {
            const startX = size * (0.12 + (i % 4) * 0.25);
            const r = 12 + (i % 3) * 6;
            return (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  left: startX,
                  bottom: size * (0.15 + (i % 3) * 0.1),
                  opacity: b.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 1, 0.95, 0] }),
                  transform: [
                    { translateY: b.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.8] }) },
                    { translateX: b.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, (i % 2 ? 1 : -1) * 14, 0] }) },
                  ],
                }}
              >
                <Bubble r={r} />
              </Animated.View>
            );
          })}

        {playing?.style === 'show' &&
          [0, 1, 2, 3, 4, 5].map((i) => {
            const angle = (i / 6) * Math.PI * 2;
            return (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  left: size * 0.55 - 9,
                  top: size * 0.5 - 9,
                  opacity: sparkle.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
                  transform: [
                    { translateX: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * size * 0.55] }) },
                    { translateY: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * size * 0.45] }) },
                  ],
                }}
              >
                <Sparkle />
              </Animated.View>
            );
          })}
      </View>
    </View>
  );
}

function Bubble({ r }: { r: number }) {
  return (
    <Svg width={r * 2} height={r * 2} viewBox="0 0 20 20">
      <Circle cx={10} cy={10} r={9} fill="#CFE8FF" opacity={0.55} stroke="#8CCBF0" strokeWidth={1.2} />
      <Circle cx={7} cy={7} r={2.2} fill="#FFFFFF" />
    </Svg>
  );
}

function Sparkle() {
  return (
    <Svg width={18} height={18} viewBox="0 0 20 20">
      <Path d="M10 0 L12.5 7.5 L20 10 L12.5 12.5 L10 20 L7.5 12.5 L0 10 L7.5 7.5 Z" fill={colors.coin} />
    </Svg>
  );
}
