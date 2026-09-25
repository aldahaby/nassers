import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SHOP_CATEGORIES, getShopItem, type CatalogItem } from '@/config/shopCatalog';
import { getOwnedListings, toyCooldownRemainingMs, type ShopCategory } from '@/core';
import { OwnedItemRow, type RowAction } from '@/features/inventory/OwnedItemRow';
import { usePetSpeech } from '@/features/inventory/usePetSpeech';
import { PetReactionStage } from '@/features/pet/PetReactionStage';
import { ownedStatus } from '@/features/shop/itemCopy';
import { ItemDetailSheet } from '@/features/shop/ItemDetailSheet';
import { useNow } from '@/hooks/useNow';
import { useEquipped, useGameStore, usePetView } from '@/state';
import { Button, Card, RoomScene, Screen, SpeechBubble, colors, radius, spacing, typography } from '@/ui';

const EMPTY_COPY: Record<ShopCategory, string> = {
  accessory: 'No accessories yet.',
  toy: 'No toys yet.',
  food: 'No snacks right now.',
  decoration: 'No room decorations yet.',
};

/** Everything the player owns, with equip / use actions and a live pet preview. */
export default function InventoryScreen() {
  const view = usePetView();
  const equipped = useEquipped();
  const save = useGameStore((s) => s.save);
  const reaction = useGameStore((s) => s.petReaction);
  const { equip, unequipItem, play, feed, consumePetReaction } = useGameStore.getState();
  const { bubble, sayForReaction } = usePetSpeech();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<string | null>(null);
  const now = useNow(30_000);

  if (!view || !save) return null;
  const { pet, progression, mood } = view;
  const owned = getOwnedListings(save.inventory);
  const petSize = Math.min(150, width * 0.36);

  const actionsFor = (item: CatalogItem, isEquipped: boolean): RowAction[] => {
    switch (item.category) {
      case 'accessory':
        return isEquipped
          ? [{ label: 'Take off', onPress: () => unequipItem(item.id), tone: 'quiet' }]
          : [{ label: 'Wear', onPress: () => equip(item.id, { showOnPet: true }) }];
      case 'decoration':
        return isEquipped
          ? [{ label: 'Remove', onPress: () => unequipItem(item.id), tone: 'quiet' }]
          : [{ label: 'Place', onPress: () => equip(item.id, { showOnPet: true }) }];
      case 'toy':
        return [{ label: 'Play', onPress: () => play(item.id) }];
      case 'food':
        return [{ label: 'Feed', onPress: () => feed(item.id) }];
    }
  };

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>{pet.name}&apos;s things</Text>
        <View style={styles.headerSpacer} />
      </View>

      <RoomScene equipped={equipped} height={petSize * 1.45}>
        <SpeechBubble text={bubble} />
        <PetReactionStage
          speciesId={pet.speciesId}
          stage={progression.stage}
          mood={mood}
          equipped={equipped}
          size={petSize}
          reaction={reaction}
          onReactionStart={(r) => {
            consumePetReaction();
            sayForReaction(r);
          }}
          accessibilityLabel={pet.name}
        />
      </RoomScene>

      {/* Only the list scrolls, so the pet stays in view while you use items. */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {owned.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyBody}>Focus to earn coins, then pick out a first gift for {pet.name}.</Text>
            <Button label="Visit the Shop" onPress={() => router.navigate('/(tabs)/shop')} />
          </Card>
        ) : (
          SHOP_CATEGORIES.map((category) => {
            const items = owned.filter((l) => l.category === category.id);
            return (
              <View key={category.id} style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {category.label} <Text style={styles.count}>{items.length}</Text>
                </Text>
                {items.length === 0 ? (
                  <Pressable onPress={() => router.navigate('/(tabs)/shop')} style={styles.sectionEmpty} accessibilityRole="button">
                    <Text style={styles.sectionEmptyText}>{EMPTY_COPY[category.id]} Find some in the Shop ›</Text>
                  </Pressable>
                ) : (
                  items.map((listing) => {
                    const item = getShopItem(listing.id)!;
                    const cooldownMs = item.category === 'toy' ? toyCooldownRemainingMs(save, item.id, now) : 0;
                    return (
                      <OwnedItemRow
                        key={item.id}
                        item={item}
                        highlighted={listing.equipped}
                        status={ownedStatus(item, { equipped: listing.equipped, quantity: listing.quantity, cooldownMs })}
                        actions={actionsFor(item, listing.equipped)}
                        onOpen={() => setSelected(item.id)}
                      />
                    );
                  })
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <ItemDetailSheet itemId={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  list: { flex: 1, marginHorizontal: -spacing.lg },
  listContent: { gap: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 17, fontWeight: '800', color: colors.primaryDark, minWidth: 64 },
  title: { ...typography.heading, textAlign: 'center', flex: 1 },
  headerSpacer: { minWidth: 64 },
  empty: { alignItems: 'center' },
  emptyTitle: { ...typography.heading },
  emptyBody: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.heading, fontSize: 18 },
  count: { color: colors.textMuted, fontSize: 15 },
  sectionEmpty: { borderRadius: radius.md, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, padding: spacing.md },
  sectionEmptyText: { ...typography.label, fontWeight: '600' },
});
