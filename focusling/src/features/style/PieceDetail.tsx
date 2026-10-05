import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getCollection } from '@/config/collections';
import { ART_MATERIAL, MATERIAL_LABEL } from '@/config/cosmetics';
import { provenanceOf, type WardrobeEntry } from '@/core';
import { cosmeticName, describeHowToGet, describeProgress, describeProvenance } from '@/features/wardrobe/cosmeticCopy';
import { CollectionBadge, ItemArt, PremiumMark, TabIcon, colors, radius, spacing, typography } from '@/ui';

/**
 * One piece, up close: its name, collection, material and provenance
 * ("Earned after 5 completed focus sessions · 28 Sep"), or how to get it.
 */
export function PieceDetail({ entry, acquiredAt, trying, children }: { entry: WardrobeEntry; acquiredAt: number | null; trying: boolean; children?: ReactNode }) {
  const { item, state, progress } = entry;
  const owned = state === 'owned' || state === 'equipped' || state === 'included';
  const premium = item.access === 'premium';
  const collection = item.collection ? getCollection(item.collection) : undefined;
  const material = item.art?.key ? ART_MATERIAL[item.art.key] : undefined;
  const provenance = owned && !premium ? describeProvenance(provenanceOf(item, acquiredAt)) : describeHowToGet(item);
  const progressText = !owned && item.unlock && progress ? describeProgress(item.unlock, progress) : null;

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <View style={styles.art}>
          <ItemArt itemId={item.id} size={52} />
        </View>
        <View style={styles.text}>
          <Text style={styles.kicker}>{trying ? 'Trying on' : state === 'equipped' ? 'Wearing' : state === 'included' ? 'Included with Premium' : owned ? 'In your wardrobe' : premium ? 'Premium piece' : 'Not yours yet'}</Text>
          <Text style={styles.name}>{cosmeticName(item)}</Text>
          <View style={styles.meta}>
            {collection && (
              <View style={styles.tag}>
                <CollectionBadge badge={collection.badge} size={16} />
                <Text style={styles.tagText}>{collection.name}</Text>
              </View>
            )}
            {premium && <PremiumMark compact />}
            {material && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{MATERIAL_LABEL[material]}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <View style={styles.provenance}>
        <TabIcon name={owned ? 'check' : 'lock'} color={owned ? colors.success : colors.textMuted} size={14} />
        <Text style={styles.provenanceText}>
          {provenance}
          {progressText ? ` · ${progressText}` : ''}
        </Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 2, borderColor: colors.primarySoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  art: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.stageGlow, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  kicker: { ...typography.label, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  name: { ...typography.heading, fontSize: 17 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 12, fontWeight: '700', color: colors.text },
  provenance: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  provenanceText: { ...typography.body, fontSize: 14, color: colors.textMuted, flex: 1 },
});
