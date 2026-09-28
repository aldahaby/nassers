import type { ReactElement } from 'react';
import { Circle, G, Path, Rect } from 'react-native-svg';
import { getShopItem } from '@/config/shopCatalog';
import type { AccessorySlot, GrowthStage, ItemFit, ItemPalette, PetSpeciesId } from '@/core';
import type { PetAnatomy } from './anatomy';
import { FOCUS_CLUB_ART, FOCUS_CLUB_ICON_VIEWBOX } from './focusClubArt';
import { STYLE_ART, STYLE_ICON_VIEWBOX } from './styleArt';

export type AccessoryArt = (a: PetAnatomy, palette: ItemPalette) => ReactElement;

const NEUTRAL: ItemPalette = { primary: '#C9B8FF', secondary: '#7B5CFF', accent: '#FFFFFF' };

/**
 * Artwork for wearable items, keyed by art key (an item's `art.key`, or its id),
 * drawn relative to the shared anatomy anchors. Palette-driven drawings give
 * every colourway from one function. Auras are drawn by `AuraLayer` instead.
 */
const CLASSIC_ART: Record<string, AccessoryArt> = {
  'acc-cap': ({ headTop }) => (
    <G>
      <Path d={`M62 ${headTop + 22} C62 ${headTop - 6} 138 ${headTop - 6} 138 ${headTop + 22} Z`} fill="#4FA8FF" />
      <Path d={`M100 ${headTop - 1} L100 ${headTop + 22}`} stroke="#3A8BE0" strokeWidth={2.5} />
      <Path d={`M122 ${headTop + 18} C146 ${headTop + 14} 164 ${headTop + 20} 166 ${headTop + 26} L122 ${headTop + 26} Z`} fill="#3A8BE0" />
      <Rect x={60} y={headTop + 19} width={80} height={7} rx={3.5} fill="#3A8BE0" />
      <Circle cx={100} cy={headTop - 1} r={4} fill="#FFD166" />
    </G>
  ),
  'acc-sunglasses': ({ eyeY, eyeDx }) => (
    <G>
      <Path d={`M${100 - eyeDx - 13} ${eyeY - 6} L${100 + eyeDx + 13} ${eyeY - 6}`} stroke="#241B35" strokeWidth={3.5} strokeLinecap="round" />
      {/* Dark tint, not opaque: the eyes still read through (character visibility rule). */}
      <Rect x={100 - eyeDx - 14} y={eyeY - 9} width={28} height={20} rx={8} fill="#241B35" opacity={0.72} />
      <Rect x={100 + eyeDx - 14} y={eyeY - 9} width={28} height={20} rx={8} fill="#241B35" opacity={0.72} />
      <Rect x={100 - eyeDx - 14} y={eyeY - 9} width={28} height={20} rx={8} fill="none" stroke="#241B35" strokeWidth={2.5} />
      <Rect x={100 + eyeDx - 14} y={eyeY - 9} width={28} height={20} rx={8} fill="none" stroke="#241B35" strokeWidth={2.5} />
      <Path d={`M${100 - eyeDx - 8} ${eyeY - 3} L${100 - eyeDx - 2} ${eyeY - 5}`} stroke="#8F7BFF" strokeWidth={3} strokeLinecap="round" />
      <Path d={`M${100 + eyeDx - 8} ${eyeY - 3} L${100 + eyeDx - 2} ${eyeY - 5}`} stroke="#8F7BFF" strokeWidth={3} strokeLinecap="round" />
    </G>
  ),
  'acc-headphones': ({ headTop, eyeY, headHalfWidth }) => (
    <G>
      <Path
        d={`M${100 - headHalfWidth + 2} ${eyeY - 6} C${100 - headHalfWidth + 2} ${headTop - 16} ${100 + headHalfWidth - 2} ${headTop - 16} ${100 + headHalfWidth - 2} ${eyeY - 6}`}
        stroke="#FF6FA3"
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
      />
      <Rect x={100 - headHalfWidth - 10} y={eyeY - 16} width={20} height={32} rx={9} fill="#FF6FA3" />
      <Rect x={100 + headHalfWidth - 10} y={eyeY - 16} width={20} height={32} rx={9} fill="#FF6FA3" />
      <Rect x={100 - headHalfWidth - 5} y={eyeY - 10} width={10} height={20} rx={5} fill="#FFC2D8" />
      <Rect x={100 + headHalfWidth - 5} y={eyeY - 10} width={10} height={20} rx={5} fill="#FFC2D8" />
    </G>
  ),
  'acc-flower-crown': ({ headTop: h }) => (
    <G>
      <Path d={`M60 ${h + 22} Q100 ${h - 2} 140 ${h + 22}`} stroke="#4BAE6E" strokeWidth={4} fill="none" strokeLinecap="round" />
      {[
        [63, h + 19, '#FF9EC7'],
        [80, h + 10, '#FFD166'],
        [100, h + 7, '#FFFFFF'],
        [120, h + 10, '#FFD166'],
        [137, h + 19, '#FF9EC7'],
      ].map(([x, y, color]) => (
        <G key={`${x}`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <Circle
              key={a}
              cx={(x as number) + Math.cos((a * Math.PI) / 180) * 5}
              cy={(y as number) + Math.sin((a * Math.PI) / 180) * 5}
              r={4.6}
              fill={color as string}
              stroke="#F2B8CC"
              strokeWidth={0.8}
            />
          ))}
          <Circle cx={x as number} cy={y as number} r={3.2} fill="#F5A623" />
        </G>
      ))}
    </G>
  ),
  'acc-golden-crown': ({ headTop: h }) => (
    <G>
      <Path
        d={`M70 ${h + 14} L70 ${h - 12} L85 ${h + 2} L100 ${h - 20} L115 ${h + 2} L130 ${h - 12} L130 ${h + 14} Z`}
        fill="#FFC94D"
        stroke="#E0A22A"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <Rect x={68} y={h + 8} width={64} height={10} rx={4} fill="#F5B82E" stroke="#E0A22A" strokeWidth={2} />
      <Circle cx={70} cy={h - 13} r={3.5} fill="#FF6FA3" />
      <Circle cx={100} cy={h - 21} r={4} fill="#4FA8FF" />
      <Circle cx={130} cy={h - 13} r={3.5} fill="#FF6FA3" />
      <Circle cx={84} cy={h + 13} r={2.6} fill="#7ED9A5" />
      <Circle cx={100} cy={h + 13} r={3} fill="#FF6FA3" />
      <Circle cx={116} cy={h + 13} r={2.6} fill="#7ED9A5" />
      <Path d={`M92 ${h - 2} L96 ${h - 8}`} stroke="#FFF3C4" strokeWidth={2.5} strokeLinecap="round" />
    </G>
  ),
  'acc-bow-tie': ({ neckY }) => (
    <G>
      <Path d={`M100 ${neckY} L80 ${neckY - 11} L80 ${neckY + 11} Z`} fill="#F2596B" />
      <Path d={`M100 ${neckY} L120 ${neckY - 11} L120 ${neckY + 11} Z`} fill="#F2596B" />
      <Circle cx={100} cy={neckY} r={6} fill="#D63F52" />
    </G>
  ),
};

