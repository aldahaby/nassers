import { useId, useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '@/ui';

interface Props {
  label: string;
  /** 0–1 */
  value: number;
  /** Track colour stops, left to right. */
  stops: readonly string[];
  onChange: (value: number) => void;
  /** Called once when a drag ends (e.g. to commit or give one quiet cue). */
  onRelease?: () => void;
  /** Screen-reader value text, e.g. "Hue 210 degrees". */
  valueText: string;
  id: string;
}

const HEIGHT = 44;
const TRACK = 22;
const THUMB = 30;
const STEP = 0.02;

/**
 * A friendly colour slider: drag anywhere on the gradient track. Continuous
 * drags are silent (no per-pixel sounds). Screen readers get an adjustable
 * control with increment/decrement actions.
 */
export function HslSlider({ label, value, stops, onChange, onRelease, valueText, id }: Props) {
  const [width, setWidth] = useState(0);
  const gid = `hsl-${id}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const start = useRef({ pageX: 0, value: 0 });
  const clamp = (n: number) => Math.min(1, Math.max(0, n));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const grant = (e: GestureResponderEvent) => {
    const v = clamp((e.nativeEvent.locationX - THUMB / 2) / Math.max(1, width - THUMB));
    start.current = { pageX: e.nativeEvent.pageX, value: v };
    onChange(v);
  };
  const move = (e: GestureResponderEvent) => {
    const dx = e.nativeEvent.pageX - start.current.pageX;
    onChange(clamp(start.current.value + dx / Math.max(1, width - THUMB)));
  };

  return (
    <View
      style={styles.wrap}
      onLayout={onLayout}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={grant}
      onResponderMove={move}
      onResponderRelease={() => onRelease?.()}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        onChange(clamp(value + (e.nativeEvent.actionName === 'increment' ? STEP * 2.5 : -STEP * 2.5)));
        onRelease?.();
      }}
    >
      {width > 0 && (
        <View style={[styles.track, { left: THUMB / 2 - TRACK / 2, right: THUMB / 2 - TRACK / 2 }]} pointerEvents="none">
          <Svg width="100%" height={TRACK}>
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
                {stops.map((c, i) => (
                  <Stop key={i} offset={i / Math.max(1, stops.length - 1)} stopColor={c} />
                ))}
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height={TRACK} rx={TRACK / 2} fill={`url(#${gid})`} />
          </Svg>
        </View>
      )}
      <View pointerEvents="none" style={[styles.thumb, { left: value * Math.max(0, width - THUMB) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: HEIGHT, justifyContent: 'center' },
  track: { position: 'absolute', height: TRACK, borderRadius: TRACK / 2, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.ink,
    top: (HEIGHT - THUMB) / 2,
  },
});
