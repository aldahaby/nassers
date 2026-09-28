import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { PET_SPECIES } from '@/config/pets';
import type { EquipSlot, GrowthStage, PetMood, PetSpeciesId } from '@/core';
import { getShopItem } from '@/config/shopCatalog';
import { ACCESSORY_LAYER_ORDER, fitTransform, resolveAccessoryArt, slotAnchor } from './accessories';
import { AuraLayer } from './auras';
import { ANATOMY } from './anatomy';
import { ArtScope, useNewArtScope } from './artScope';
import { CloudTufts, CRESTS, CrestOpening, crestPlacement, HEAD_FIT, PetCrest } from './crest';
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
  /** Idle glance direction for the eyes (pet units). */
  gaze?: { x: number; y: number };
  /** Crest wiggle pose: 0 rest, 1/2 the two idle/tap poses (leaf settle, flame flicker). */
  crestPhase?: number;
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
  gaze,
  crestPhase = 0,
}: PetArtProps) {
  const scope = useNewArtScope();
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
  const crestArt = <PetCrest species={speciesId} palette={species.palette} stage={stage} phase={crestPhase} />;
  // Cloudling has no crest to lift; under a closed hat its cloud tufts peek out instead.
  const tufts = speciesId === 'cloudling' && head && HEAD_FIT[head.resolved.key]?.crest === 'lift';

  const art = (
    <ArtScope.Provider value={scope}>
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {/* Contact shadow: a soft wide pool and a tighter core under the feet. */}
      <Ellipse cx={100} cy={182} rx={56} ry={9} fill="#000000" opacity={0.06} />
      <Ellipse cx={100} cy={181} rx={38} ry={5} fill="#000000" opacity={0.1} />
      {stage === 'evolved' && <EvolvedAura />}
      {crest?.mode === 'under' && crestLayer === 'behind' && crestArt}
      <PetBody speciesId={speciesId} palette={species.palette} stage={stage} />
      {crest?.mode === 'under' && crestLayer === 'front' && crestArt}
      <PetFace anatomy={anatomy} mood={mood} stage={stage} expression={expression} cheekColor={species.palette.cheek} species={speciesId} gaze={gaze} />
      {layers.map((layer) =>
        layer ? (
          <G key={layer.slot} transform={layer.transform}>
            {layer.resolved.render(anatomy, layer.resolved.palette)}
          </G>
        ) : null,
      )}
      {tufts && (
        <G transform={head?.transform}>
          <CloudTufts headTop={anatomy.headTop} palette={species.palette} />
        </G>
      )}
      {crest?.mode === 'over' && crestArt}
      {crest?.mode === 'lift' && crest.opening && (
        <G transform={head?.transform}>
          <CrestOpening species={speciesId} x={crest.opening.x} y={crest.opening.y} palette={species.palette} />
          <G transform={crest.transform}>{crestArt}</G>
        </G>
      )}
    </Svg>
    </ArtScope.Provider>
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
