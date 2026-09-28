import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { UnlockReveal } from '@/features/completion/UnlockReveal';
import { PetReactionStage } from '@/features/pet/PetReactionStage';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { playSound } from '@/services/audio';
import { useEquipped, useGameStore, usePetView } from '@/state';
import { colors, radius, spacing, typography, Pressable } from '@/ui';
import { CollectionCompleteCard } from './CollectionCompleteCard';

/**
 * Style moments that happen outside a session summary: buying the last piece
 * of a collection, or developer previews. One calm sheet, easy to close.
 */
export function StyleCelebrationModal() {
  const celebration = useGameStore((s) => s.styleCelebration);
  const consume = useGameStore((s) => s.consumeStyleCelebration);
  const view = usePetView();
  const equipped = useEquipped();
  const reducedMotion = useReducedMotion();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const [performance, setPerformance] = useState<{ reactionId: string; key: number } | null>(null);
  const [cheer, setCheer] = useState(0);

  // A collection completion gets the flourish here; single unlocks get it from UnlockReveal.
  const completing = Boolean(celebration && 'collectionId' in celebration && celebration.collectionId && !pathname.startsWith('/session-complete'));
  useEffect(() => {
    if (completing) playSound('unlock');
  }, [completing]);

  // The session summary shows its own reveal.
  if (!celebration || !view || pathname.startsWith('/session-complete')) return null;
  const { pet, progression, mood } = view;

  return (
    <Modal transparent animationType={reducedMotion ? 'fade' : 'slide'} visible onRequestClose={consume}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { maxWidth: 560 }]} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.stage}>
              <PetReactionStage
                speciesId={pet.speciesId}
                stage={progression.stage}
                mood={mood}
                equipped={equipped}
                size={Math.min(170, width * 0.4)}
                reaction={null}
                onReactionStart={() => {}}
                cheerKey={cheer}
                performance={performance}
                accessibilityLabel={pet.name}
              />
            </View>
            {celebration.kind === 'collection' ? (
              <CollectionCompleteCard
                collectionId={celebration.collectionId}
                onTryReaction={(reactionId) => setPerformance((p) => ({ reactionId, key: (p?.key ?? 0) + 1 }))}
                onWearLook={() => setCheer((c) => c + 1)}
              />
            ) : (
              <UnlockReveal
                unlocked={celebration.ids}
                petName={pet.name}
                delay={200}
                reducedMotion={reducedMotion}
                onWear={() => setCheer((c) => c + 1)}
                showNext={false}
              />
            )}
            <Pressable onPress={consume} style={styles.done} accessibilityRole="button" accessibilityLabel="Done">
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(47,37,72,0.45)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '92%' },
  content: { padding: spacing.lg, gap: spacing.md, alignItems: 'stretch' },
  stage: { alignItems: 'center' },
  done: { alignSelf: 'center', minHeight: 48, paddingHorizontal: spacing.xl, justifyContent: 'center' },
  doneText: { ...typography.body, fontWeight: '800', color: colors.primaryDark },
});