export const ACCESSORY_ART: Record<string, AccessoryArt> = { ...CLASSIC_ART, ...FOCUS_CLUB_ART, ...STYLE_ART };

/**
 * Draw order inside the pet: lower layers first, so a charm hangs over a collar
 * and hats sit over headphones and visors. Auras live on their own layer.
 */
export const ACCESSORY_LAYER_ORDER: readonly Exclude<AccessorySlot, 'aura'>[] = ['neck', 'charm', 'face', 'head'];

/** The drawing and palette for an item id, or null if it has no worn art. */
export function resolveAccessoryArt(itemId: string): { render: AccessoryArt; palette: ItemPalette; key: string; fit: ItemFit[] } | null {
  const item = getShopItem(itemId);
  const key = item?.art?.key ?? itemId;
  const render = ACCESSORY_ART[key];
  return render ? { render, palette: item?.art?.palette ?? NEUTRAL, key, fit: item?.art?.fit ?? [] } : null;
}

/** Where each wearable slot pivots for fit adjustments (pet space). */
export function slotAnchor(slot: Exclude<AccessorySlot, 'aura'>, a: PetAnatomy): { x: number; y: number } {
  switch (slot) {
    case 'head':
      return { x: 100, y: a.headTop + 10 };
    case 'face':
      return { x: 100, y: a.eyeY };
    case 'neck':
      return { x: 100, y: a.neckY };
    case 'charm':
      return { x: 100, y: a.neckY + 11 };
  }
}

/**
 * Combine the fit overrides that match this species and stage (most specific
 * last) into one SVG transform around the slot anchor. Empty when none apply.
 */
export function fitTransform(fit: readonly ItemFit[], species: PetSpeciesId, stage: GrowthStage, anchor: { x: number; y: number }): string | undefined {
  const matching = fit.filter((f) => (!f.species || f.species === species) && (!f.stage || f.stage === stage));
  if (matching.length === 0) return undefined;
  const sorted = [...matching].sort((a, b) => Number(!!a.species) + Number(!!a.stage) - (Number(!!b.species) + Number(!!b.stage)));
  let dx = 0;
  let dy = 0;
  let scale = 1;
  let rotate = 0;
  for (const f of sorted) {
    dx += f.dx ?? 0;
    dy += f.dy ?? 0;
    scale *= f.scale ?? 1;
    rotate += f.rotate ?? 0;
  }
  const { x, y } = anchor;
  return `translate(${dx} ${dy}) translate(${x} ${y}) rotate(${rotate}) scale(${scale}) translate(${-x} ${-y})`;
}

/**
 * Crop (viewBox in pet space, measured on the Cloudling anatomy) that frames each
 * accessory on its own, so shop icons reuse the exact worn artwork.
 */
export const ACCESSORY_ICON_VIEWBOX: Record<string, string> = {
  ...FOCUS_CLUB_ICON_VIEWBOX,
  ...STYLE_ICON_VIEWBOX,
  'acc-cap': '54 50 116 52',
  'acc-sunglasses': '62 90 76 42',
  'acc-headphones': '28 42 144 90',
  'acc-bow-tie': '72 138 56 40',
  'acc-flower-crown': '52 60 96 40',
  'acc-golden-crown': '60 38 80 56',
};
