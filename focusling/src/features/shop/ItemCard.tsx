import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ShopListing } from '@/core';
import { CoinIcon, ItemArt, colors, radius, shadow, spacing } from '@/ui';

interface Props {
  listing: ShopListing;
  affordable: boolean;
  onPress: () => void;
}

/** A shop grid tile: art, name, and either the price or what you already have. */
export function ItemCard({ listing, affordable, onPress }: Props) {
  const status = listing.equipped
    ? listing.category === 'decoration'
      ? 'Placed'
      : 'Wearing'
    : listing.owned && !listing.consumable
      ? 'Owned'
      : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, shadow, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${listing.name}, ${status ?? `${listing.price} coins`}${listing.consumable && listing.owned ? `, you have ${listing.quantity}` : ''}`}
      accessibilityHint="Opens item details"
    >
      <View style={[styles.art, listing.equipped && styles.artEquipped]}>
        <ItemArt itemId={listing.id} size={72} />
        {listing.consumable && listing.owned && (
          <View style={styles.qty}>
            <Text style={styles.qtyLabel}>×{listing.quantity}</Text>
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {listing.name}
      </Text>
      {status ? (
        <View style={[styles.badge, listing.equipped ? styles.badgeEquipped : styles.badgeOwned]}>
          <Text style={[styles.badgeLabel, listing.equipped && styles.badgeLabelEquipped]}>✓ {status}</Text>
        </View>
      ) : (
        <View style={[styles.price, !affordable && styles.priceShort]}>
          <CoinIcon size={16} />
          <Text style={[styles.priceLabel, !affordable && styles.priceLabelShort]}>{listing.price}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', gap: spacing.sm },
  pressed: { transform: [{ scale: 0.97 }] },
  art: { width: '100%', aspectRatio: 1.25, borderRadius: radius.md, backgroundColor: colors.roomWall, alignItems: 'center', justifyContent: 'center' },
  artEquipped: { backgroundColor: colors.primarySoft },
  qty: { position: 'absolute', top: 6, right: 6, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1 },
  qtyLabel: { color: colors.white, fontWeight: '900', fontSize: 12 },
  name: { fontSize: 15, fontWeight: '800', color: colors.text },
  price: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF1C9', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  priceShort: { backgroundColor: colors.surfaceMuted },
  priceLabel: { fontSize: 15, fontWeight: '900', color: colors.coinDark, fontVariant: ['tabular-nums'] },
  priceLabelShort: { color: colors.textMuted },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  badgeOwned: { backgroundColor: '#E3F9EC' },
  badgeEquipped: { backgroundColor: colors.primary },
  badgeLabel: { fontSize: 13, fontWeight: '800', color: '#2E9E62' },
  badgeLabelEquipped: { color: colors.white },
});
