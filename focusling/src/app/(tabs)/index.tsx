import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { PET_FOCUS_LINES, PET_TAP_LINES, PET_WELCOME_BACK_LINES } from '@/config/petLines';
import { PET_SPECIES } from '@/config/pets';
import { getOwnedListings, getStageDefinitionById, type ShopListing } from '@/core';
import { usePetSpeech } from '@/features/inventory/usePetSpeech';
import { ActiveSessionBanner } from '@/features/pet/ActiveSessionBanner';
import { PetStatsCard } from '@/features/pet/PetStatsCard';
import { ItemsBar } from '@/features/pet/ItemsBar';
import { PetReactionStage } from '@/features/pet/PetReactionStage';
import { PetTopBar } from '@/features/pet/PetTopBar';
import { useActiveSession, useCoins, useEquipped, useGameStore, usePetView, useStreakDays } from '@/state';
import { Button, RoomScene, Screen, SpeechBubble, colors, spacing, typography } from '@/ui';
import { pickRandom } from '@/utils/format';

/** Most toys/snacks shown for one-tap use under the pet. */
const QUICK_ITEM_LIMIT = 8;

/** The emotional centre of the app: the pet in its room, plus its stats. */
export default function PetScreen() {
  const view = usePetView();
  const coins = useCoins();
  const streakDays = useStreakDays();
  const equipped = useEquipped();
  const activeSession = useActiveSession();
  const petPet = useGameStore((s) => s.petPet);
  const { width } = useWindowDimensions();
  const welcomeBack = useGameStore((s) => s.pendingWelcome);
  const consumeWelcome = useGameStore((s) => s.consumeWelcome);
  const [cheerKey, setCheerKey] = useState(0);
  const reaction = useGameStore((s) => s.petReaction);
  const inventory = useGameStore((s) => s.save?.inventory);
  const { play, feed, consumePetReaction } = useGameStore.getState();
  const { bubble, say, sayForReaction } = usePetSpeech();

  const mood = view?.mood ?? 'content';

  // Owned toys first, then snacks, for one-tap use.
  const quickItems = useMemo(() => {
    if (!inventory) return [];
    const owned = getOwnedListings(inventory);
    return [...owned.filter((l) => l.category === 'toy'), ...owned.filter((l) => l.category === 'food')].slice(0, QUICK_ITEM_LIMIT);
  }, [inventory]);

  const useQuickItem = useCallback(
    (listing: ShopListing) => (listing.category === 'food' ? feed(listing.id) : play(listing.id)),
    [feed, play],
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
  const handleTap = useCallback(() => {
    const gained = petPet();
    const line = activeSession ? pickRandom(PET_FOCUS_LINES) : pickRandom(PET_TAP_LINES[mood]);
    say(gained > 0 ? `${line ?? ''}  +${gained} 💖` : (line ?? null));
  }, [petPet, activeSession, mood, say]);

  if (!view) return null;
  const { pet, progression } = view;
  const stageLabel = getStageDefinitionById(progression.stage).label;
  const petSize = Math.min(240, width * 0.58);

  return (
    <Screen scroll>
      <PetTopBar coins={coins} streakDays={streakDays} level={progression.level} />

      <RoomScene equipped={equipped} height={petSize * 1.45}>
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
          accessibilityLabel={`${pet.name}, ${stageLabel} ${PET_SPECIES[pet.speciesId].name}. Feeling ${mood}.`}
        />
      </RoomScene>

      <View style={styles.identity}>
        <Text style={styles.name}>{pet.name}</Text>
        <Text style={styles.subtitle}>
          {stageLabel} {PET_SPECIES[pet.speciesId].name} · feeling {mood}
        </Text>
      </View>

      <ItemsBar quickItems={quickItems} onUse={useQuickItem} />

      {activeSession ? (
        <ActiveSessionBanner session={activeSession} />
      ) : (
        <Button label="Start focusing" icon="⏳" onPress={() => router.navigate('/(tabs)/focus')} />
      )}

      <PetStatsCard stats={pet.stats} progression={progression} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center', gap: 2, marginTop: -spacing.sm },
  name: { ...typography.title },
  subtitle: { ...typography.label, color: colors.textMuted },
});
