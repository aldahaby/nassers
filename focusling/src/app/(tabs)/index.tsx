import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { PET_FOCUS_LINES, PET_TAP_LINES, PET_WELCOME_BACK_LINES } from '@/config/petLines';
import { PET_SPECIES } from '@/config/pets';
import { getStageDefinitionById } from '@/core';
import { ActiveSessionBanner } from '@/features/pet/ActiveSessionBanner';
import { PetStatsCard } from '@/features/pet/PetStatsCard';
import { PetTopBar } from '@/features/pet/PetTopBar';
import { useActiveSession, useCoins, useEquipped, useGameStore, usePetView, useStreakDays } from '@/state';
import { AnimatedPet, Button, RoomScene, Screen, SpeechBubble, colors, spacing, typography } from '@/ui';
import { pickRandom } from '@/utils/format';

const BUBBLE_MS = 2200;

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

  const [bubble, setBubble] = useState<string | null>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
  }, []);

  const mood = view?.mood ?? 'content';

  const say = useCallback((line: string | null) => {
    setBubble(line);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), BUBBLE_MS);
  }, []);

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
        <AnimatedPet
          speciesId={pet.speciesId}
          stage={progression.stage}
          mood={mood}
          equipped={equipped}
          size={petSize}
          expression={activeSession ? 'focused' : 'auto'}
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
