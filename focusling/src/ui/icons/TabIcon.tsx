import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type TabIconName = 'pet' | 'focus' | 'shop' | 'stats' | 'settings';

/** Simple original line icons for the tab bar. */
export function TabIcon({ name, color, size = 26 }: { name: TabIconName; color: ColorValue; size?: number }) {
  const stroke = { stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'pet' && (
        <>
          <Path d="M12 4 C17 4 20 8 20 13 C20 17.5 16.5 20 12 20 C7.5 20 4 17.5 4 13 C4 8 7 4 12 4 Z" {...stroke} />
          <Circle cx={9.5} cy={12} r={1.2} fill={color} />
          <Circle cx={14.5} cy={12} r={1.2} fill={color} />
          <Path d="M10.5 15 Q12 16.3 13.5 15" {...stroke} />
        </>
      )}
      {name === 'focus' && (
        <>
          <Circle cx={12} cy={13} r={7.5} {...stroke} />
          <Path d="M12 9 L12 13 L15 15" {...stroke} />
          <Path d="M10 3 L14 3" {...stroke} />
        </>
      )}
      {name === 'shop' && (
        <>
          <Path d="M5 9 L19 9 L18 20 L6 20 Z" {...stroke} />
          <Path d="M9 9 C9 5 15 5 15 9" {...stroke} />
        </>
      )}
      {name === 'stats' && (
        <>
          <Rect x={4} y={12} width={4} height={8} rx={1.2} {...stroke} />
          <Rect x={10} y={7} width={4} height={13} rx={1.2} {...stroke} />
          <Rect x={16} y={4} width={4} height={16} rx={1.2} {...stroke} />
        </>
      )}
      {name === 'settings' && (
        <>
          <Circle cx={12} cy={12} r={3} {...stroke} />
          <Path
            d="M12 3 L13.5 5.5 L16.5 5 L17 8 L19.5 9.5 L18.5 12 L19.5 14.5 L17 16 L16.5 19 L13.5 18.5 L12 21 L10.5 18.5 L7.5 19 L7 16 L4.5 14.5 L5.5 12 L4.5 9.5 L7 8 L7.5 5 L10.5 5.5 Z"
            {...stroke}
          />
        </>
      )}
    </Svg>
  );
}
