import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/ui/theme';

/** A small four-point sparkle: Focusling's Premium glyph (original). */
export function PremiumGlyph({ size = 12, color = '#7A5CE0' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M6 0.6 L7.3 4.7 L11.4 6 L7.3 7.3 L6 11.4 L4.7 7.3 L0.6 6 L4.7 4.7 Z" fill={color} />
    </Svg>
  );
}

/**
 * The one consistent Premium marker: glyph + word (never colour alone).
 * `compact` shows just the glyph and "Premium" in small type for tiles.
 */
export function PremiumMark({ label = 'Premium', compact = false }: { label?: string; compact?: boolean }) {
  return (
    <View style={[styles.mark, compact && styles.compact]} accessible accessibilityLabel={label}>
      <PremiumGlyph size={compact ? 10 : 12} />
      <Text style={[styles.text, compact && styles.textCompact]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#F0EBFF' },
  compact: { paddingHorizontal: 6, paddingVertical: 2 },
  text: { fontSize: 12, fontWeight: '800', color: '#5A3FC0', letterSpacing: 0.2 },
  textCompact: { fontSize: 10 },
});

export const premiumColors = { ink: '#5A3FC0', soft: '#F0EBFF', deep: '#1E2150', glow: colors.primarySoft };
