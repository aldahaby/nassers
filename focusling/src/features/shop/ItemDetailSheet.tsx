import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { getShopItem, type CatalogItem } from '@/config/shopCatalog';
import { estimateSessionsToAfford, toyCooldownRemainingMs, AFFORD_HINT_SESSION_MINUTES } from '@/core';
import { useNow } from '@/hooks/useNow';
import { useCoins, useEquipped, useGameStore, usePetView } from '@/state';
import {
  AnimatedNumber,
  Button,
  CoinIcon,
  Confetti,
  ItemArt,
  PetArt,
  RoomScene,
  colors,
  radius,
  shadow,
  spacing,
  typography,
  useNativeDriver,
} from '@/ui';
import { plural } from '@/utils/format';
import { BONUS_CAP_NOTE, itemEffects, itemKindLabel, ownedStatus } from './itemCopy';

interface Props {
  itemId: string | null;
  onClose: () => void;
  /** Called after an action whose reaction plays on the pet screen (shop only). */
  onShowPet?: () => void;
}

type Phase = { kind: 'details' } | { kind: 'purchased'; firstPurchase: boolean; spent: number };

/**
 * Item details and purchase. Nothing is bought until the player taps the buy
 * button here; afterwards the sheet offers to wear/place/use the item right away.
 */
export function ItemDetailSheet({ itemId, onClose, onShowPet }: Props) {
  const item = itemId ? getShopItem(itemId) : undefined;
  return (
    <Modal visible={Boolean(item)} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close item details" />
      {item && <SheetBody key={item.id} item={item} onClose={onClose} onShowPet={onShowPet} />}
    </Modal>
  );
}

