import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ShopListing } from '@/core';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { useGameStore } from '@/state';
import { ItemArt, TabIcon, colors, radius, shadow, spacing } from '@/ui';

interface Props {
  /** Owned toys and food, for one-tap use. */
  quickItems: ShopListing[];
  onUse: (listing: ShopListing) => void;
}

/**
 * A slim row under the pet: "Items" opens the inventory; owned toys and snacks
 * can be used with a single tap. Nudges to the shop while nothing is owned.
 */
export function ItemsBar({ quickItems, onUse }: Props) {
  const routes = useAppRoutes();
  const newCount = useGameStore((s) => s.save?.cosmetics.newItemIds.length ?? 0);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Pressable
        style={[styles.pill, styles.wardrobePill, shadow]}
        onPress={() => router.push('/wardrobe')}
        accessibilityRole="button"
        accessibilityLabel={newCount > 0 ? `Wardrobe, ${newCount} new` : 'Wardrobe'}
      >
        <TabIcon name="wardrobe" color={colors.white} size={20} />
        <Text style={[styles.pillLabel, styles.wardrobeLabel]}>Wardrobe</Text>
        {newCount > 0 && (
          <View style={styles.newDot}>
            <Text style={styles.newDotText}>{newCount}</Text>
          </View>
        )}
      </Pressable>
      <Pressable style={[styles.pill, shadow]} onPress={() => router.push('/inventory')} accessibilityRole="button" accessibilityLabel="Items: toys, snacks and room">
        <TabIcon name="bag" color={colors.primaryDark} size={20} />
        <Text style={styles.pillLabel}>Items</Text>
      </Pressable>
      {quickItems.length === 0 ? (
        <Pressable style={[styles.pill, styles.shopPill]} onPress={() => router.navigate(routes.shop)} accessibilityRole="button">
          <Text style={styles.shopLabel}>Visit the shop ›</Text>
        </Pressable>
      ) : (
        quickItems.map((listing) => (
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
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, alignItems: 'center', paddingVertical: 4, paddingHorizontal: 2 },
  pill: { height: 48, borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 6 },
  wardrobePill: { backgroundColor: colors.ink },
  wardrobeLabel: { color: colors.white },
  newDot: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.coin, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  newDotText: { fontSize: 11, fontWeight: '900', color: colors.ink },
  pillLabel: { fontSize: 15, fontWeight: '800', color: colors.primaryDark },
  shopPill: { backgroundColor: colors.primarySoft },
  shopLabel: { fontSize: 14, fontWeight: '800', color: colors.primaryDark },
  quick: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  qty: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  qtyLabel: { color: colors.white, fontSize: 11, fontWeight: '900' },
});
