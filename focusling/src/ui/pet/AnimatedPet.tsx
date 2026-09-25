import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { getStageDefinitionById, type EquipSlot, type GrowthStage, type PetMood, type PetSpeciesId } from '@/core';
import { colors, useNativeDriver } from '@/ui/theme';
import { PetArt } from './PetArt';
import type { FaceExpression } from './PetFace';

interface Props {
  speciesId: PetSpeciesId;
  stage: GrowthStage;
  mood: PetMood;
  equipped?: Partial<Record<EquipSlot, string>>;
  /** Pixel size at the Adult stage; other stages scale from it. */
  size: number;
  /** Override the face, e.g. 'focused' during a session. */
  expression?: Exclude<FaceExpression, 'blink' | 'delighted'>;
  onPress?: () => void;
  accessibilityLabel?: string;
}

const HEART_COUNT = 3;

/**
 * The living pet: idles with a gentle bob and breath, blinks at random, and
 * squishes, hops and puffs out hearts when tapped.
 */
export function AnimatedPet({ speciesId, stage, mood, equipped, size, expression = 'auto', onPress, accessibilityLabel }: Props) {
  const bob = useState(() => new Animated.Value(0))[0];
  const squish = useState(() => new Animated.Value(0))[0];
  const hop = useState(() => new Animated.Value(0))[0];
  const hearts = useState(() => Array.from({ length: HEART_COUNT }, () => new Animated.Value(0)))[0];
  const [blinking, setBlinking] = useState(false);
  const [delighted, setDelighted] = useState(false);
  const delightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sleepy pets breathe slower.
  const idleMs = mood === 'sleepy' || mood === 'lonely' ? 2400 : 1600;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: idleMs, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(bob, { toValue: 0, duration: idleMs, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, idleMs]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timeout = setTimeout(() => {
        setBlinking(true);
        timeout = setTimeout(() => {
          setBlinking(false);
          schedule();
        }, 140);
      }, 2200 + Math.random() * 3000);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => () => {
    if (delightTimer.current) clearTimeout(delightTimer.current);
  }, []);

  const handlePress = useCallback(() => {
    squish.setValue(0);
    hop.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(squish, { toValue: 1, duration: 90, useNativeDriver }),
        Animated.spring(squish, { toValue: 0, friction: 3, tension: 160, useNativeDriver }),
      ]),
      Animated.sequence([
        Animated.timing(hop, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver }),
        Animated.timing(hop, { toValue: 0, duration: 260, easing: Easing.bounce, useNativeDriver }),
      ]),
      Animated.stagger(
        120,
        hearts.map((h) => {
          h.setValue(0);
          return Animated.timing(h, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver });
        }),
      ),
    ]).start();

    setDelighted(true);
    if (delightTimer.current) clearTimeout(delightTimer.current);
    delightTimer.current = setTimeout(() => setDelighted(false), 1000);
    onPress?.();
  }, [hearts, hop, onPress, squish]);

  const stageScale = getStageDefinitionById(stage).scale;
  const artSize = size * stageScale;
  const face: FaceExpression = delighted ? 'delighted' : blinking ? 'blink' : expression;

  const transform = [
    { translateY: Animated.add(bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }), hop.interpolate({ inputRange: [0, 1], outputRange: [0, -28] })) },
    { scaleX: squish.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) },
    {
      scaleY: Animated.add(
        squish.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }),
        bob.interpolate({ inputRange: [0, 1], outputRange: [0, 0.025] }),
      ),
    },
  ];

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? 'Pet'}
      accessibilityHint="Tap to pet"
      style={[styles.container, { width: size * 1.1, height: size * 1.1 }]}
    >
      <Animated.View style={{ transform }}>
        <PetArt speciesId={speciesId} stage={stage} mood={mood} expression={face} equipped={equipped} size={artSize} />
      </Animated.View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {hearts.map((h, i) => (
          <Animated.Text
            key={i}
            style={[
              styles.heart,
              {
                left: size * (0.3 + i * 0.2),
                top: size * 0.3,
                opacity: h.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateY: h.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.35] }) },
                  { translateX: h.interpolate({ inputRange: [0, 1], outputRange: [0, (i - 1) * 14] }) },
                  { scale: h.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.2, 1] }) },
                ],
              },
            ]}
          >
            <Text>♥</Text>
          </Animated.Text>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'flex-end' },
  heart: { position: 'absolute', fontSize: 26, color: colors.happiness, fontWeight: '900' },
});
