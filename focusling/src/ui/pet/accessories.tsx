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
  'acc-bow-tie': ({ neckY }) => (
    <G>
      <Path d={`M100 ${neckY} L80 ${neckY - 11} L80 ${neckY + 11} Z`} fill="#F2596B" />
      <Path d={`M100 ${neckY} L120 ${neckY - 11} L120 ${neckY + 11} Z`} fill="#F2596B" />
      <Circle cx={100} cy={neckY} r={6} fill="#D63F52" />
    </G>
  ),
};

/** Draw order: lower layers first so hats sit over headphones, etc. */
export const ACCESSORY_LAYER_ORDER: readonly AccessorySlot[] = ['neck', 'face', 'ears', 'head'];
