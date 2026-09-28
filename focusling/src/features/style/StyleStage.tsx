import { StyleSheet, View, useWindowDimensions } from 'react-native';
import type { EquipSlot, GrowthStage, Pet, PetMood } from '@/core';
import { PetReactionStage } from '@/features/pet/PetReactionStage';
import type { PetReaction } from '@/state';
import { getStageDefinitionById } from '@/core';
import { SpeechBubble, colors } from '@/ui';

interface Props {
  pet: Pet;
  stage: GrowthStage;
  mood: PetMood;
  equipped: Partial<Record<EquipSlot, string>>;
  /** Spotlight colour (a collection's wash when previewing or wearing its Look). */
  tint?: string;
  bubble?: string | null;
  reaction?: PetReaction | null;
  onReactionStart?: (r: PetReaction) => void;
  performance?: { reactionId: string; key: number } | null;
  cheerKey?: number;
  label: string;
  /** Maximum pet size (defaults to a large, character-first size). */
  maxSize?: number;
}

/** The big pet preview shared by the Wardrobe and collection pages. */
export function StyleStage({ pet, stage, mood, equipped, tint, bubble = null, reaction = null, onReactionStart, performance, cheerKey, label, maxSize = 280 }: Props) {
  const { width } = useWindowDimensions();
  const size = Math.min(maxSize, width * 0.66);
  const spot = size * getStageDefinitionById(stage).scale * 1.3;
  return (
    <View style={styles.stage}>
      <View style={[styles.spotlight, { width: spot, height: spot, borderRadius: spot / 2, backgroundColor: tint ?? colors.stage }]} />
      <SpeechBubble text={bubble} />
      <PetReactionStage
        speciesId={pet.speciesId}
        stage={stage}
        mood={mood}
        equipped={equipped}
        size={size}
        reaction={reaction}
        onReactionStart={onReactionStart ?? (() => {})}
        performance={performance}
        cheerKey={cheerKey}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  spotlight: { position: 'absolute' },
});
