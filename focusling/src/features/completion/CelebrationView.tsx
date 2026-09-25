import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { getStageDefinitionById, type Celebration, type EquipSlot, type GrowthStage, type PetSpeciesId } from '@/core';
import { AnimatedPet, Button, Confetti, colors, radius, spacing, typography, useNativeDriver } from '@/ui';

interface Props {
  celebration: Celebration;
  /** `stage` is the pet's current stage (used for level-ups, which don't change it). */
  pet: { name: string; speciesId: PetSpeciesId; stage: GrowthStage; equipped: Partial<Record<EquipSlot, string>> };
  onDone: () => void;
  reducedMotion: boolean;
}

const THEMES = {
  levelUp: { background: '#EFE9FF', rays: '#DCD1FF', accent: colors.primaryDark },
  growth: { background: '#E4F8EC', rays: '#C9EFD8', accent: '#2E9E62' },
  evolution: { background: '#FFF3D1', rays: '#FFE39A', accent: '#C98A00' },
} as const;

/** Time before a growth/evolution reveal, and the flash that covers the swap. */
const REVEAL_DELAY_MS = 1100;
const FLASH_MS = 700;

/**
 * Full-screen moment for a level-up, a new growth stage, or evolution.
 * Growth and evolution start on the old form, flash, and reveal the new one.
 */
export function CelebrationView({ celebration, pet, onDone, reducedMotion }: Props) {
  const theme = THEMES[celebration.kind];
  const transforms = celebration.kind !== 'levelUp';
  const { width } = useWindowDimensions();

  const [revealed, setRevealed] = useState(!transforms || reducedMotion);
  const [cheerKey, setCheerKey] = useState(0);
  const [flash] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
  const [spin] = useState(() => new Animated.Value(0));

  // Slowly turning sunburst behind the pet.
  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 24_000, easing: Easing.linear, useNativeDriver }));
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, spin]);

  // Growth/evolution: flash to white, swap to the new stage at the peak, fade back.
  useEffect(() => {
    if (!transforms || reducedMotion) return;
    const timer = setTimeout(() => {
      Animated.timing(flash, { toValue: 1, duration: FLASH_MS / 2, useNativeDriver }).start(() => {
        setRevealed(true);
        Animated.timing(flash, { toValue: 0, duration: FLASH_MS, useNativeDriver }).start();
      });
    }, REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [flash, reducedMotion, transforms]);

  // Once revealed: headline pops in and the pet celebrates.
  useEffect(() => {
    if (!revealed || reducedMotion) return;
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver }).start();
    const timers = [150, 1300, 2500].map((ms, i) => setTimeout(() => setCheerKey(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [pop, revealed, reducedMotion]);

  const stage = celebration.kind === 'levelUp' ? pet.stage : revealed ? celebration.to : celebration.from;
  const petSize = Math.min(210, width * 0.52);
  const burst = Math.min(420, width * 1.05);

  const copy = (() => {
    switch (celebration.kind) {
      case 'levelUp':
        return { title: `Level ${celebration.level}!`, body: `${pet.name} is growing stronger with every session.` };
      case 'growth':
        return {
          title: `${pet.name} grew up!`,
          body: `${getStageDefinitionById(celebration.from).label} → ${getStageDefinitionById(celebration.to).label} · Level ${celebration.level}`,
        };
      case 'evolution':
        return {
          title: `${pet.name} evolved!`,
          body: `Fully evolved at level ${celebration.level}. All that focus paid off.`,
        };
    }
  })();

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.stage}>
          <Animated.View
            style={[
              styles.burst,
              { width: burst, height: burst, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
            ]}
            pointerEvents="none"
          >
            <Sunburst color={theme.rays} />
          </Animated.View>

          {celebration.kind === 'levelUp' && (
            <Animated.View style={[styles.badge, { transform: [{ scale: pop }] }]}>
              <Text style={styles.badgeLabel}>LEVEL</Text>
              <Text style={styles.badgeNumber}>{celebration.level}</Text>
            </Animated.View>
          )}

          <AnimatedPet
            speciesId={pet.speciesId}
            stage={stage}
            mood="joyful"
            equipped={pet.equipped}
            size={petSize}
            cheerKey={cheerKey}
            accessibilityLabel={pet.name}
          />
        </View>

        <View style={styles.copy}>
          {revealed ? (
            <Animated.View style={[styles.copyInner, { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }], opacity: pop }]}>
              <Text style={[styles.title, { color: theme.accent }]}>{copy.title}</Text>
              <Text style={styles.body}>{copy.body}</Text>
            </Animated.View>
          ) : (
            <Text style={styles.body}>Something is happening…</Text>
          )}
        </View>

        <View style={styles.footer}>
          {revealed && <Button label={`See ${pet.name}`} onPress={onDone} />}
        </View>
      </SafeAreaView>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash }]} />
      {revealed && <Confetti count={40} disabled={reducedMotion} />}
    </View>
  );
}

function Sunburst({ color }: { color: string }) {
  const rays = 12;
  const paths = Array.from({ length: rays }, (_, i) => {
    const a0 = (i / rays) * Math.PI * 2;
    const a1 = a0 + Math.PI / rays;
    const p = (a: number) => `${100 + Math.cos(a) * 100} ${100 + Math.sin(a) * 100}`;
    return `M100 100 L${p(a0)} L${p(a1)} Z`;
  });
  return (
    <Svg width="100%" height="100%" viewBox="0 0 200 200">
      {paths.map((d) => (
        <Path key={d} d={d} fill={color} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.lg },
  stage: { alignItems: 'center', justifyContent: 'center', minHeight: 320 },
  burst: { position: 'absolute', opacity: 0.9 },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderBottomWidth: 4,
    borderBottomColor: colors.primaryDark,
  },
  badgeLabel: { color: colors.white, fontWeight: '900', fontSize: 12, letterSpacing: 2 },
  badgeNumber: { color: colors.white, fontWeight: '900', fontSize: 40, lineHeight: 44, fontVariant: ['tabular-nums'] },
  copy: { minHeight: 96, alignItems: 'center', justifyContent: 'center' },
  copyInner: { alignItems: 'center', gap: spacing.xs },
  title: { ...typography.title, fontSize: 34, textAlign: 'center' },
  body: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  footer: { minHeight: 58, justifyContent: 'flex-end' },
  flash: { backgroundColor: colors.white },
});
