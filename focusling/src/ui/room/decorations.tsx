import type { ReactElement } from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

/**
 * Room decoration art keyed by shop item id. Drawn in a 360×300 room space;
 * each piece positions itself for its slot.
 */
export const DECORATION_ART: Record<string, () => ReactElement> = {
  'decor-star-garland': () => (
    <G>
      <Path d="M20 34 Q100 70 180 38 Q260 70 340 34" stroke="#C9A27A" strokeWidth={2} fill="none" />
      {[
        [48, 46],
        [100, 56],
        [150, 48],
        [210, 50],
        [262, 56],
        [312, 44],
      ].map(([x, y], i) => (
        <Path
          key={i}
          d={`M${x} ${y! - 8} L${x! + 2.5} ${y! - 2.5} L${x! + 8} ${y} L${x! + 2.5} ${y! + 2.5} L${x} ${y! + 8} L${x! - 2.5} ${y! + 2.5} L${x! - 8} ${y} L${x! - 2.5} ${y! - 2.5} Z`}
          fill={i % 2 ? '#FFC94D' : '#FF9EC7'}
        />
      ))}
    </G>
  ),
  'decor-potted-plant': () => (
    <G>
      <Path d="M52 200 C36 170 30 150 40 130 C50 150 54 170 56 196 Z" fill="#5BC286" />
      <Path d="M58 198 C62 160 74 140 90 132 C86 156 74 178 62 200 Z" fill="#7ED9A5" />
      <Path d="M56 196 C50 168 56 146 66 128 C70 152 66 176 60 198 Z" fill="#4BAE6E" />
      <Path d="M34 196 L82 196 L76 238 L40 238 Z" fill="#E98A5B" />
      <Rect x={30} y={190} width={56} height={12} rx={4} fill="#F4A274" />
    </G>
  ),
  'decor-glow-lamp': () => (
    <G>
      <Circle cx={306} cy={134} r={42} fill="#FFE9A8" opacity={0.45} />
      <Path d="M284 150 L328 150 L318 116 L294 116 Z" fill="#FFD166" />
      <Rect x={303} y={150} width={6} height={80} fill="#B58A63" />
      <Ellipse cx={306} cy={234} rx={24} ry={6} fill="#B58A63" />
    </G>
  ),
  'decor-beanbag': () => (
    <G>
      <Path d="M262 240 C250 212 262 180 296 176 C332 172 350 204 344 240 Z" fill="#7B5CFF" />
      <Path d="M276 206 C290 196 318 196 332 208" stroke="#9D85FF" strokeWidth={5} strokeLinecap="round" fill="none" />
      <Ellipse cx={302} cy={240} rx={44} ry={8} fill="#5E41E0" />
    </G>
  ),
};