function SheetBody({ item, onClose, onShowPet }: { item: CatalogItem; onClose: () => void; onShowPet?: () => void }) {
  const view = usePetView();
  const coins = useCoins();
  const equipped = useEquipped();
  const save = useGameStore((s) => s.save);
  const { purchase, equip, unequipItem, play, feed } = useGameStore.getState();
  const { height } = useWindowDimensions();
  const [phase, setPhase] = useState<Phase>({ kind: 'details' });
  const [error, setError] = useState<string | null>(null);
  const now = useNow(30_000);

  if (!view || !save) return null;
  const { pet, progression } = view;
  const owned = save.inventory.items[item.id];
  const quantity = owned?.quantity ?? 0;
  const isOwned = quantity > 0;
  const isEquipped = item.equipSlot !== undefined && equipped[item.equipSlot] === item.id;
  const replaces = item.equipSlot && equipped[item.equipSlot] && !isEquipped ? getShopItem(equipped[item.equipSlot]!) : undefined;
  const canBuy = item.consumable || !isOwned;
  const affordable = coins >= item.price;
  const sessions = estimateSessionsToAfford(save, item.price, now);
  const cooldownMs = item.category === 'toy' ? toyCooldownRemainingMs(save, item.id, now) : 0;

  const buy = () => {
    const result = purchase(item.id);
    if (!result.ok) {
      setError(result.error === 'insufficient-coins' ? 'Not enough coins yet.' : 'That item could not be bought.');
      return;
    }
    setError(null);
    setPhase({ kind: 'purchased', firstPurchase: result.value.firstPurchase, spent: item.price });
  };

  /** Wear / place / play / feed, then show the pet's reaction. */
  const use = () => {
    if (item.equipSlot) equip(item.id, { showOnPet: true });
    else if (item.category === 'toy') play(item.id);
    else if (item.category === 'food') feed(item.id);
    onClose();
    onShowPet?.();
  };

  const useLabel =
    item.category === 'accessory'
      ? `Put it on ${pet.name}`
      : item.category === 'decoration'
        ? 'Place it in the room'
        : item.category === 'toy'
          ? `Play with ${pet.name}`
          : `Feed ${pet.name}`;

  return (
    <View style={[styles.sheet, shadow, { maxHeight: height * 0.92 }]} accessibilityViewIsModal>
      <View style={styles.handle} />
      <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
        <Text style={styles.closeLabel}>✕</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {phase.kind === 'purchased' ? (
          <Purchased item={item} petName={pet.name} phase={phase} coins={coins} />
        ) : (
          <>
            <Preview item={item} speciesId={pet.speciesId} stage={progression.stage} mood={view.mood} equipped={equipped} />
            <View style={styles.titleBlock}>
              <Text style={styles.name}>{item.name}</Text>
              <View style={styles.tag}>
                <Text style={styles.tagLabel}>{itemKindLabel(item)}</Text>
              </View>
              <Text style={styles.description}>{item.description}</Text>
            </View>
            <View style={styles.effects}>
              {itemEffects(item, pet.name).map((line) => (
                <Text key={line} style={styles.effect}>
                  • {line}
                </Text>
              ))}
              {replaces && <Text style={styles.effect}>• Replaces {replaces.name} in the same spot</Text>}
              {item.passiveBonus && <Text style={styles.footnote}>{BONUS_CAP_NOTE}</Text>}
            </View>
            {isOwned && (
              <Text style={styles.owned}>
                ✓ Owned · {ownedStatus(item, { equipped: isEquipped, quantity, cooldownMs })}
              </Text>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {error && <Text style={styles.error}>{error}</Text>}
        {phase.kind === 'purchased' ? (
          <>
            <Button label={useLabel} onPress={use} />
            <Button label="Keep shopping" variant="ghost" onPress={onClose} />
          </>
        ) : (
          <>
            {isOwned && item.equipSlot && (
              <Button
                label={isEquipped ? (item.category === 'accessory' ? 'Take it off' : 'Remove from room') : useLabel}
                variant={isEquipped ? 'secondary' : 'primary'}
                onPress={isEquipped ? () => unequipItem(item.id) : use}
              />
            )}
            {isOwned && !item.equipSlot && <Button label={useLabel} onPress={use} />}
            {canBuy && (
              <>
                <View style={styles.priceRow}>
                  <View style={styles.priceTag}>
                    <CoinIcon size={20} />
                    <Text style={styles.price}>{item.price}</Text>
                  </View>
                  <Text style={styles.balance}>You have {plural(coins, 'coin')}</Text>
                </View>
                <Button
                  label={
                    affordable
                      ? `${isOwned ? 'Buy another' : 'Buy'} for ${item.price} coins`
                      : `Need ${plural(item.price - coins, 'more coin', 'more coins')}`
                  }
                  variant={isOwned ? 'secondary' : 'primary'}
                  onPress={buy}
                  disabled={!affordable}
                  accessibilityHint={affordable ? undefined : 'You need more coins to buy this item'}
                />
                {!affordable && (
                  <Text style={styles.hint}>
                    About {plural(sessions, `more ${AFFORD_HINT_SESSION_MINUTES}-minute focus session`, `more ${AFFORD_HINT_SESSION_MINUTES}-minute focus sessions`)}
                  </Text>
                )}
              </>
            )}
          </>
        )}
      </View>
      {phase.kind === 'purchased' && phase.firstPurchase && <Confetti count={24} />}
    </View>
  );
}

/** What the item looks like on this pet, before buying. */
function Preview({
  item,
  speciesId,
  stage,
  mood,
  equipped,
}: {
  item: CatalogItem;
  speciesId: Parameters<typeof PetArt>[0]['speciesId'];
  stage: Parameters<typeof PetArt>[0]['stage'];
  mood: Parameters<typeof PetArt>[0]['mood'];
  equipped: Record<string, string | undefined>;
}) {
  if (item.category === 'accessory' && item.equipSlot) {
    return (
      <View style={styles.previewCircle}>
        <PetArt speciesId={speciesId} stage={stage} mood="joyful" equipped={{ ...equipped, [item.equipSlot]: item.id }} size={170} />
      </View>
    );
  }
  if (item.category === 'decoration' && item.equipSlot) {
    const room = { ...equipped, [item.equipSlot]: item.id };
    return (
      <View style={styles.roomPreview}>
        <RoomScene equipped={room} height={170}>
          <PetArt speciesId={speciesId} stage={stage} mood={mood} equipped={equipped} size={96} />
        </RoomScene>
      </View>
    );
  }
  return (
    <View style={styles.previewCircle}>
      <ItemArt itemId={item.id} size={120} />
    </View>
  );
}

/** Post-purchase moment: the item pops in, the balance ticks down. */
function Purchased({ item, petName, phase, coins }: { item: CatalogItem; petName: string; phase: Extract<Phase, { kind: 'purchased' }>; coins: number }) {
  const [pop] = useState(() => new Animated.Value(0));
  const [float] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 140, useNativeDriver }).start();
    Animated.timing(float, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver }).start();
  }, [pop, float]);

  return (
    <View style={styles.purchased}>
      <View>
        <Animated.View style={[styles.previewCircle, styles.purchasedArt, { transform: [{ scale: pop }] }]}>
          <ItemArt itemId={item.id} size={110} />
        </Animated.View>
        <Animated.Text
          style={[
            styles.spent,
            {
              opacity: float.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
              transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) }],
            },
          ]}
        >
          −{phase.spent}
        </Animated.Text>
      </View>
      <Text style={styles.name}>{phase.firstPurchase ? `Your focus paid for ${petName}'s first gift!` : `${item.name} is yours!`}</Text>
      <Text style={styles.description}>
        {phase.firstPurchase ? `${item.name}, earned with real focus time.` : 'Bought with coins from your focus sessions.'}
      </Text>
      <View style={styles.priceTag}>
        <CoinIcon size={22} />
        <AnimatedNumber value={coins} style={styles.price} />
        <Text style={styles.balance}> left</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(47, 37, 72, 0.35)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.sm,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: radius.pill, backgroundColor: colors.border },
  close: { position: 'absolute', right: spacing.md, top: spacing.md, width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, zIndex: 2 },
  closeLabel: { fontSize: 16, fontWeight: '900', color: colors.textMuted },
  content: { padding: spacing.xl, paddingBottom: spacing.md, gap: spacing.md, alignItems: 'stretch' },
  previewCircle: { alignSelf: 'center', width: 190, height: 190, borderRadius: radius.pill, backgroundColor: colors.roomWall, alignItems: 'center', justifyContent: 'center' },
  roomPreview: { alignSelf: 'stretch' },
  titleBlock: { alignItems: 'center', gap: spacing.xs },
  name: { ...typography.title, fontSize: 24, textAlign: 'center' },
  tag: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  tagLabel: { fontSize: 12, fontWeight: '800', color: colors.primaryDark },
  description: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  effects: { gap: 4, backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md },
  effect: { ...typography.body, fontSize: 15 },
  footnote: { ...typography.label, fontSize: 11, marginTop: 4 },
  owned: { ...typography.label, color: colors.health, textAlign: 'center' },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.sm },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceTag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  price: { fontSize: 22, fontWeight: '900', color: colors.coinDark, fontVariant: ['tabular-nums'] },
  balance: { ...typography.label },
  hint: { ...typography.label, textAlign: 'center' },
  error: { ...typography.label, color: colors.danger, textAlign: 'center' },
  purchased: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
  purchasedArt: { backgroundColor: '#FFF1C9', width: 160, height: 160 },
  spent: { position: 'absolute', right: -6, top: 6, fontSize: 24, fontWeight: '900', color: colors.coinDark },
});
