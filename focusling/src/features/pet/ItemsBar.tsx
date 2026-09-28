import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ShopListing } from '@/core';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { useGameStore } from '@/state';
import { ItemArt, TabIcon, colors, radius, shadow, spacing, type TabIconName, Pressable } from '@/ui';

interface Props {
  /** Owned toys and food, for one-tap use. */
  quickItems: ShopListing[];
  onUse: (listing: ShopListing) => void;
}

/**
 * Customisation actions under the pet. Wardrobe is the primary entry; Items and
 * Shop are compact secondary buttons (icon over label, so nothing clips at
 * 320 pt). Owned toys and snacks sit on their own one-tap row.
 */
export function ItemsBar({ quickItems, onUse }: Props) {
  const routes = useAppRoutes();
  const newCount = useGameStore((s) => s.save?.cosmetics.newItemIds.length ?? 0);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.wardrobe, shadow, pressed && styles.pressed]}
          onPress={() => router.push('/wardrobe')}
          accessibilityRole="button"
          accessibilityLabel={newCount > 0 ? `Wardrobe, ${newCount} new` : 'Wardrobe'}
        >
          <TabIcon name="wardrobe" color={colors.white} size={22} />
          <Text style={styles.wardrobeLabel} numberOfLines={1}>
            Wardrobe
          </Text>
          {newCount > 0 && (
            <View style={styles.newDot}>
              <Text style={styles.newDotText}>{newCount}</Text>
            </View>
          )}
        </Pressable>
        <SmallAction icon="bag" label="Items" a11y="Items: toys, snacks and room" onPress={() => router.push('/inventory')} />
        <SmallAction icon="shop" label="Shop" a11y="Shop" onPress={() => router.navigate(routes.shop)} />
      </View>
      {quickItems.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
          {quickItems.map((listing) => (
            <Pressable
              key={listing.id}
              style={[styles.quick, shadow]}
              onPress={() => onUse(listing)}
              accessibilityRole="button"
              accessibilityLabel={`${listing.category === 'food' ? 'Feed' : 'Play with'} ${listing.name}`}
            >
              <ItemArt itemId={listing.id} size={34} />
              {listing.consumable && (
                <View style={styles.qty}>
                  <Text style={styles.qtyLabel}>{listing.quantity}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function SmallAction({ icon, label, a11y, onPress }: { icon: TabIconName; label: string; a11y: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.small, shadow, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y}>
      <TabIcon name={icon} color={colors.primaryDark} size={20} />
      <Text style={styles.smallLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: 6, alignItems: 'stretch' },
  wardrobe: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  wardrobeLabel: { fontSize: 16, fontWeight: '800', color: colors.white, flexShrink: 1 },
  pressed: { opacity: 0.85 },
  newDot: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.coin, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  newDotText: { fontSize: 11, fontWeight: '900', color: colors.ink },
  small: { width: 56, minHeight: 56, borderRadius: radius.lg, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 2 },
  smallLabel: { fontSize: 12, fontWeight: '800', color: colors.primaryDark },
  quickRow: { gap: spacing.sm, alignItems: 'center', paddingVertical: 2, paddingHorizontal: 2 },
  quick: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  qty: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  qtyLabel: { color: colors.white, fontSize: 11, fontWeight: '900' },
});
