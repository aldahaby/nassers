import { Redirect, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { TOY_TOSS } from '@/config/play';
import { countCatches, judgeToss, markerPosition, type CatchQuality, type GameRoundResult } from '@/core';
import { GameFrame } from '@/features/play/GameFrame';
import { RoundSummary } from '@/features/play/RoundSummary';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useGameStore, usePetView, usePlayToday } from '@/state';
import { AnimatedPet, Button, ItemArt, colors, radius, spacing, typography, useNativeDriver } from '@/ui';

const TOY = 'toy-bouncy-ball';
const TOY_SIZE = 44;
/** Pause after each toss before the next one is ready (ms). */
const SETTLE_MS = 1100;

type Phase = 'aiming' | 'tossing' | 'done';

const RESULT_LINE: Record<CatchQuality, (pet: string) => string> = {
  perfect: (pet) => `Perfect catch! ${pet} is delighted.`,
  good: (pet) => `${pet} caught it!`,
  miss: (pet) => `Just past ${pet}. That's okay.`,
};

/**
 * Toy Toss: the toy glides along a lane at one constant speed; tap Toss when
 * it's near the pet. Exactly 5 tosses, then a short summary.
 */
export default function ToyTossScreen() {
  const view = usePetView();
  const play = usePlayToday();
  const routes = useAppRoutes();
  const reducedMotion = useReducedMotion();
  const { startGameRound, completeGameRound } = useGameStore.getState();
  const { height } = useWindowDimensions();
  const [roundId, setRoundId] = useState(() => startGameRound('toyToss'));
  const [results, setResults] = useState<CatchQuality[]>([]);
  const [phase, setPhase] = useState<Phase>('aiming');
  const [result, setResult] = useState<GameRoundResult | null>(null);
  const [cheerKey, setCheerKey] = useState(0);
  const [line, setLine] = useState('Tap Toss when the ball is near your pet.');
  const [laneWidth, setLaneWidth] = useState(0);
  const [marker] = useState(() => new Animated.Value(0));
  const [flight] = useState(() => new Animated.Value(0));
  const clock = useRef({ elapsed: 0, last: 0, running: true, frame: 0 });
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One requestAnimationFrame loop drives the marker from a pausable clock, so
  // what's drawn is exactly what's judged. The speed never changes.
  useEffect(() => {
    const c = clock.current;
    c.last = Date.now();
    const tick = () => {
      const now = Date.now();
      if (c.running) c.elapsed += now - c.last;
      c.last = now;
      marker.setValue(markerPosition(c.elapsed));
      c.frame = requestAnimationFrame(tick);
    };
    c.frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(c.frame);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [marker]);

  const toss = useCallback(() => {
    if (phase !== 'aiming' || !view) return;
    const c = clock.current;
    const now = Date.now();
    c.elapsed += now - c.last;
    c.last = now;
    c.running = false;
    const quality = judgeToss(markerPosition(c.elapsed));
    const next = [...results, quality];
    setResults(next);
    setPhase('tossing');
    setLine(RESULT_LINE[quality](view.pet.name));
    if (quality !== 'miss') setCheerKey((k) => k + 1);

    flight.setValue(0);
    if (!reducedMotion) {
      Animated.timing(flight, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver }).start();
    }

    settleTimer.current = setTimeout(() => {
      flight.setValue(0);
      if (next.length >= TOY_TOSS.tosses) {
        setPhase('done');
        setResult(completeGameRound({ gameId: 'toyToss', roundId, score: countCatches(next) }));
        return;
      }
      clock.current.last = Date.now();
      clock.current.running = true;
      setPhase('aiming');
    }, SETTLE_MS);
  }, [phase, results, view, flight, reducedMotion, completeGameRound, roundId]);

  const playAgain = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    clock.current.elapsed = 0;
    clock.current.last = Date.now();
    clock.current.running = true;
    setRoundId(startGameRound('toyToss'));
    setResults([]);
    setResult(null);
    setPhase('aiming');
    setLine('Tap Toss when the ball is near your pet.');
  };

  if (!view || !play) return null;
  if (!play.access.open && !result) return <Redirect href={routes.play as Href} />;
  const { pet, progression, mood } = view;
  const catches = countCatches(results);
  const petSize = Math.min(130, height * 0.16);
  const travel = Math.max(0, laneWidth - TOY_SIZE);
  const zoneWidth = travel * TOY_TOSS.goodWithin * 2 + TOY_SIZE;

  return (
    <GameFrame title="Toy Toss" progress={phase === 'done' ? `${catches} of ${TOY_TOSS.tosses} caught` : `Toss ${Math.min(results.length + 1, TOY_TOSS.tosses)} of ${TOY_TOSS.tosses}`}>
      <View style={styles.tosses} accessible accessibilityLabel={`${results.length} of ${TOY_TOSS.tosses} tosses used, ${catches} caught`}>
        {Array.from({ length: TOY_TOSS.tosses }, (_, i) => {
          const r = results[i];
          return (
            <View key={i} style={[styles.tossDot, r && (r === 'miss' ? styles.tossMiss : styles.tossCatch)]}>
              <Text style={styles.tossMark}>{r ? (r === 'miss' ? '–' : '✓') : ''}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.stage}>
        <Text style={styles.line} accessibilityLiveRegion="polite">
          {line}
        </Text>
        <View style={styles.lane} onLayout={(e: LayoutChangeEvent) => setLaneWidth(e.nativeEvent.layout.width)}>
          <View style={[styles.zone, { width: zoneWidth, left: (laneWidth - zoneWidth) / 2 }]} />
          <Animated.View
            style={[
              styles.toy,
              {
                opacity: phase === 'done' ? 0 : 1,
                transform: [
                  { translateX: marker.interpolate({ inputRange: [0, 1], outputRange: [0, travel] }) },
                  { translateY: flight.interpolate({ inputRange: [0, 1], outputRange: [0, 70] }) },
                  { scale: flight.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) },
                ],
              },
            ]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <ItemArt itemId={TOY} size={TOY_SIZE} />
          </Animated.View>
        </View>
        <AnimatedPet speciesId={pet.speciesId} stage={progression.stage} mood={mood} size={petSize} cheerKey={cheerKey} accessibilityLabel={pet.name} />
      </View>

      {phase === 'done' && result ? (
        <RoundSummary
          title="Round complete"
          detail={`${pet.name} caught ${catches} of ${TOY_TOSS.tosses}.`}
          result={result}
          petName={pet.name}
          onPlayAgain={playAgain}
        />
      ) : (
        <Button
          label="Toss"
          icon="🎾"
          onPress={toss}
          disabled={phase !== 'aiming'}
          accessibilityHint="Throws the ball. Catch chances are best when the ball is right above your pet."
          style={styles.tossButton}
        />
      )}
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  tosses: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  tossDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  tossCatch: { backgroundColor: '#DDF6E8', borderColor: '#9AD9B3' },
  tossMiss: { backgroundColor: colors.surfaceMuted },
  tossMark: { fontWeight: '900', color: colors.text },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: spacing.md, minHeight: 240 },
  line: { ...typography.body, fontWeight: '700', color: colors.primaryDark, textAlign: 'center', minHeight: 44 },
  lane: { width: '100%', maxWidth: 560, height: TOY_SIZE + 12, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, justifyContent: 'center' },
  zone: { position: 'absolute', top: 0, bottom: 0, borderRadius: radius.pill, backgroundColor: '#E4F6EA', borderWidth: 2, borderColor: '#BFE3CB', borderStyle: 'dashed' },
  toy: { position: 'absolute', left: 0, width: TOY_SIZE, height: TOY_SIZE, alignItems: 'center', justifyContent: 'center' },
  tossButton: { alignSelf: 'stretch', maxWidth: 420, width: '100%', marginHorizontal: 'auto' },
});
