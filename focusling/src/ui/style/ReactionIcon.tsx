import { memo, type ReactElement } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { ReactionStyle } from '@/core';
import { sparklePath, starPath } from '@/ui/pet/focusClubArt';

const ICONS: Record<ReactionStyle, () => ReactElement> = {
  wave: () => (
    <G>
      <Circle cx={20} cy={26} r={12} fill="#ECE6FF" />
      <Path d="M20 18 Q24 22 20 26" stroke="#7B5CFF" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d="M30 12 Q37 20 30 28 M35 8 Q45 20 35 32" stroke="#7B5CFF" strokeWidth={2.8} fill="none" strokeLinecap="round" />
    </G>
  ),
  hop: () => (
    <G>
      <Path d="M24 10 L24 30 M16 18 L24 10 L32 18" stroke="#7B5CFF" strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 42 C14 36 16 30 20 30 C22 30 24 32 24 34 C24 32 26 30 28 30 C32 30 34 36 24 42 Z" fill="#FF6FA3" />
    </G>
  ),
  sleepy: () => (
    <G>
      <Path d="M10 18 L22 18 L11 30 L23 30" stroke="#7E62D6" strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M27 10 L36 10 L28 19 L37 19" stroke="#B9A6F2" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M30 40 A8 8 0 1 0 30 26 A6 6 0 1 1 30 40 Z" fill="#FFD867" />
    </G>
  ),
  cool: () => (
    <G>
      <Path d="M8 22 Q14 16 20 22" stroke="#2F2548" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Circle cx={30} cy={21} r={5} fill="#2F2548" />
      <Path d="M14 32 Q24 38 34 29" stroke="#2F2548" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d={sparklePath(40, 10, 6)} fill="#FFD166" />
    </G>
  ),
  twirl: () => (
    <G>
      <Path d="M36 24 A12 12 0 1 1 30 13.6" stroke="#7B5CFF" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d="M26 8 L31 13.5 L24 16" stroke="#7B5CFF" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d={starPath(24, 24, 6)} fill="#FFD166" />
    </G>
  ),
  'pixel-pop': () => (
    <G>
      <Rect x={18} y={18} width={12} height={12} fill="#8B5CFF" />
      <Rect x={6} y={8} width={8} height={8} fill="#5CF0FF" />
      <Rect x={36} y={8} width={6} height={6} fill="#FF4FD8" />
      <Rect x={34} y={34} width={8} height={8} fill="#5CF0FF" />
      <Rect x={6} y={34} width={6} height={6} fill="#FF4FD8" />
    </G>
  ),
  firefly: () => (
    <G>
      <Path d="M8 40 Q14 26 24 30 Q30 32 28 40 Z" fill="#6E9B4E" />
      <Path d="M20 34 Q24 28 30 30" stroke="#2F4A2E" strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Circle cx={34} cy={14} r={6} fill="#E9F27A" opacity={0.45} />
      <Circle cx={34} cy={14} r={3} fill="#E9F27A" stroke="#6E9B4E" strokeWidth={1} />
      <Circle cx={18} cy={12} r={4} fill="#E9F27A" opacity={0.35} />
      <Circle cx={18} cy={12} r={2} fill="#E9F27A" />
      <Circle cx={40} cy={28} r={1.8} fill="#E9F27A" />
    </G>
  ),
  'dream-float': () => (
    <G>
      <Path d="M27 8 A10 10 0 1 0 27 28 A12.5 12.5 0 0 1 27 8 Z" fill="#FFD867" stroke="#7E62D6" strokeWidth={1.6} />
      <Circle cx={14} cy={36} r={6} fill="#FFFFFF" stroke="#BDE4FF" strokeWidth={1.5} />
      <Circle cx={22} cy={33} r={7.5} fill="#FFFFFF" stroke="#BDE4FF" strokeWidth={1.5} />
      <Circle cx={30} cy={37} r={5} fill="#FFFFFF" stroke="#BDE4FF" strokeWidth={1.5} />
      <Rect x={14} y={36} width={16} height={6} fill="#FFFFFF" />
      <Path d={sparklePath(38, 12, 4)} fill="#CDB8FF" />
    </G>
  ),
  'victory-lap': () => (
    <G>
      <Rect x={14} y={8} width={3} height={32} fill="#2A2A33" />
      {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => ((r + c) % 2 === 0 ? <Rect key={`${r}${c}`} x={17 + c * 5} y={8 + r * 5} width={5} height={5} fill="#2A2A33" /> : null)))}
      <Rect x={17} y={8} width={20} height={15} fill="none" stroke="#2A2A33" strokeWidth={1.5} />
      <Path d="M4 30 L12 30 M2 36 L12 36" stroke="#FF8A3D" strokeWidth={2.6} strokeLinecap="round" />
    </G>
  ),
};

export const ReactionIcon = memo(function ReactionIcon({ style, size }: { style: ReactionStyle; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {ICONS[style]()}
    </Svg>
  );
});
