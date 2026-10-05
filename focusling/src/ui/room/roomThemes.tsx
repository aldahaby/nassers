import type { ReactElement } from 'react';
import { Circle, G, Path, Rect } from 'react-native-svg';
import type { RoomTheme } from '@/config/roomThemes';
import type { RoomPalette } from './roomPalette';

/**
 * Premium room theme art (original, flat SVG, in the 360×300 room space).
 * A theme adds coordinated wall atmosphere and a floor material on top of the
 * derived palette of its base colour. It stays behind the pet and decorations,
 * so the Focusling is still the first thing you see.
 */

const sparkle = (x: number, y: number, s: number) => `M${x} ${y - s} L${x + s * 0.3} ${y - s * 0.3} L${x + s} ${y} L${x + s * 0.3} ${y + s * 0.3} L${x} ${y + s} L${x - s * 0.3} ${y + s * 0.3} L${x - s} ${y} L${x - s * 0.3} ${y - s * 0.3} Z`;

export function ThemeWall({ theme, p }: { theme: RoomTheme; p: RoomPalette }): ReactElement {
  const [a, b] = theme.accents;
  switch (theme.pattern) {
    case 'stars':
      return (
        <G>
          {[
            [34, 40, 5],
            [92, 26, 3.5],
            [264, 34, 4.5],
            [318, 70, 3],
            [58, 120, 3],
            [300, 140, 4],
            [244, 104, 2.5],
          ].map(([x, y, s], i) => (
            <Path key={i} d={sparkle(x!, y!, s!)} fill={i % 2 ? b : a} opacity={0.85} />
          ))}
          {/* Soft cloud bands. */}
          <Path d="M0 190 C40 176 80 196 120 184 C160 172 200 192 240 182 C280 172 320 190 360 180 L360 226 L0 226 Z" fill="#FFFFFF" opacity={0.07} />
          <Path d="M300 40 A16 16 0 1 0 300 72 A20 20 0 0 1 300 40 Z" fill={a} opacity={0.9} />
        </G>
      );
    case 'scanlines':
      return (
        <G>
          {Array.from({ length: 22 }, (_, i) => (
            <Rect key={i} x={0} y={i * 10} width={360} height={2} fill="#FFFFFF" opacity={0.035} />
          ))}
          {[
            [40, 50, a],
            [70, 90, b],
            [300, 60, a],
            [326, 110, b],
            [270, 150, a],
          ].map(([x, y, c], i) => (
            <G key={i}>
              <Rect x={(x as number) - 6} y={(y as number) - 6} width={12} height={12} fill={c as string} opacity={0.18} />
              <Rect x={(x as number) - 3} y={(y as number) - 3} width={6} height={6} fill={c as string} />
            </G>
          ))}
          <Rect x={0} y={218} width={360} height={3} fill={a} opacity={0.6} />
        </G>
      );
    case 'checker':
      return (
        <G>
          {/* A checker band and a racing stripe along the wall. */}
          {Array.from({ length: 24 }, (_, i) => (
            <G key={i}>
              <Rect x={i * 15} y={176} width={7.5} height={7.5} fill="#2A2A33" opacity={0.85} />
              <Rect x={i * 15 + 7.5} y={183.5} width={7.5} height={7.5} fill="#2A2A33" opacity={0.85} />
            </G>
          ))}
          <Rect x={0} y={196} width={360} height={6} fill={a} />
          <Rect x={0} y={204} width={360} height={3} fill={b} />
          <Path d="M30 60 C30 50 42 46 48 54 C52 46 64 48 63 60 Z" fill={b} opacity={0.25} />
          <Path d="M290 46 C290 36 302 32 308 40 C312 32 324 34 323 46 Z" fill={a} opacity={0.22} />
        </G>
      );
    case 'leaves':
      return (
        <G>
          {[
            [40, 40, -20],
            [90, 120, 30],
            [300, 50, 15],
            [326, 150, -35],
            [250, 110, 55],
            [20, 170, 10],
          ].map(([x, y, r], i) => (
            <Path key={i} d={`M${x} ${y} C${x! + 6} ${y! - 10} ${x! + 18} ${y! - 12} ${x! + 22} ${y! - 6} C${x! + 16} ${y! + 2} ${x! + 6} ${y! + 4} ${x} ${y} Z`} fill={a} opacity={0.55} transform={`rotate(${r} ${x} ${y})`} />
          ))}
          {[
            [70, 70],
            [280, 92],
            [230, 40],
            [110, 160],
          ].map(([x, y], i) => (
            <G key={`f${i}`}>
              <Circle cx={x} cy={y} r={6} fill={b} opacity={0.18} />
              <Circle cx={x} cy={y} r={2.2} fill={b} />
            </G>
          ))}
        </G>
      );
  }
}

export function ThemeFloor({ theme, p }: { theme: RoomTheme; p: RoomPalette }): ReactElement {
  const [a, b] = theme.accents;
  switch (theme.floor) {
    case 'plush':
      return <Path d="M70 262 C70 244 290 244 290 262 C290 280 70 280 70 262 Z" fill={b} opacity={0.35} />;
    case 'grid':
      return (
        <G>
          {Array.from({ length: 13 }, (_, i) => (
            <Path key={i} d={`M${180 + (i - 6) * 18} 232 L${180 + (i - 6) * 60} 300`} stroke={a} strokeWidth={1} opacity={0.35} />
          ))}
          {[246, 262, 282].map((y) => (
            <Path key={y} d={`M0 ${y} L360 ${y}`} stroke={a} strokeWidth={1} opacity={0.3} />
          ))}
        </G>
      );
    case 'tile':
      return (
        <G>
          {Array.from({ length: 10 }, (_, i) => (
            <Path key={i} d={`M${i * 40} 232 L${i * 40} 300`} stroke={p.floorEdge} strokeWidth={1.2} opacity={0.7} />
          ))}
          <Path d="M0 264 L360 264" stroke={p.floorEdge} strokeWidth={1.2} opacity={0.7} />
        </G>
      );
    case 'planks':
      return (
        <G>
          {[244, 258, 274, 290].map((y, i) => (
            <G key={y}>
              <Path d={`M0 ${y} L360 ${y}`} stroke="#3B2A1A" strokeWidth={1.2} opacity={0.22} />
              <Path d={`M${60 + i * 70} ${y - 13} L${60 + i * 70} ${y}`} stroke="#3B2A1A" strokeWidth={1.2} opacity={0.18} />
            </G>
          ))}
        </G>
      );
  }
}
