import { router, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { MEMORY_GARDEN, TOY_TOSS } from '@/config/play';
import type { GameId } from '@/core';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { useDebugToolsEnabled, useGameStore, usePetView, usePlayToday } from '@/state';
import { AnimatedPet, Button, Card, ItemArt, colors, radius, shadow, spacing, typography, Pressable } from '@/ui';
import { capReachedLine, lockedLine } from './playCopy';

const minCoins = Math.min(...TOY_TOSS.coinsByCatches);
const maxCoins = Math.max(...TOY_TOSS.coinsByCatches);

const GAMES: readonly { id: GameId; href: Href; title: string; body: (pet: string) => string; reward: string; art: string }[] = [
  {
    id: 'memoryGarden',
    href: '/games/memory-garden',
    title: 'Memory Garden',
    body: (pet) => `Find the ${MEMORY_GARDEN.pairs} matching pairs with ${pet}. No timer.`,
    reward: `+${MEMORY_GARDEN.coins} coins`,
    art: 'decor-potted-plant',
  },
  {
    id: 'toyToss',
    href: '/games/toy-toss',
    title: 'Toy Toss',
    body: (pet) => `${TOY_TOSS.tosses} gentle tosses for ${pet} to catch.`,
    reward: `+${minCoins}–${maxCoins} coins`,
    art: 'toy-bouncy-ball',
  },
];

/** Two calm, finite mini-games. Play coins are capped per day; games stay playable after. */
export function PlayHub() {
  const view = usePetView();
  const play = usePlayToday();
  const debug = useDebugToolsEnabled();
  const routes = useAppRoutes();
  if (!view || !play) return null;
  const { pet, progression, mood } = view;
  const locked = !play.access.open;

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <AnimatedPet speciesId={pet.speciesId} stage={progression.stage} mood={mood} size={120} accessibilityLabel={pet.name} />
        <Text style={styles.title} accessibilityRole="header">
          Play with {pet.name}
        </Text>
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {locked ? lockedLine(pet.name) : play.capReached ? capReachedLine(pet.name) : `${play.coinsEarned} of ${play.cap} play coins today`}
        </Text>
      </View>

      {locked && (
        <Card>
          <Text style={styles.body}>Missions unlock Play for the rest of the day.</Text>
          <Button label="See missions" variant="secondary" onPress={() => router.navigate(routes.missions as Href)} />
        </Card>
      )}

      <View style={styles.games}>
        {GAMES.map((game) => (
          <Pressable
            key={game.id}
            disabled={locked}
            onPress={() => router.push(game.href)}
            accessibilityRole="button"
            accessibilityState={{ disabled: locked }}
            accessibilityLabel={`${game.title}. ${game.body(pet.name)} ${play.capReached ? 'Just for fun today.' : game.reward}${locked ? '. Locked until a mission is done.' : ''}`}
            style={({ pressed }) => [styles.game, shadow, pressed && styles.pressed, locked && styles.locked]}
          >
            <View style={styles.art}>
              <ItemArt itemId={game.art} size={56} />
            </View>
            <View style={styles.gameText}>
              <Text style={styles.gameTitle}>{game.title}</Text>
              <Text style={styles.body}>{game.body(pet.name)}</Text>
              <Text style={styles.reward}>{locked ? '🔒 After a mission' : play.capReached ? 'Just for fun today' : game.reward}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Text style={styles.note}>Each game takes a minute or two. Focus sessions are still the best way to help {pet.name} grow.</Text>
      {debug && <PlayDevTools />}
    </View>
  );
}

/** Developer-only Play shortcuts (Child View has no settings screen). */
function PlayDevTools() {
  const { debugPlayCapOneLeft, debugResetDailyPlay, debugUnlockPlay, debugGrantPlayCoins } = useGameStore.getState();
  return (
    <Card>
      <Text style={typography.heading}>🛠 Play developer tools</Text>
      <View style={styles.devGrid}>
        <Button variant="secondary" label="+3 play coins" onPress={() => debugGrantPlayCoins(3)} style={styles.devCell} />
        <Button variant="secondary" label="Cap: 1 left" onPress={debugPlayCapOneLeft} style={styles.devCell} />
        <Button variant="secondary" label="Reset daily play" onPress={debugResetDailyPlay} style={styles.devCell} />
        <Button variant="secondary" label="Unlock Play" onPress={debugUnlockPlay} style={styles.devCell} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm },
  title: { ...typography.title, textAlign: 'center' },
  status: { ...typography.body, fontWeight: '700', color: colors.primaryDark, textAlign: 'center' },
  games: { gap: spacing.md },
  game: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, minHeight: 104 },
  pressed: { backgroundColor: colors.primarySoft },
  locked: { opacity: 0.6 },
  art: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  gameText: { flex: 1, gap: 3 },
  gameTitle: { ...typography.heading },
  body: { ...typography.body, fontSize: 15, color: colors.textMuted },
  reward: { ...typography.label, color: colors.coinDark },
  note: { ...typography.label, textAlign: 'center', lineHeight: 19 },
  devGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  devCell: { flexGrow: 1, flexBasis: '45%' },
});
