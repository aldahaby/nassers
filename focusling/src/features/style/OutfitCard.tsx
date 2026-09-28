import { StyleSheet, Text, View } from 'react-native';
import { getPersonality, getReaction } from '@/config/reactions';
import { getShopItem } from '@/config/shopCatalog';
import { WEARABLE_SLOTS, type CosmeticCollection, type EquipSlot } from '@/core';
import { cosmeticName, slotName } from '@/features/wardrobe/cosmeticCopy';
import { CollectionBadge, ItemArt, ReactionIcon, TabIcon, colors, radius, spacing, typography, Pressable } from '@/ui';

interface Props {
  equipped: Partial<Record<EquipSlot, string>>;
  /** The collection Look being worn exactly, if any. */
  wearingLook?: CosmeticCollection;
  favoriteReactionId: string | null;
  onPlayFavorite: () => void;
  onSave: () => void;
  onPiece: (itemId: string) => void;
}

/**
 * "Outfit second": what the pet is wearing right now, directly under it. A
 * remix is named as proudly as a full collection Look (no set advantage).
 */
export function OutfitCard({ equipped, wearingLook, favoriteReactionId, onPlayFavorite, onSave, onPiece }: Props) {
  const pieces = WEARABLE_SLOTS.map((slot) => equipped[slot]).filter((id): id is string => Boolean(id && getShopItem(id)));
  const collections = new Set(pieces.map((id) => getShopItem(id)?.collection).filter(Boolean));
  const title = wearingLook ? `The ${wearingLook.name} look` : pieces.length === 0 ? 'Nothing on yet' : collections.size > 1 ? 'Your remix' : 'Your outfit';
  const favorite = favoriteReactionId ? getReaction(favoriteReactionId) : undefined;
  const personality = favorite ? getPersonality(favorite.personality) : undefined;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        {wearingLook && <CollectionBadge badge={wearingLook.badge} size={22} />}
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {pieces.length > 0 && (
          <Pressable onPress={onSave} sound="confirm" style={styles.save} accessibilityRole="button" accessibilityLabel="Save this outfit as a Look" hitSlop={6}>
            <TabIcon name="plus" color={colors.primaryDark} size={14} />
            <Text style={styles.saveText}>Save look</Text>
          </Pressable>
        )}
      </View>
      {pieces.length === 0 ? (
        <Text style={styles.empty}>Tap any piece below to try it on. Mix collections freely: every combination counts.</Text>
      ) : (
        <View style={styles.chips}>
          {pieces.map((id) => {
            const item = getShopItem(id)!;
            return (
              <Pressable key={id} onPress={() => onPiece(id)} style={styles.chip} accessibilityRole="button" accessibilityLabel={`${slotName(item.equipSlot as never)}: ${cosmeticName(item)}. Show details.`}>
                <ItemArt itemId={id} size={24} />
                <Text style={styles.chipText} numberOfLines={1}>
                  {item.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {favorite && personality && (
        <View style={styles.personality}>
          <View style={[styles.family, { backgroundColor: personality.tint }]}>
            <Text style={[styles.familyText, { color: personality.ink }]}>{personality.name}</Text>
          </View>
          <Text style={styles.personalityLine} numberOfLines={2}>
            Favourite: {favorite.name}
          </Text>
          <Pressable onPress={onPlayFavorite} style={styles.play} accessibilityRole="button" accessibilityLabel={`Play ${favorite.name}`} hitSlop={6}>
            <ReactionIcon style={favorite.style} size={22} />
            <Text style={styles.playText}>Play</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.heading, fontSize: 17, flexShrink: 1 },
  save: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  saveText: { fontSize: 13, fontWeight: '800', color: colors.primaryDark },
  empty: { ...typography.body, fontSize: 14, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, maxWidth: '100%', paddingLeft: 4, paddingRight: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.text, flexShrink: 1 },
  personality: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.surfaceMuted, paddingTop: spacing.sm },
  family: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  familyText: { fontSize: 12, fontWeight: '900' },
  personalityLine: { ...typography.label, flexShrink: 1 },
  play: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 36, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.stageGlow },
  playText: { fontSize: 13, fontWeight: '800', color: colors.primaryDark },
});
