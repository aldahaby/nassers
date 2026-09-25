import { memo } from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { PET_SPECIES } from '@/config/pets';
import type { EquipSlot, GrowthStage, PetMood, PetSpeciesId } from '@/core';
import { ACCESSORY_ART, ACCESSORY_LAYER_ORDER } from './accessories';
import { ANATOMY } from './anatomy';
import { PetBody } from './PetBody';
import { PetFace, type FaceExpression } from './PetFace';

export interface PetArtProps {
  speciesId: PetSpeciesId;
  stage: GrowthStage;
  mood: PetMood;
  expression?: FaceExpression;
  equipped?: Partial<Record<EquipSlot, string>>;
  size: number;
}

/** Static, original vector art for a pet. Animation is layered on by AnimatedPet. */
export const PetArt = memo(function PetArt({ speciesId, stage, mood, expression = 'auto', equipped, size }: PetArtProps) {
  const species = PET_SPECIES[speciesId];
  const anatomy = ANATOMY[speciesId];

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Ellipse cx={100} cy={182} rx={52} ry={8} fill="#000000" opacity={0.08} />
      {stage === 'evolved' && <EvolvedAura />}
      <PetBody speciesId={speciesId} palette={species.palette} stage={stage} />
      <PetFace anatomy={anatomy} mood={mood} stage={stage} expression={expression} cheekColor={species.palette.cheek} />
      {ACCESSORY_LAYER_ORDER.map((slot) => {
        const itemId = equipped?.[slot];
        const art = itemId ? ACCESSORY_ART[itemId] : undefined;
        return art ? <G key={slot}>{art(anatomy)}</G> : null;
      })}
    </Svg>
  );
});

function EvolvedAura() {
  const sparkle = (x: number, y: number, s: number) =>
    `M${x} ${y - s} L${x + s * 0.3} ${y - s * 0.3} L${x + s} ${y} L${x + s * 0.3} ${y + s * 0.3} L${x} ${y + s} L${x - s * 0.3} ${y + s * 0.3} L${x - s} ${y} L${x - s * 0.3} ${y - s * 0.3} Z`;
  return (
    <G>
      <Circle cx={100} cy={116} r={76} fill="#FFE9A8" opacity={0.35} />
      <Path d={sparkle(30, 70, 8)} fill="#FFC94D" />
      <Path d={sparkle(172, 84, 6)} fill="#FFC94D" />
      <Path d={sparkle(160, 40, 5)} fill="#FFC94D" />
    </G>
  );
}
