import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { PET_FOCUS_LINES, PET_NEW_ITEM_LINES, PET_TAP_LINES, PET_WELCOME_BACK_LINES } from '@/config/petLines';
import { getReaction, PERSONALITY_TAP_LINES, REACTION_TAP_EVERY } from '@/config/reactions';
import { PET_SPECIES } from '@/config/pets';
import { favoriteReaction, getOwnedListings, getStageDefinitionById, type ShopListing } from '@/core';
import { usePetSpeech } from '@/features/inventory/usePetSpeech';
import { MissionCard } from '@/features/missions/MissionCard';
import { MissionCelebrationCard } from '@/features/missions/MissionCelebrationCard';
import { ActiveSessionBanner } from '@/features/pet/ActiveSessionBanner';
import { PetStatsCard } from '@/features/pet/PetStatsCard';
import { ItemsBar } from '@/features/pet/ItemsBar';
import { PetReactionStage } from '@/features/pet/PetReactionStage';
import { PetTopBar } from '@/features/pet/PetTopBar';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { playSound } from '@/services/audio';
import {
  useActiveSession,
  useCapabilities,
  useCoins,
  useCurrentMission,
  useEquipped,
  useRoomColor,
  useRoomTheme,
  useGameStore,
  usePetView,
  usePlayToday,
  useStreakDays,
} from '@/state';
import { Button, Card, PremiumGlyph, RoomScene, Screen, SpeechBubble, colors, radius, shadow, spacing, typography, Pressable, TabIcon } from '@/ui';
import { pickRandom } from '@/utils/format';

/** Most toys/snacks shown for one-tap use under the pet. */
const QUICK_ITEM_LIMIT = 8;

interface Props {
  /** "self": the classic pet tab. "child": Family Mode's Child View home. */
  variant: 'self' | 'child';
}

