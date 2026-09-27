import { Redirect, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MEMORY_GARDEN } from '@/config/play';
import { getShopItem } from '@/config/shopCatalog';
import { createMemoryDeck, flipCard, hideMismatch, isMemoryComplete, pairsFound, type GameRoundResult, type MemoryState } from '@/core';
import { GameFrame } from '@/features/play/GameFrame';
import { RoundSummary } from '@/features/play/RoundSummary';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { useGameStore, usePetView, usePlayToday } from '@/state';
import { AnimatedPet, ItemArt, colors, radius, shadow, spacing, typography } from '@/ui';

const MATCH_LINES = ['A pair!', 'You found them!', 'Nice matching.', 'Two of a kind!'] as const;
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** Memory Garden: 8 cards, 4 pairs, no timer. The pet cheers each pair. */
export default function MemoryGardenScreen() {
  const view = usePetView();
  const play = usePlayToday();
  const routes = useAppRoutes();
  const { startGameRound, completeGameRound } = useGameStore.getState();
  const { width, height } = useWindowDimensions();
  const [deck, setDeck] = useState<MemoryState>(() => createMemoryDeck(newSeed()));
  const [roundId, setRoundId] = useState(() => startGameRound('memoryGarden'));
  const [result, setResult] = useState<GameRoundResult | null>(null);
  const [cheerKey, setCheerKey] = useState(0);
  const [line, setLine] = useState('Tap two cards to find a pair.');
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const onFlip = useCallback(
    (index: number) => {
      const { state, outcome } = flipCard(deck, index);
      if (outcome === 'ignored') return;
      setDeck(state);
      if (outcome === 'match') {
        setCheerKey((k) => k + 1);
        setLine(MATCH_LINES[pairsFound(state) % MATCH_LINES.length] ?? 'A pair!');
        if (isMemoryComplete(state)) setResult(completeGameRound({ gameId: 'memoryGarden', roundId, score: pairsFound(state) }));
      } else if (outcome === 'mismatch') {
        setLine('Not a pair. Try another.');
        hideTimer.current = setTimeout(() => setDeck((d) => hideMismatch(d)), MEMORY_GARDEN.mismatchRevealMs);
      }
    },
    [deck, roundId, completeGameRound],
  );

  const playAgain = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setDeck(createMemoryDeck(newSeed()));
    setRoundId(startGameRound('memoryGarden'));
    setResult(null);
    setLine('Tap two cards to find a pair.');
  };

  if (!view || !play) return null;
  if (!play.access.open && !result) return <Redirect href={routes.play as Href} />;
  const { pet, progression, mood } = view;

  // Four columns; sized to fit phones and to stay comfortable on tablets.
  const columns = 4;
  const gap = spacing.md;
  const maxGrid = Math.min(width - spacing.lg * 2, 640, height * 0.9);
  const cardSize = Math.floor((maxGrid - gap * (columns - 1)) / columns);
  const found = pairsFound(deck);

  return (
    <GameFrame title="Memory Garden" progress={`${found} of ${MEMORY_GARDEN.pairs} pairs found`}>
      <View style={styles.petArea}>
        <AnimatedPet speciesId={pet.speciesId} stage={progression.stage} mood={mood} size={Math.min(110, height * 0.13)} cheerKey={cheerKey} accessibilityLabel={pet.name} />
        <Text style={styles.line} accessibilityLiveRegion="polite">
          {result ? `${pet.name} loved that!` : line}
        </Text>
      </View>

      {result ? (
        <RoundSummary
          title="All pairs found!"
          detail={`${deck.moves} tries. ${pet.name} had a lovely time.`}
          result={result}
          petName={pet.name}
          onPlayAgain={playAgain}
        />
      ) : (
        <View style={[styles.grid, { width: cardSize * columns + gap * (columns - 1), gap }]}>
          {deck.cards.map((card, index) => {
            const faceUp = card.matched || deck.revealed.includes(index);
            const name = getShopItem(card.itemId)?.name ?? 'Card';
            const state = card.matched ? `${name}, matched` : faceUp ? `${name}, face up` : 'face down';
            return (
              <Pressable
                key={card.id}
                onPress={() => onFlip(index)}
                disabled={card.matched}
                accessibilityRole="button"
                accessibilityLabel={`Card ${index + 1}, ${state}`}
                accessibilityState={{ disabled: card.matched, selected: faceUp }}
                style={[
                  styles.card,
                  shadow,
                  { width: cardSize, height: cardSize * 1.2 },
                  faceUp ? styles.cardUp : styles.cardDown,
                  card.matched && styles.cardMatched,
                ]}
              >
                {faceUp ? (
                  <>
                    <ItemArt itemId={card.itemId} size={cardSize * 0.62} />
                    {card.matched && <Text style={styles.check}>✓</Text>}
                  </>
                ) : (
                  <Text style={[styles.leaf, { fontSize: cardSize * 0.34 }]}>🌿</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  petArea: { alignItems: 'center', gap: spacing.xs },
  line: { ...typography.body, fontWeight: '700', color: colors.primaryDark, textAlign: 'center', minHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'center' },
  card: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  cardDown: { backgroundColor: '#DDF1E4', borderColor: '#BFE3CB' },
  cardUp: { backgroundColor: colors.surface, borderColor: colors.primarySoft },
  cardMatched: { borderColor: '#9AD9B3', backgroundColor: '#F2FBF5' },
  check: { position: 'absolute', top: 4, right: 8, fontWeight: '900', color: '#1F8A55', fontSize: 16 },
  leaf: { opacity: 0.8 },
});
