import type { ReactElement } from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

/** Crop (viewBox in room space) framing each decoration for its shop icon. */
export const DECORATION_ICON_VIEWBOX: Record<string, string> = {
  'decor-potted-plant': '22 122 76 120',
  'decor-star-garland': '34 30 132 36',
  'decor-glow-lamp': '262 90 88 150',
  'decor-beanbag': '250 168 104 82',
  'decor-cozy-rug': '62 238 236 52',
  'decor-aquarium': '14 150 106 100',
};

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
  'decor-cozy-rug': () => (
    <G>
      <Ellipse cx={180} cy={264} rx={112} ry={22} fill="#C9B8FF" />
      <Ellipse cx={180} cy={264} rx={92} ry={16} fill="none" stroke="#FFFFFF" strokeWidth={3} strokeDasharray="8 7" opacity={0.8} />
      <Ellipse cx={180} cy={264} rx={60} ry={10} fill="#B39DFF" />
    </G>
  ),
  'decor-aquarium': () => (
    <G>
      <Rect x={26} y={222} width={82} height={20} rx={4} fill="#B58A63" />
      <Rect x={22} y={158} width={90} height={66} rx={10} fill="#BFE6FF" stroke="#8CCBF0" strokeWidth={4} />
      <Rect x={26} y={172} width={82} height={48} rx={6} fill="#8FD3FF" />
      <Path d="M30 212 C40 202 44 214 52 206 C60 214 66 202 74 210 C84 202 92 214 104 206 L104 220 L30 220 Z" fill="#E9D3A8" />
      <Path d="M44 214 C42 200 48 194 46 184" stroke="#4BAE6E" strokeWidth={4} fill="none" strokeLinecap="round" />
      <Path d="M92 216 C94 204 88 198 92 190" stroke="#5BC286" strokeWidth={4} fill="none" strokeLinecap="round" />
      <G>
        <Ellipse cx={66} cy={188} rx={10} ry={6} fill="#FFA66E" />
        <Path d="M56 188 L48 182 L48 194 Z" fill="#FFA66E" />
        <Circle cx={71} cy={187} r={1.6} fill="#2B2140" />
      </G>
      <G>
        <Ellipse cx={88} cy={202} rx={7} ry={4.5} fill="#FF6FA3" />
        <Path d="M95 202 L101 198 L101 206 Z" fill="#FF6FA3" />
        <Circle cx={84} cy={201} r={1.3} fill="#2B2140" />
      </G>
      <Circle cx={78} cy={180} r={2} fill="#FFFFFF" opacity={0.8} />
      <Circle cx={82} cy={174} r={1.4} fill="#FFFFFF" opacity={0.8} />
      <Rect x={28} y={162} width={20} height={4} rx={2} fill="#FFFFFF" opacity={0.6} />
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
