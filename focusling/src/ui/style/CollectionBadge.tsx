import { memo, type ReactElement } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { starPath } from '@/ui/pet/focusClubArt';

/**
 * Collection badges (v1, in-house). Each uses its collection's own motif so the
 * badge alone says which drop it is. Keyed by `CosmeticCollection.badge`.
 */
const BADGES: Record<string, () => ReactElement> = {
  'badge-focus-club': () => (
    <G>
      <Rect x={2} y={2} width={44} height={44} rx={14} fill="#FDEBD8" />
      <Path d="M12 30 C12 22 20 20 24 24 C27 18 38 20 36 30 Z" fill="#A6D4FA" stroke="#4E95D0" strokeWidth={1.5} />
      <Path d={starPath(24, 15, 6)} fill="#FFD166" stroke="#E8A93A" strokeWidth={1.2} />
    </G>
  ),
  'badge-midnight-arcade': () => (
    <G>
      <Rect x={2} y={2} width={44} height={44} rx={10} fill="#1C2143" />
      {[
        [18, 12], [24, 12],
        [12, 18], [18, 18], [24, 18], [30, 18],
        [12, 24], [18, 24], [24, 24], [30, 24],
        [18, 30], [24, 30],
      ].map(([x, y], i) => (
        <Rect key={i} x={x! + 1} y={y! + 1} width={6} height={6} fill={i % 3 === 0 ? '#FF4FD8' : i % 2 ? '#5CF0FF' : '#8B5CFF'} />
      ))}
      <Rect x={6} y={38} width={36} height={3} rx={1.5} fill="#5CF0FF" opacity={0.7} />
    </G>
  ),
  'badge-dreamwave': () => (
    <G>
      <Circle cx={24} cy={24} r={22} fill="#F6EEFF" stroke="#CDB8FF" strokeWidth={2} />
      <Path d="M27 10 A14 14 0 1 0 27 38 A11 11 0 1 1 27 10 Z" fill="#FFD867" stroke="#7E62D6" strokeWidth={1.6} />
      <Path d={starPath(33, 16, 4)} fill="#FF9CC8" />
      <Circle cx={36} cy={30} r={2} fill="#BDE4FF" />
    </G>
  ),
  'badge-cloud-racer': () => (
    <G>
      <Circle cx={24} cy={24} r={22} fill="#FFF3DC" stroke="#E5402B" strokeWidth={2.5} />
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2, 3].map((c) => ((r + c) % 2 === 0 ? <Rect key={`${r}${c}`} x={14 + c * 5} y={12 + r * 5} width={5} height={5} fill="#2A2A33" /> : null)),
      )}
      <Rect x={12} y={12} width={2.5} height={26} fill="#2A2A33" />
      <Path d="M16 36 L40 36" stroke="#2E5BD6" strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M22 40 L38 40" stroke="#FF8A3D" strokeWidth={2.5} strokeLinecap="round" />
    </G>
  ),
};

export function hasBadge(key: string): boolean {
  return key in BADGES;
}

export const CollectionBadge = memo(function CollectionBadge({ badge, size }: { badge: string; size: number }) {
  const art = BADGES[badge];
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {art ? art() : <Circle cx={24} cy={24} r={20} fill="#ECE6FF" />}
    </Svg>
  );
});
