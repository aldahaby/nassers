import type { ReactElement } from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

/**
 * Original vector art for toys and food, drawn in a 100×100 box. Also used by the
 * pet-screen animations (the ball that bounces is the same ball as the icon).
 */
export const TOY_FOOD_ART: Record<string, () => ReactElement> = {
  'toy-bouncy-ball': () => (
    <G>
      <Circle cx={50} cy={52} r={34} fill="#FF6B6B" />
      <Path d="M18 44 C36 58 64 58 82 44" stroke="#FFFFFF" strokeWidth={7} fill="none" strokeLinecap="round" />
      <Path d="M22 66 C40 76 62 76 80 64" stroke="#FFD166" strokeWidth={6} fill="none" strokeLinecap="round" />
      <Ellipse cx={38} cy={32} rx={9} ry={6} fill="#FFFFFF" opacity={0.55} />
    </G>
  ),
  'toy-squeaky-star': () => (
    <G>
      <Path
        d="M50 10 L61 36 L89 38 L67 56 L75 84 L50 68 L25 84 L33 56 L11 38 L39 36 Z"
        fill="#FFD166"
        stroke="#F5B82E"
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <Circle cx={43} cy={48} r={3.5} fill="#2B2140" />
      <Circle cx={57} cy={48} r={3.5} fill="#2B2140" />
      <Path d="M44 56 Q50 61 56 56" stroke="#2B2140" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Circle cx={37} cy={54} r={3} fill="#FF9EC7" opacity={0.7} />
      <Circle cx={63} cy={54} r={3} fill="#FF9EC7" opacity={0.7} />
    </G>
  ),
  'toy-plush-bear': () => (
    <G>
      <Circle cx={28} cy={24} r={11} fill="#C98B5E" />
      <Circle cx={72} cy={24} r={11} fill="#C98B5E" />
      <Circle cx={28} cy={24} r={5} fill="#F2C6A0" />
      <Circle cx={72} cy={24} r={5} fill="#F2C6A0" />
      <Ellipse cx={50} cy={74} rx={26} ry={20} fill="#C98B5E" />
      <Ellipse cx={50} cy={78} rx={14} ry={11} fill="#F2C6A0" />
      <Circle cx={50} cy={40} r={26} fill="#D69A6B" />
      <Ellipse cx={50} cy={48} rx={11} ry={8} fill="#F2C6A0" />
      <Ellipse cx={50} cy={45} rx={4} ry={3} fill="#5B3A29" />
      <Circle cx={40} cy={36} r={3.4} fill="#2B2140" />
      <Circle cx={60} cy={36} r={3.4} fill="#2B2140" />
      <Path d="M40 60 L50 66 L60 60 L60 70 L50 66 L40 70 Z" fill="#FF6FA3" />
    </G>
  ),
  'toy-bubble-wand': () => (
    <G>
      <Rect x={46} y={52} width={8} height={42} rx={4} fill="#7B5CFF" transform="rotate(-24 50 73)" />
      <Circle cx={40} cy={40} r={16} fill="none" stroke="#7B5CFF" strokeWidth={6} />
      <Circle cx={40} cy={40} r={12} fill="#CFE8FF" opacity={0.6} />
      <Circle cx={72} cy={24} r={11} fill="#CFE8FF" stroke="#8CCBF0" strokeWidth={2} opacity={0.9} />
      <Circle cx={80} cy={50} r={7} fill="#FFD6EA" stroke="#FF9EC7" strokeWidth={2} opacity={0.9} />
      <Circle cx={60} cy={10} r={5} fill="#E3F9EC" stroke="#7ED9A5" strokeWidth={2} opacity={0.9} />
      <Circle cx={69} cy={20} r={3} fill="#FFFFFF" />
    </G>
  ),
  'food-berry-snack': () => (
    <G>
      <Path d="M52 20 C60 8 74 10 76 14 C68 18 60 20 52 20 Z" fill="#5BC286" />
      <Circle cx={36} cy={58} r={17} fill="#6C63D9" />
      <Circle cx={62} cy={54} r={17} fill="#7B72F0" />
      <Circle cx={50} cy={76} r={17} fill="#5A51C4" />
      {[
        [36, 50],
        [62, 46],
        [50, 68],
      ].map(([x, y]) => (
        <Path key={`${x}`} d={`M${x! - 4} ${y} L${x! + 4} ${y} M${x} ${y! - 4} L${x} ${y! + 4}`} stroke="#3E3796" strokeWidth={2.4} strokeLinecap="round" />
      ))}
      <Circle cx={30} cy={52} r={4} fill="#FFFFFF" opacity={0.5} />
    </G>
  ),
  'food-cookie': () => (
    <G>
      <Circle cx={50} cy={52} r={36} fill="#E7B777" />
      <Circle cx={50} cy={52} r={36} fill="none" stroke="#CF9A56" strokeWidth={4} />
      {[
        [36, 38],
        [60, 34],
        [66, 58],
        [42, 64],
        [52, 50],
        [30, 54],
      ].map(([x, y]) => (
        <Ellipse key={`${x}-${y}`} cx={x} cy={y} rx={4.5} ry={3.5} fill="#6B4226" />
      ))}
      <Path d="M28 30 Q34 24 42 22" stroke="#F5D3A0" strokeWidth={3} fill="none" strokeLinecap="round" />
    </G>
  ),
  'food-fruit-bowl': () => (
    <G>
      <Circle cx={36} cy={42} r={13} fill="#FFA94D" />
      <Circle cx={60} cy={38} r={12} fill="#7ED957" />
      <Path d="M48 48 C40 34 56 26 58 40 C62 30 76 38 66 50 Z" fill="#FF5C7A" />
      <Circle cx={72} cy={46} r={8} fill="#9C6ADE" />
      <Path d="M60 26 L62 20" stroke="#4BAE6E" strokeWidth={3} strokeLinecap="round" />
      <Path d="M14 50 L86 50 C84 74 70 86 50 86 C30 86 16 74 14 50 Z" fill="#7B5CFF" />
      <Path d="M14 50 L86 50" stroke="#9D85FF" strokeWidth={6} strokeLinecap="round" />
      <Path d="M30 66 Q50 74 70 66" stroke="#9D85FF" strokeWidth={3} fill="none" strokeLinecap="round" />
    </G>
  ),
  'food-honey-cake': () => (
    <G>
      <Ellipse cx={50} cy={80} rx={38} ry={8} fill="#F0E0CC" />
      <Rect x={18} y={40} width={64} height={38} rx={10} fill="#F4C27A" />
      <Rect x={18} y={56} width={64} height={6} fill="#FFF1D6" />
      <Path d="M18 48 C18 36 82 36 82 48 L82 52 C76 60 72 50 66 56 C60 64 56 50 50 58 C44 64 40 50 34 56 C28 62 22 52 18 54 Z" fill="#FFB938" />
      <Circle cx={50} cy={30} r={7} fill="#FF5C7A" />
      <Path d="M50 23 Q54 14 60 12" stroke="#4BAE6E" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Circle cx={47} cy={28} r={2} fill="#FFFFFF" opacity={0.7} />
    </G>
  ),
};
