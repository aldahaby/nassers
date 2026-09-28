import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ROOM_PRESETS } from '@/config/room';
import { hexToHsl, hslToHex, type Hsl } from '@/ui/color';
import { Pressable, TabIcon, colors, radius, spacing, typography } from '@/ui';
import { HslSlider } from './HslSlider';

interface Props {
  color: string;
  onChange: (hex: string) => void;
}

/**
 * Any colour, not six swatches: hue, saturation and lightness sliders plus
 * curated presets as shortcuts. Holds HSL locally so the hue survives when a
 * colour passes through grey, white or black.
 */
export function RoomColorPicker({ color, onChange }: Props) {
  const [hsl, setHsl] = useState<Hsl>(() => hexToHsl(color));
  const [lastHex, setLastHex] = useState(color);
  // Follow outside changes (preset, reset) without losing hue while dragging.
  if (color.toUpperCase() !== lastHex.toUpperCase()) {
    setLastHex(color);
    setHsl(hexToHsl(color));
  }
  const update = (patch: Partial<Hsl>) => {
    const next = { ...hsl, ...patch };
    const hex = hslToHex(next);
    setHsl(next);
    setLastHex(hex);
    onChange(hex);
  };
  const hueStops = [0, 60, 120, 180, 240, 300, 360].map((h) => hslToHex({ h, s: 80, l: 60 }));
  const satStops = [hslToHex({ ...hsl, s: 0 }), hslToHex({ ...hsl, s: 100 })];
  const lightStops = [hslToHex({ ...hsl, l: 4 }), hslToHex({ ...hsl, l: 50 }), hslToHex({ ...hsl, l: 97 })];

  return (
    <View style={styles.wrap}>
      <Text style={styles.section}>Presets</Text>
      <View style={styles.presets}>
        {ROOM_PRESETS.map((p) => {
          const on = p.color.toUpperCase() === color.toUpperCase();
          return (
            <Pressable
              key={p.id}
              sound="select"
              onPress={() => onChange(p.color)}
              style={styles.preset}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${p.name} room`}
            >
              <View style={[styles.swatch, { backgroundColor: p.color }, on && styles.swatchOn]}>{on && <TabIcon name="check" color={hexToHsl(p.color).l < 45 ? colors.white : colors.ink} size={16} />}</View>
              <Text style={styles.presetName} numberOfLines={1}>
                {p.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>Any colour</Text>
      <View style={styles.readout} accessible accessibilityLabel={`Current room colour ${color}`}>
        <View style={[styles.chip, { backgroundColor: color }]} />
        <Text style={styles.hex}>{color.toUpperCase()}</Text>
      </View>
      <SliderRow label="Hue">
        <HslSlider id="hue" label="Hue" value={hsl.h / 360} stops={hueStops} onChange={(v) => update({ h: v * 360 })} valueText={`${Math.round(hsl.h)} degrees`} />
      </SliderRow>
      <SliderRow label="Colour">
        <HslSlider id="sat" label="Colour strength" value={hsl.s / 100} stops={satStops} onChange={(v) => update({ s: v * 100 })} valueText={`${Math.round(hsl.s)} percent`} />
      </SliderRow>
      <SliderRow label="Light">
        <HslSlider id="light" label="Lightness" value={hsl.l / 100} stops={lightStops} onChange={(v) => update({ l: v * 100 })} valueText={`${Math.round(hsl.l)} percent`} />
      </SliderRow>
    </View>
  );
}

function SliderRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowSlider}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  section: { ...typography.label, textTransform: 'uppercase', letterSpacing: 0.8 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  preset: { width: '25%', minWidth: 64, alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 4 },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' },
  swatchOn: { borderColor: colors.ink, borderWidth: 3 },
  presetName: { fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' },
  readout: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chip: { width: 28, height: 28, borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  hex: { ...typography.body, fontWeight: '800', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowLabel: { width: 52, ...typography.label },
  rowSlider: { flex: 1 },
});
