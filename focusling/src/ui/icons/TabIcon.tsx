import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type TabIconName = 'pet' | 'focus' | 'shop' | 'stats' | 'settings' | 'missions' | 'play' | 'wardrobe' | 'bag' | 'lock' | 'check' | 'collections' | 'reactions' | 'looks' | 'plus' | 'palette' | 'sound' | 'soundOff';

/** Simple original line icons for the tab bar. */
export function TabIcon({ name, color, size = 26 }: { name: TabIconName; color: ColorValue; size?: number }) {
  const stroke = { stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'palette' && (
        <>
          <Path d="M12 4 C7 4 4 7.5 4 11.5 C4 15.5 7 19 11 19 C12.6 19 13 18 12.4 16.9 C11.8 15.8 12.6 14.6 14 14.6 L16 14.6 C18.4 14.6 20 13 20 10.8 C20 7 16.5 4 12 4 Z" {...stroke} />
          <Circle cx={8.5} cy={10.5} r={1.3} fill={color} />
          <Circle cx={12} cy={8} r={1.3} fill={color} />
          <Circle cx={15.5} cy={10} r={1.3} fill={color} />
        </>
      )}
      {(name === 'sound' || name === 'soundOff') && (
        <>
          <Path d="M4 10 L7.5 10 L12 6 L12 18 L7.5 14 L4 14 Z" {...stroke} />
          {name === 'sound' ? <Path d="M15.5 9.5 Q17.5 12 15.5 14.5 M18 7.5 Q21.5 12 18 16.5" {...stroke} /> : <Path d="M15.5 9.5 L20.5 14.5 M20.5 9.5 L15.5 14.5" {...stroke} />}
        </>
      )}
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
      {name === 'missions' && (
        <>
          <Circle cx={12} cy={12} r={8} {...stroke} />
          <Circle cx={12} cy={12} r={4} {...stroke} />
          <Circle cx={12} cy={12} r={0.8} fill={color} />
        </>
      )}
      {name === 'play' && (
        <>
          <Path d="M12 20 C12 20 4 15 4 9.5 C4 7 6 5 8.3 5 C9.9 5 11.2 6 12 7.2 C12.8 6 14.1 5 15.7 5 C18 5 20 7 20 9.5 C20 15 12 20 12 20 Z" {...stroke} />
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
      {name === 'wardrobe' && (
        <>
          <Path d="M12 7.5 C12 5.2 15 5.2 15 7.2 C15 8.4 12 8.6 12 10 L3.5 15.5 C2.8 16 3.1 17 4 17 L20 17 C20.9 17 21.2 16 20.5 15.5 L12 10" {...stroke} />
        </>
      )}
      {name === 'bag' && (
        <>
          <Rect x={4.5} y={8} width={15} height={12} rx={3} {...stroke} />
          <Path d="M9 8 C9 4.5 15 4.5 15 8" {...stroke} />
          <Path d="M9 12.5 L15 12.5" {...stroke} />
        </>
      )}
      {name === 'lock' && (
        <>
          <Rect x={5} y={10.5} width={14} height={10} rx={3} {...stroke} />
          <Path d="M8.5 10.5 L8.5 8 C8.5 3.6 15.5 3.6 15.5 8 L15.5 10.5" {...stroke} />
          <Circle cx={12} cy={15.5} r={1.4} fill={color} />
        </>
      )}
      {name === 'check' && <Path d="M5 12.5 L10 17.5 L19 7" {...stroke} strokeWidth={3} />}
      {name === 'collections' && (
        <>
          <Rect x={4} y={7} width={13} height={13} rx={3} {...stroke} />
          <Path d="M8 4 L18 4 C19.1 4 20 4.9 20 6 L20 16" {...stroke} />
          <Path d="M10.5 11 L10.5 16 M8 13.5 L13 13.5" {...stroke} />
        </>
      )}
      {name === 'reactions' && (
        <>
          <Circle cx={11} cy={13} r={7.5} {...stroke} />
          <Path d="M8 14.5 Q11 17.5 14 14.5" {...stroke} />
          <Path d="M8.5 10.5 L8.5 11 M13.5 10.5 L13.5 11" {...stroke} />
          <Path d="M19 2.5 L19.8 4.7 L22 5.5 L19.8 6.3 L19 8.5 L18.2 6.3 L16 5.5 L18.2 4.7 Z" fill={color} />
        </>
      )}
      {name === 'looks' && (
        <>
          <Path d="M8 4 L5 7 L3 12 L6 13 L6 20 L18 20 L18 13 L21 12 L19 7 L16 4 C15 6 9 6 8 4 Z" {...stroke} />
        </>
      )}
      {name === 'plus' && <Path d="M12 5 L12 19 M5 12 L19 12" {...stroke} strokeWidth={2.6} />}
    </Svg>
  );
}
