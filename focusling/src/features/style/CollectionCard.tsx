import { StyleSheet, Text, View } from 'react-native';
import type { CosmeticCollection, GrowthStage, PetSpeciesId } from '@/core';
import { CollectionBadge, PetArt, PremiumMark, TabIcon, colors, radius, spacing, typography, Pressable } from '@/ui';

interface Props {
  collection: CosmeticCollection;
  owned: number;
  total: number;
  complete: boolean;
  pet: { speciesId: PetSpeciesId; stage: GrowthStage };
  onPress: () => void;
}

/** A collection in the browser: badge, identity line, progress, and the pet in its Look. */
export function CollectionCard({ collection, owned, total, complete, pet, onPress }: Props) {
  const { palette } = collection;
  const premium = collection.access === 'premium';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: palette.wash }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${collection.name}. ${collection.tagline} ${premium ? 'Included with Premium.' : `${owned} of ${total} collected${complete ? ', complete' : ''}.`}`}
    >
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <CollectionBadge badge={collection.badge} size={30} />
          <Text style={[styles.name, { color: palette.ink }]} numberOfLines={1}>
            {collection.name}
          </Text>
        </View>
        <Text style={styles.tagline} numberOfLines={2}>
          {collection.tagline}
        </Text>
        {premium ? (
          <View style={styles.progressRow}>
            <PremiumMark label="Included with Premium" compact />
          </View>
        ) : (
          <View style={styles.progressRow}>
          {complete ? (
            <View style={styles.done}>
              <TabIcon name="check" color={colors.success} size={14} />
              <Text style={styles.doneText}>Complete</Text>
            </View>
          ) : (
            <Text style={[styles.count, { color: palette.ink }]}>
              {owned} / {total}
            </Text>
          )}
          <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[styles.fill, { width: `${Math.round((owned / Math.max(1, total)) * 100)}%`, backgroundColor: palette.primary }]} />
          </View>
          </View>
        )}
      </View>
      <View style={styles.preview}>
        <PetArt speciesId={pet.speciesId} stage={pet.stage} mood="content" equipped={collection.featuredLook} size={96} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, minHeight: 120 },
  pressed: { opacity: 0.9 },
  text: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...typography.heading, fontSize: 18, flexShrink: 1 },
  tagline: { ...typography.body, fontSize: 14, color: colors.textMuted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  count: { fontWeight: '900', fontSize: 14, minWidth: 40, fontVariant: ['tabular-nums'] },
  track: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: 'rgba(47,37,72,0.1)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  done: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  doneText: { fontWeight: '900', fontSize: 13, color: colors.success },
  preview: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
});
