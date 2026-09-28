import type { ReactElement } from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { ItemPalette } from '@/core';
import type { PetAnatomy } from './anatomy';

type Art = (a: PetAnatomy, p: ItemPalette) => ReactElement;

/** Four-point sparkle centred on (x, y). */
export const sparklePath = (x: number, y: number, s: number) =>
  `M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z`;

const starPath = (x: number, y: number, r: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.48;
    pts.push(`${(x + Math.cos(a) * rr).toFixed(2)} ${(y + Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
};

const heartPath = (x: number, y: number, s: number) =>
  `M${x} ${y + s * 0.9} C${x - s * 1.3} ${y - s * 0.1} ${x - s * 0.7} ${y - s * 1.1} ${x} ${y - s * 0.35} C${x + s * 0.7} ${y - s * 1.1} ${x + s * 1.3} ${y - s * 0.1} ${x} ${y + s * 0.9} Z`;

const boltPath = (x: number, y: number, s: number) =>
  `M${x + s * 0.2} ${y - s} L${x - s * 0.6} ${y + s * 0.15} L${x - s * 0.02} ${y + s * 0.15} L${x - s * 0.25} ${y + s} L${x + s * 0.65} ${y - s * 0.2} L${x + s * 0.05} ${y - s * 0.2} Z`;

/** A thin cord that a charm hangs from, so it never floats. */
function Cord({ neckY, color }: { neckY: number; color: string }) {
  return <Path d={`M76 ${neckY - 4} Q100 ${neckY + 9} 124 ${neckY - 4}`} stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" />;
}

function charm(shape: (x: number, y: number, s: number, p: ItemPalette) => ReactElement): Art {
  return function CharmArt({ neckY }, p) {
    const cx = 100;
    const cy = neckY + 11;
    return (
      <G>
        <Cord neckY={neckY} color={p.secondary} />
        <Path d={`M100 ${neckY + 3} L100 ${cy - 8}`} stroke={p.secondary} strokeWidth={1.8} strokeLinecap="round" />
        <Circle cx={100} cy={neckY + 3} r={1.8} fill={p.secondary} />
        {shape(cx, cy, 8, p)}
      </G>
    );
  };
}

/**
 * Focus Club artwork (v1, in-house vectors). Palette-driven: every colourway
 * of an item shares one drawing. Replace with final illustration by keeping the
 * same art keys and anatomy anchors.
 */
export const FOCUS_CLUB_ART: Record<string, Art> = {
  'gummy-visor': ({ eyeY, eyeDx, headHalfWidth }, p) => {
    const L = 100 - eyeDx - 24;
    const R = 100 + eyeDx + 24;
    const top = eyeY - 15;
    const bottom = eyeY + 13;
    const lens = `M${L + 10} ${top} Q100 ${top - 4} ${R - 10} ${top} Q${R} ${top} ${R} ${top + 10} L${R} ${bottom - 8} Q${R} ${bottom} ${R - 10} ${bottom} L108 ${bottom} Q100 ${bottom - 7} 92 ${bottom} L${L + 10} ${bottom} Q${L} ${bottom} ${L} ${bottom - 8} L${L} ${top + 10} Q${L} ${top} ${L + 10} ${top} Z`;
    return (
      <G>
        <Path d={`M${L} ${eyeY - 4} L${100 - headHalfWidth + 2} ${eyeY - 6}`} stroke={p.secondary} strokeWidth={4} strokeLinecap="round" />
        <Path d={`M${R} ${eyeY - 4} L${100 + headHalfWidth - 2} ${eyeY - 6}`} stroke={p.secondary} strokeWidth={4} strokeLinecap="round" />
        <Path d={lens} fill={p.primary} opacity={p.opacity ?? 0.75} />
        <Path d={lens} fill="none" stroke={p.secondary} strokeWidth={2.5} strokeLinejoin="round" />
        <Path d={`M${L + 10} ${top + 6} Q${L + 26} ${top + 2} ${L + 40} ${top + 5}`} stroke={p.accent} strokeWidth={3.5} strokeLinecap="round" fill="none" opacity={0.9} />
        <Circle cx={R - 12} cy={bottom - 7} r={2.2} fill={p.accent} opacity={0.9} />
      </G>
    );
  },
  'cloud-cap': ({ headTop: h }, p) => (
    <G>
      <Path d={`M56 ${h + 22} C56 ${h - 20} 144 ${h - 20} 144 ${h + 22} Z`} fill={p.primary} />
      <Path d={`M78 ${h + 21} C76 ${h + 2} 84 ${h - 9} 100 ${h - 11}`} stroke={p.secondary} strokeWidth={1.6} fill="none" opacity={0.6} />
      <Path d={`M122 ${h + 21} C124 ${h + 2} 116 ${h - 9} 100 ${h - 11}`} stroke={p.secondary} strokeWidth={1.6} fill="none" opacity={0.6} />
      <G>
        <Circle cx={93} cy={h + 8} r={5.5} fill={p.accent} />
        <Circle cx={100} cy={h + 4} r={7} fill={p.accent} />
        <Circle cx={107.5} cy={h + 8} r={5.5} fill={p.accent} />
        <Rect x={88} y={h + 7} width={25} height={6.5} rx={3.2} fill={p.accent} />
      </G>
      <Path d={`M44 ${h + 25} Q100 ${h + 11} 156 ${h + 25} Q100 ${h + 38} 44 ${h + 25} Z`} fill={p.secondary} />
      <Path d={`M52 ${h + 25} Q100 ${h + 15} 148 ${h + 25}`} stroke={p.primary} strokeWidth={1.4} fill="none" opacity={0.55} />
      <Circle cx={100} cy={h - 9} r={4.5} fill={p.secondary} />
    </G>
  ),
  'charm-harness': ({ neckY: n }, p) => (
    <G>
      <Path d={`M60 ${n - 7} Q100 ${n + 12} 140 ${n - 7}`} stroke={p.primary} strokeWidth={10} fill="none" strokeLinecap="round" />
      <Path d={`M62 ${n - 7} Q100 ${n + 10} 138 ${n - 7}`} stroke={p.secondary} strokeWidth={1.6} fill="none" strokeDasharray="3 3" strokeLinecap="round" />
      <Circle cx={77} cy={n + 1} r={5.2} fill="#FFD166" stroke="#E8A93A" strokeWidth={1.2} />
      <Path d={starPath(77, n + 1, 3.4)} fill="#FFF6D6" />
      <Circle cx={92} cy={n + 4.5} r={5.2} fill="#FF6FA3" stroke="#D94680" strokeWidth={1.2} />
      <Path d={heartPath(92, n + 4.8, 2.6)} fill="#FFE0EC" />
      <Circle cx={108} cy={n + 4.5} r={5.2} fill="#8FD9B0" stroke="#4BAE6E" strokeWidth={1.2} />
      <Path d={`M105.6 ${n + 4} Q108 ${n + 7} 110.4 ${n + 4}`} stroke="#1F6B42" strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Circle cx={123} cy={n + 1} r={5.2} fill="#BFE3FF" stroke="#7FBFEF" strokeWidth={1.2} />
      <Path d={boltPath(123, n + 1, 3.4)} fill="#5B3A4E" />
    </G>
  ),
  'mood-charm-star': charm((x, y, s, p) => (
    <G>
      <Path d={starPath(x, y, s + 1.5)} fill={p.primary} stroke={p.secondary} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={x - 2.5} cy={y - 2.5} r={1.6} fill={p.accent} />
    </G>
  )),
  'mood-charm-heart': charm((x, y, s, p) => (
    <G>
      <Path d={heartPath(x, y, s)} fill={p.primary} stroke={p.secondary} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={x - 3.5} cy={y - 2.5} r={1.7} fill={p.accent} />
    </G>
  )),
  'mood-charm-bolt': charm((x, y, s, p) => (
    <Path d={boltPath(x, y, s + 1)} fill={p.primary} stroke={p.secondary} strokeWidth={1.8} strokeLinejoin="round" />
  )),
  'mood-charm-planet': charm((x, y, s, p) => (
    <G>
      <Circle cx={x} cy={y} r={s * 0.75} fill={p.primary} stroke={p.secondary} strokeWidth={1.8} />
      <Ellipse cx={x} cy={y} rx={s * 1.3} ry={s * 0.38} fill="none" stroke={p.secondary} strokeWidth={1.8} transform={`rotate(-18 ${x} ${y})`} />
      <Circle cx={x - 2.2} cy={y - 2.4} r={1.4} fill={p.accent} />
    </G>
  )),
};

/** Icon crops (Cloudling anatomy) so wardrobe tiles reuse the worn artwork. */
export const FOCUS_CLUB_ICON_VIEWBOX: Record<string, string> = {
  'gummy-visor': '50 90 100 40',
  'cloud-cap': '40 42 120 70',
  'charm-harness': '54 142 92 32',
  'mood-charm-star': '80 148 40 36',
  'mood-charm-heart': '80 148 40 36',
  'mood-charm-bolt': '80 148 40 36',
  'mood-charm-planet': '80 148 40 36',
};
