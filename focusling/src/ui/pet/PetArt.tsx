import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { PET_SPECIES } from '@/config/pets';
import type { EquipSlot, GrowthStage, PetMood, PetSpeciesId } from '@/core';
import { getShopItem } from '@/config/shopCatalog';
import { ACCESSORY_LAYER_ORDER, fitTransform, resolveAccessoryArt, slotAnchor } from './accessories';
import { AuraLayer } from './auras';
import { ANATOMY } from './anatomy';
import { CRESTS, CrestOpening, crestPlacement, PetCrest } from './crest';
import { PetBody } from './PetBody';
import { PetFace, type FaceExpression } from './PetFace';

export interface PetArtProps {
  speciesId: PetSpeciesId;
  stage: GrowthStage;
  mood: PetMood;
  expression?: FaceExpression;
  equipped?: Partial<Record<EquipSlot, string>>;
  size: number;
  /** Twinkle the equipped aura (AnimatedPet turns this off for Reduce Motion / focus). */
  auraAnimated?: boolean;
  /** Softer aura, e.g. during a focus session. */
  auraDim?: boolean;
}

/** Static, original vector art for a pet. Animation is layered on by AnimatedPet. */
export const PetArt = memo(function PetArt({
  speciesId,
  stage,
  mood,
  expression = 'auto',
  equipped,
  size,
  auraAnimated = false,
  auraDim = false,
}: PetArtProps) {
  const species = PET_SPECIES[speciesId];
  const anatomy = ANATOMY[speciesId];
  const auraItem = equipped?.aura ? getShopItem(equipped.aura) : undefined;
  const layers = ACCESSORY_LAYER_ORDER.map((slot) => {
    const itemId = equipped?.[slot];
    const resolved = itemId ? resolveAccessoryArt(itemId) : null;
    return resolved ? { slot, resolved, transform: fitTransform(resolved.fit, speciesId, stage, slotAnchor(slot, anatomy)) } : null;
  });
  const head = layers.find((l) => l?.slot === 'head');
  // Species crest (sprout, flame): placed around whatever is on the head.
  const crest = crestPlacement(speciesId, stage, head?.resolved.key, anatomy);
  const crestLayer = CRESTS[speciesId]?.layer;
  const crestArt = <PetCrest species={speciesId} palette={species.palette} stage={stage} />;

  const art = (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Ellipse cx={100} cy={182} rx={52} ry={8} fill="#000000" opacity={0.08} />
      {stage === 'evolved' && <EvolvedAura />}
      {crest?.mode === 'under' && crestLayer === 'behind' && crestArt}
      <PetBody speciesId={speciesId} palette={species.palette} stage={stage} />
      {crest?.mode === 'under' && crestLayer === 'front' && crestArt}
      <PetFace anatomy={anatomy} mood={mood} stage={stage} expression={expression} cheekColor={species.palette.cheek} />
      {layers.map((layer) =>
        layer ? (
          <G key={layer.slot} transform={layer.transform}>
            {layer.resolved.render(anatomy, layer.resolved.palette)}
          </G>
        ) : null,
      )}
      {crest?.mode === 'over' && crestArt}
      {crest?.mode === 'lift' && crest.opening && (
        <G transform={head?.transform}>
          <CrestOpening species={speciesId} x={crest.opening.x} y={crest.opening.y} palette={species.palette} />
          <G transform={crest.transform}>{crestArt}</G>
        </G>
      )}
    </Svg>
  );
  if (!auraItem?.art) return art;
  return (
    <View style={{ width: size, height: size }}>
      {art}
      <AuraLayer artKey={auraItem.art.key} palette={auraItem.art.palette ?? { primary: '#FFD166', secondary: '#E8A93A', accent: '#FFF' }} size={size} animated={auraAnimated} dim={auraDim} />
    </View>
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
