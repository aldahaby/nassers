import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { DecorationSlot, EquipSlot } from '@/core';
import { colors, radius } from '@/ui/theme';
import { DECORATION_ART } from './decorations';

interface Props {
  equipped: Partial<Record<EquipSlot, string>>;
  height: number;
  children: ReactNode;
}

const DECOR_SLOTS: readonly DecorationSlot[] = ['wall', 'floorLeft', 'floorRight'];

/** The pet's room: wall, window, floor and any placed decorations, with the pet on top. */
export function RoomScene({ equipped, height, children }: Props) {
  return (
    <View style={[styles.room, { height }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 360 300" preserveAspectRatio="xMidYMax slice">
        <Rect x={0} y={0} width={360} height={300} fill={colors.roomWall} />
        {/* Window with a soft sky. */}
        <G>
          <Rect x={132} y={70} width={96} height={76} rx={14} fill="#CFE8FF" />
          <Circle cx={206} cy={92} r={10} fill="#FFF1B8" />
          <Path d="M146 128 C154 118 168 118 174 126 C182 120 196 124 196 134 L146 134 Z" fill="#FFFFFF" />
          <Rect x={132} y={70} width={96} height={76} rx={14} fill="none" stroke="#F4D2AE" strokeWidth={6} />
          <Rect x={177} y={70} width={6} height={76} fill="#F4D2AE" />
        </G>
        <Rect x={0} y={228} width={360} height={72} fill={colors.roomFloor} />
        <Rect x={0} y={224} width={360} height={8} fill={colors.roomFloorShade} />
        {DECOR_SLOTS.map((slot) => {
          const id = equipped[slot];
          const art = id ? DECORATION_ART[id] : undefined;
          return art ? <G key={slot}>{art()}</G> : null;
        })}
      </Svg>
      <View style={styles.stage}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  room: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.roomWall },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 12 },
});
