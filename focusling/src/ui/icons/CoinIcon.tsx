import Svg, { Circle, Path } from 'react-native-svg';

/** Focusling's coin: a warm gold disc with a little leaf-sprout stamp. */
export function CoinIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={11} fill="#FFC94D" />
      <Circle cx={12} cy={12} r={8.2} fill="#FFB938" stroke="#E09A12" strokeWidth={1.4} />
      <Path d="M12 17 L12 10" stroke="#B07406" strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M12 11 C12 8 14.5 7 16 7.5 C15.6 9.6 14 11 12 11 Z" fill="#B07406" />
      <Path d="M12 12.5 C12 10 9.8 9 8.4 9.4 C8.7 11.3 10.2 12.5 12 12.5 Z" fill="#B07406" />
    </Svg>
  );
}
