import { StyleSheet, View, useWindowDimensions } from 'react-native';
import type { EquipSlot, GrowthStage, Pet, PetMood } from '@/core';
import { PetReactionStage } from '@/features/pet/PetReactionStage';
import { useRoomColor, type PetReaction } from '@/state';
import { roomPalette } from '@/ui/room/roomPalette';
import { getStageDefinitionById } from '@/core';
import { SpeechBubble } from '@/ui';

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

/**
 * The dressing-room set shared by the Wardrobe and collection pages: pet first,
 * big, on a softly tinted backdrop with a floor, so outfits read like a lookbook.
 */
export function StyleStage({ pet, stage, mood, equipped, tint, bubble = null, reaction = null, onReactionStart, performance, cheerKey, label, maxSize = 340 }: Props) {
  const { width } = useWindowDimensions();
  const size = Math.min(maxSize, width * 0.8);
  const spot = size * getStageDefinitionById(stage).scale * 1.2;
  // With no collection tint, the stage is the pet's own room colour.
  const room = roomPalette(useRoomColor());
  return (
    <View style={[styles.stage, { backgroundColor: tint ?? room.wall, minHeight: size + 24 }]}>
      <View style={[styles.floor, { width: size * 0.9, height: size * 0.1, borderRadius: size }]} />
      <View style={[styles.spotlight, { width: spot, height: spot, borderRadius: spot / 2 }]} />
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
  stage: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 28, overflow: 'hidden' },
  spotlight: { position: 'absolute', backgroundColor: '#FFFFFF', opacity: 0.45 },
  floor: { position: 'absolute', bottom: 18, backgroundColor: '#000000', opacity: 0.05 },
});