/** The emotional centre of the app: the pet in its room, today's mission, and its stats. */
export function PetHomeScreen({ variant }: Props) {
  const view = usePetView();
  const coins = useCoins();
  const streakDays = useStreakDays();
  const equipped = useEquipped();
  const roomColor = useRoomColor();
  const roomTheme = useRoomTheme();
  const activeSession = useActiveSession();
  const mission = useCurrentMission();
  const play = usePlayToday();
  const routes = useAppRoutes();
  const premium = useCapabilities().canUsePremiumCollections;
  const petPet = useGameStore((s) => s.petPet);
  const { width } = useWindowDimensions();
  const welcomeBack = useGameStore((s) => s.pendingWelcome);
  const consumeWelcome = useGameStore((s) => s.consumeWelcome);
  const celebration = useGameStore((s) => s.missionCelebration);
  const [cheerKey, setCheerKey] = useState(0);
  const reaction = useGameStore((s) => s.petReaction);
  const inventory = useGameStore((s) => s.save?.inventory);
  const { play: playWith, feed, consumePetReaction, consumeMissionCelebration } = useGameStore.getState();
  const { bubble, say, sayForReaction } = usePetSpeech();

  const mood = view?.mood ?? 'content';

  // Owned toys first, then snacks, for one-tap use.
  const quickItems = useMemo(() => {
    if (!inventory) return [];
    const owned = getOwnedListings(inventory);
    return [...owned.filter((l) => l.category === 'toy'), ...owned.filter((l) => l.category === 'food')].slice(0, QUICK_ITEM_LIMIT);
  }, [inventory]);

  const useQuickItem = useCallback(
    (listing: ShopListing) => (listing.category === 'food' ? feed(listing.id) : playWith(listing.id)),
    [feed, playWith],
  );

  const onReactionStart = useCallback(
    (r: Parameters<typeof sayForReaction>[0]) => {
      consumePetReaction();
      sayForReaction(r);
    },
    [consumePetReaction, sayForReaction],
  );

  // Coming back from a finished session: a happy hop and a thank-you.
  useEffect(() => {
    if (!welcomeBack) return;
    const timer = setTimeout(() => {
      if (welcomeBack === 'completed') setCheerKey((k) => k + 1);
      say(pickRandom(PET_WELCOME_BACK_LINES[welcomeBack]) ?? null);
      consumeWelcome();
    }, 350);
    return () => clearTimeout(timer);
  }, [welcomeBack, say, consumeWelcome]);

  // Something new in the wardrobe: the pet mentions it once per visit (not during focus).
  const hasNewItems = useGameStore((s) => (s.save?.cosmetics.newItemIds.length ?? 0) > 0);
  const [hinted, setHinted] = useState(false);
  useEffect(() => {
    if (!hasNewItems || hinted || welcomeBack || activeSession) return;
    const timer = setTimeout(() => {
      say(pickRandom(PET_NEW_ITEM_LINES) ?? null);
      setHinted(true);
    }, 1400);
    return () => clearTimeout(timer);
  }, [hasNewItems, hinted, welcomeBack, activeSession, say]);

  // A mission finished outside a session summary (e.g. developer tools): a calm cheer.
  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => setCheerKey((k) => k + 1), 250);
    return () => clearTimeout(timer);
  }, [celebration]);

  // Every few taps (outside focus) the pet performs its favourite reaction.
  const favorite = useGameStore((s) => (s.save ? favoriteReaction(s.save) : null));
  const [taps, setTaps] = useState(0);
  const [performance, setPerformance] = useState<{ reactionId: string; key: number } | null>(null);

  const handleTap = useCallback(() => {
    let performs = false;
    if (!activeSession && favorite) {
      const next = taps + 1;
      setTaps(next);
      performs = next % REACTION_TAP_EVERY === 0;
      if (performs) setPerformance({ reactionId: favorite, key: next });
    }
    // One soft species cue for an ordinary tap (the reaction brings its own accent).
    // Rate-limited centrally, never escalating, and silent during focus.
    if (!performs && view) playSound(`pet-${view.pet.speciesId}`);
    const gained = petPet();
    // When it performs, it talks in its personality's voice (presentation only).
    const personality = performs && favorite ? getReaction(favorite)?.personality : undefined;
    const line = activeSession
      ? pickRandom(PET_FOCUS_LINES)
      : personality
        ? pickRandom(PERSONALITY_TAP_LINES[personality])
        : pickRandom(PET_TAP_LINES[mood]);
    say(gained > 0 ? `${line ?? ''}  +${gained} 💖` : (line ?? null));
  }, [petPet, activeSession, mood, say, favorite, taps, view]);

  if (!view) return null;
  const { pet, progression } = view;
  const stageLabel = getStageDefinitionById(progression.stage).label;
  const petSize = Math.min(290, width * 0.7);
  const child = variant === 'child';
  const playLocked = play ? !play.access.open : false;

  return (
    <Screen scroll>
      <PetTopBar coins={coins} streakDays={streakDays} level={progression.level} />

      <RoomScene
        equipped={equipped}
        roomColor={roomColor}
        theme={roomTheme}
        height={Math.min(petSize * 1.3, 420)}
        corner={
          activeSession ? null : (
            <Pressable onPress={() => router.push('/room-studio' as Href)} style={styles.roomChip} accessibilityRole="button" accessibilityLabel="Room Studio" accessibilityHint="Choose your room colour">
              <TabIcon name="palette" color={colors.primaryDark} size={18} />
              <Text style={styles.roomChipText}>Room</Text>
            </Pressable>
          )
        }
      >
        <SpeechBubble text={bubble} />
        <PetReactionStage
          speciesId={pet.speciesId}
          stage={progression.stage}
          mood={mood}
          equipped={equipped}
          size={petSize}
          expression={activeSession ? 'focused' : 'auto'}
          reaction={reaction}
          onReactionStart={onReactionStart}
          onPress={handleTap}
          cheerKey={cheerKey}
          performance={activeSession ? null : performance}
          accessibilityLabel={`${pet.name}, ${stageLabel} ${PET_SPECIES[pet.speciesId].name}. Feeling ${mood}.`}
        />
      </RoomScene>

      <View style={styles.identity}>
        <Text style={styles.name}>{pet.name}</Text>
        <Text style={styles.subtitle}>
          {stageLabel} {PET_SPECIES[pet.speciesId].name} · feeling {mood}
        </Text>
      </View>

      {celebration && <MissionCelebrationCard completion={celebration} petName={pet.name} onDismiss={consumeMissionCelebration} />}

      <ItemsBar quickItems={quickItems} onUse={useQuickItem} />

      {activeSession ? (
        <ActiveSessionBanner session={activeSession} />
      ) : (
        <Button label="Start focusing" icon="⏳" onPress={() => router.navigate(routes.focus)} />
      )}

      {/* Self mode keeps Home calm: missions live in Focus, Play has its own tab. */}
      {!child && mission && mission.status !== 'complete' && (
        <MissionCard view={mission} compact onPress={() => router.navigate(routes.missions as Href)} accessibilityHint="Opens missions" />
      )}

      {child && (mission ? (
        <MissionCard view={mission} compact onPress={() => router.navigate(routes.missions as Href)} accessibilityHint="Opens missions" />
      ) : (
        <Card style={styles.emptyMission}>
          <Text style={styles.emptyTitle}>{child ? 'No mission today' : 'Set yourself a mission'}</Text>
          <Text style={styles.emptyBody}>
            {child
              ? `Focus sessions still help ${pet.name} grow. A grown-up can add a mission any time.`
              : `Missions are small daily goals, like 45 focus minutes. Finish one for bonus coins.`}
          </Text>
          {!child && <Button label="Choose a mission" variant="secondary" onPress={() => router.navigate(routes.missions as Href)} />}
        </Card>
      ))}

      {child && (
      <View style={styles.entries}>
        <EntryTile
          icon="🎯"
          title="Missions"
          detail={mission?.status === 'complete' ? 'Done for today' : 'Daily goals'}
          onPress={() => router.navigate(routes.missions as Href)}
        />
        <EntryTile
          icon="🧩"
          title="Play"
          detail={playLocked ? 'After a mission' : play?.capReached ? 'Just for fun' : `${play?.coinsEarned ?? 0}/${play?.cap ?? 0} play coins`}
          onPress={() => router.navigate(routes.play as Href)}
        />
      </View>
      )}

      <PetStatsCard stats={pet.stats} progression={progression} />

      {!child && !premium && (
        <Pressable onPress={() => router.push('/premium' as Href)} style={styles.premiumLink} accessibilityRole="button" accessibilityLabel="Focusling Premium" accessibilityHint="Room themes, Premium Looks and collections. Focus stays free.">
          <PremiumGlyph size={12} />
          <Text style={styles.premiumLinkText}>Premium: room themes, Looks and more</Text>
        </Pressable>
      )}

      {child && (
        <Pressable
          onPress={() => router.push('/parent-gate')}
          style={styles.grownUps}
          accessibilityRole="button"
          accessibilityLabel="Grown-ups"
          accessibilityHint="Opens the parent area. A parent PIN is needed."
        >
          <Text style={styles.grownUpsText}>🔒 Grown-ups</Text>
        </Pressable>
      )}
    </Screen>
  );
}

function EntryTile({ icon, title, detail, onPress }: { icon: string; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tile, shadow]} accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`}>
      <Text style={styles.tileIcon}>{icon}</Text>
      <View style={styles.tileText}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center', gap: 2, marginTop: -spacing.sm },
  roomChip: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.88)' },
  roomChipText: { fontSize: 13, fontWeight: '800', color: colors.primaryDark },
  name: { ...typography.title },
  subtitle: { ...typography.label, color: colors.textMuted },
  emptyMission: { gap: spacing.sm },
  emptyTitle: { ...typography.heading, fontSize: 18 },
  emptyBody: { ...typography.body, fontSize: 15, color: colors.textMuted },
  entries: { flexDirection: 'row', gap: spacing.md },
  tile: {
    flex: 1,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  tileIcon: { fontSize: 28 },
  tileText: { flex: 1 },
  tileTitle: { ...typography.heading, fontSize: 17 },
  tileDetail: { ...typography.label, fontSize: 12 },
  premiumLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, alignSelf: 'center', paddingHorizontal: spacing.md },
  premiumLinkText: { ...typography.label, color: '#5A3FC0' },
  grownUps: { alignSelf: 'center', minHeight: 44, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  grownUpsText: { ...typography.label, color: colors.textMuted },
});
