import type { ReactElement } from 'react';
import { Circle, G, Path, Rect } from 'react-native-svg';
import type { AccessorySlot } from '@/core';
import type { PetAnatomy } from './anatomy';

type AccessoryArt = (a: PetAnatomy) => ReactElement;

/**
 * Artwork for wearable items, keyed by shop item id, drawn relative to the
 * shared anatomy anchors. Items without art here still work, just invisibly.
 */
export const ACCESSORY_ART: Record<string, AccessoryArt> = {
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
      <Rect x={100 - eyeDx - 14} y={eyeY - 9} width={28} height={20} rx={8} fill="#241B35" />
      <Rect x={100 + eyeDx - 14} y={eyeY - 9} width={28} height={20} rx={8} fill="#241B35" />
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

/** Draw order: lower layers first so hats sit over headphones, etc. */
export const ACCESSORY_LAYER_ORDER: readonly AccessorySlot[] = ['neck', 'face', 'head'];

/**
 * Crop (viewBox in pet space, measured on the Cloudling anatomy) that frames each
 * accessory on its own, so shop icons reuse the exact worn artwork.
 */
export const ACCESSORY_ICON_VIEWBOX: Record<string, string> = {
  'acc-cap': '54 50 116 52',
  'acc-sunglasses': '62 90 76 42',
  'acc-headphones': '28 42 144 90',
  'acc-bow-tie': '72 138 56 40',
  'acc-flower-crown': '52 60 96 40',
  'acc-golden-crown': '60 38 80 56',
};
