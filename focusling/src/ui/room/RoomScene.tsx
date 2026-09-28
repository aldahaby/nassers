import { useId, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { DecorationSlot, EquipSlot } from '@/core';
import { radius } from '@/ui/theme';
import { DECORATION_ART } from './decorations';
import { roomPalette } from './roomPalette';

interface Props {
  equipped: Partial<Record<EquipSlot, string>>;
  height: number;
  /** The user's room colour (null/undefined = the default Focusling room). */
  roomColor?: string | null;
  /** Optional control pinned to the room's top-right corner (e.g. the Room Studio entry). */
  corner?: ReactNode;
  children: ReactNode;
}

/** Back-to-front draw order: the rug lies under everything standing on the floor. */
const DECOR_SLOTS: readonly DecorationSlot[] = ['wall', 'floorCenter', 'floorLeft', 'floorRight'];

/**
 * The pet's room: wall, window, floor and any placed decorations, with the pet
 * on top. Colours come from `roomPalette` (one chosen colour → a designed room).
 * Hierarchy: pet first, then outfit, then room, then decorations, so the room
 * stays quiet: flat shapes, one soft wall-to-floor shade, a halo behind the pet.
 */
export function RoomScene({ equipped, height, roomColor, corner, children }: Props) {
  const p = roomPalette(roomColor);
  const sc = useId().replace(/[^a-zA-Z0-9]/g, '');
  const night = p.tone === 'dark';
  return (
    <View style={[styles.room, { height, backgroundColor: p.wall }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 360 300" preserveAspectRatio="xMidYMax slice">
        <Defs>
          <LinearGradient id={`room-depth${sc}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={p.shadow} stopOpacity={0} />
            <Stop offset="1" stopColor={p.shadow} stopOpacity={night ? 0.28 : 0.1} />
          </LinearGradient>
          <RadialGradient id={`room-halo${sc}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={p.halo} stopOpacity={p.haloOpacity} />
            <Stop offset="1" stopColor={p.halo} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={360} height={300} fill={p.wall} />
        {/* Soft shade where the wall meets the floor: a hint of depth, not 3D. */}
        <Rect x={0} y={170} width={360} height={56} fill={`url(#room-depth${sc})`} />
        {/* Window: day sky in light rooms, a calm night sky in dark ones (static). */}
        <G>
          <Rect x={132} y={70} width={96} height={76} rx={14} fill={p.sky} />
          {night ? (
            <G>
              <Path d="M210 84 A10 10 0 1 0 210 104 A12.5 12.5 0 0 1 210 84 Z" fill="#FFF1B8" />
              <Circle cx={150} cy={88} r={1.6} fill="#FFFFFF" />
              <Circle cx={166} cy={112} r={1.2} fill="#FFFFFF" opacity={0.8} />
              <Circle cx={196} cy={124} r={1.4} fill="#FFFFFF" opacity={0.7} />
            </G>
          ) : (
            <G>
              <Circle cx={206} cy={92} r={10} fill="#FFF1B8" />
              <Path d="M146 128 C154 118 168 118 174 126 C182 120 196 124 196 134 L146 134 Z" fill="#FFFFFF" />
            </G>
          )}
          <Rect x={132} y={70} width={96} height={76} rx={14} fill="none" stroke={p.trim} strokeWidth={6} />
          <Rect x={177} y={70} width={6} height={76} fill={p.trim} />
          <Rect x={126} y={146} width={108} height={6} rx={3} fill={p.trim} />
        </G>
        {/* Halo behind the pet: keeps it separate from any wall colour. */}
        <Ellipse cx={180} cy={196} rx={112} ry={92} fill={`url(#room-halo${sc})`} />
        <Rect x={0} y={228} width={360} height={72} fill={p.floor} />
        <Rect x={0} y={224} width={360} height={8} fill={p.floorEdge} />
        {/* A soft pool of light where the pet stands, so it reads as the centre of the room. */}
        <Ellipse cx={180} cy={262} rx={120} ry={26} fill={p.spotlight} opacity={p.spotlightOpacity} />
        {DECOR_SLOTS.map((slot) => {
          const id = equipped[slot];
          const art = id ? DECORATION_ART[id] : undefined;
          return art ? <G key={slot}>{art()}</G> : null;
        })}
      </Svg>
      <View style={styles.stage}>{children}</View>
      {corner ? <View style={styles.corner}>{corner}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  room: { borderRadius: radius.lg, overflow: 'hidden' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 12 },
  corner: { position: 'absolute', top: 10, right: 10 },
});
