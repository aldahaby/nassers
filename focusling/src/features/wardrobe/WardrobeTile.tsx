import { StyleSheet, Text, View } from 'react-native';
import type { WardrobeEntry } from '@/core';
import { CoinIcon, ItemArt, TabIcon, colors, radius, spacing, Pressable } from '@/ui';
import { describeProgress, tileLabel } from './cosmeticCopy';

interface Props {
  entry: WardrobeEntry;
  isNew: boolean;
  trying: boolean;
  onPress: () => void;
}

/** One collectible. State is shown by icon + text, never colour alone. */
export function WardrobeTile({ entry, isNew, trying, onPress }: Props) {
  const { item, state, progress } = entry;
  const locked = state === 'earnable' || state === 'buyable';
  const ratio = progress ? progress.current / Math.max(1, progress.target) : 0;

  return (
    <Pressable
      onPress={onPress}
      // Wearing a piece "lands" it on the pet; taking it off is a soft pup; trying on is a select.
      sound={state === 'owned' ? 'equip' : state === 'equipped' ? 'back' : 'select'}
      accessibilityRole="button"
      accessibilityState={{ selected: state === 'equipped' || trying }}
      accessibilityLabel={tileLabel(item, state, progress)}
      style={({ pressed }) => [styles.tile, state === 'equipped' && styles.equipped, trying && styles.trying, pressed && styles.pressed]}
    >
      <View style={[styles.art, locked && styles.artLocked]}>
        <ItemArt itemId={item.id} size={56} />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.colorway} numberOfLines={1}>
        {item.colorway ?? ' '}
      </Text>
      <View style={styles.status}>
        {state === 'equipped' && (
          <>
            <TabIcon name="check" color={colors.success} size={14} />
            <Text style={[styles.statusText, styles.wearing]}>Wearing</Text>
          </>
        )}
        {state === 'owned' && <Text style={styles.statusText}>Tap to wear</Text>}
        {state === 'buyable' && (
          <>
            <CoinIcon size={13} />
            <Text style={styles.statusText}>{item.price}</Text>
          </>
        )}
        {state === 'earnable' && item.unlock && progress && (
          <>
            <TabIcon name="lock" color={colors.textMuted} size={13} />
            <Text style={styles.statusText} numberOfLines={1}>
              {describeProgress(item.unlock, progress)}
            </Text>
          </>
        )}
      </View>
      {state === 'earnable' && (
        <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
        </View>
      )}
      {isNew && (
        <View style={styles.newBadge}>
          <Text style={styles.newText}>NEW</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 150,
  },
  equipped: { borderColor: colors.success, backgroundColor: colors.successSoft },
  trying: { borderColor: colors.primary, borderStyle: 'dashed' },
  pressed: { transform: [{ scale: 0.97 }] },
  art: { width: 68, height: 68, borderRadius: radius.md, backgroundColor: colors.stageGlow, alignItems: 'center', justifyContent: 'center' },
  artLocked: { opacity: 0.55 },
  name: { marginTop: spacing.sm, fontSize: 13, fontWeight: '800', color: colors.text, textAlign: 'center' },
  colorway: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, minHeight: 18 },
  statusText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  wearing: { color: colors.success },
  track: { alignSelf: 'stretch', marginHorizontal: spacing.sm, marginTop: 4, height: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
  newBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  newText: { color: colors.white, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
});
