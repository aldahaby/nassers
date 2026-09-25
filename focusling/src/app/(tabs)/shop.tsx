import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SHOP_CATEGORIES } from '@/config/shopCatalog';
import { getShopListings, type ShopCategory } from '@/core';
import { InventoryDevTools } from '@/features/shop/InventoryDevTools';
import { ItemCard } from '@/features/shop/ItemCard';
import { ItemDetailSheet } from '@/features/shop/ItemDetailSheet';
import { useCoins, useDebugToolsEnabled, useGameStore, usePetView } from '@/state';
import { AnimatedNumber, CoinIcon, Screen, colors, radius, shadow, spacing, typography } from '@/ui';

/** The shop: browse by category, tap an item for details. Nothing is bought from the grid. */
export default function ShopScreen() {
  const coins = useCoins();
  const view = usePetView();
  const inventory = useGameStore((s) => s.save?.inventory);
  const debug = useDebugToolsEnabled();
  const [category, setCategory] = useState<ShopCategory>('accessory');
  const [selected, setSelected] = useState<string | null>(null);

  const listings = useMemo(
    () => (inventory ? getShopListings(inventory).filter((l) => l.category === category) : []),
    [inventory, category],
  );
  const rows = useMemo(() => {
    const out: (typeof listings)[] = [];
    for (let i = 0; i < listings.length; i += 2) out.push(listings.slice(i, i + 2));
    return out;
  }, [listings]);

  if (!view) return null;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View>
          <Text style={typography.title}>Shop</Text>
          <Text style={styles.subtitle}>Treats and treasures for {view.pet.name}</Text>
        </View>
        <View style={[styles.balance, shadow]} accessible accessibilityLabel={`${coins} coins`}>
          <CoinIcon size={24} />
          <AnimatedNumber value={coins} style={styles.balanceValue} />
        </View>
      </View>

      <Pressable style={styles.inventoryLink} onPress={() => router.push('/inventory')} accessibilityRole="button">
        <Text style={styles.inventoryLabel}>🎒 My items</Text>
        <Text style={styles.inventoryChevron}>›</Text>
      </Pressable>

      <View style={styles.tabs} accessibilityRole="tablist">
        {SHOP_CATEGORIES.map((c) => {
          const active = c.id === category;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCategory(c.id)}
              style={[styles.tab, active && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.grid}>
        {rows.map((row) => (
          <View key={row[0]!.id} style={styles.row}>
            {row.map((listing) => (
              <ItemCard key={listing.id} listing={listing} affordable={coins >= listing.price} onPress={() => setSelected(listing.id)} />
            ))}
            {row.length === 1 && <View style={styles.spacer} />}
          </View>
        ))}
      </View>

      {debug && (
        <View style={styles.dev}>
          <Text style={styles.devTitle}>🛠 Developer tools</Text>
          <InventoryDevTools />
        </View>
      )}

      <ItemDetailSheet itemId={selected} onClose={() => setSelected(null)} onShowPet={() => router.navigate('/(tabs)')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  subtitle: { ...typography.label, fontWeight: '600' },
  balance: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  balanceValue: { fontSize: 24, fontWeight: '900', color: colors.coinDark, fontVariant: ['tabular-nums'] },
  inventoryLink: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  inventoryLabel: { fontSize: 16, fontWeight: '800', color: colors.primaryDark },
  inventoryChevron: { fontSize: 22, fontWeight: '900', color: colors.primaryDark },
  tabs: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, padding: 4 },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, alignItems: 'center' },
  tabActive: { backgroundColor: colors.surface },
  tabLabel: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  tabLabelActive: { color: colors.primaryDark },
  grid: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  spacer: { flex: 1 },
  dev: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  devTitle: { ...typography.label },
});
