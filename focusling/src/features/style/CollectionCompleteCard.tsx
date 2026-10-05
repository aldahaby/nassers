import { StyleSheet, Text, View } from 'react-native';
import { getCollection } from '@/config/collections';
import { getReaction } from '@/config/reactions';
import { useGameStore } from '@/state';
import { Button, CollectionBadge, TabIcon, radius, spacing, typography } from '@/ui';

interface Props {
  collectionId: string;
  /** Play the collection's reaction on the nearby pet. */
  onTryReaction: (reactionId: string) => void;
  onWearLook?: () => void;
}

/**
 * The collection completion moment: restrained, one card. It names the
 * collection, the reaction it unlocked, and offers to try it or wear the look.
 */
export function CollectionCompleteCard({ collectionId, onTryReaction, onWearLook }: Props) {
  const collection = getCollection(collectionId);
  const { wearCollectionLook } = useGameStore.getState();
  if (!collection) return null;
  const reaction = collection.reaction ? getReaction(collection.reaction) : undefined;
  const { palette } = collection;

  return (
    <View style={[styles.card, { backgroundColor: palette.ink }]} accessibilityRole="summary" accessibilityLiveRegion="polite">
      <View style={styles.header}>
        <CollectionBadge badge={collection.badge} size={52} />
        <View style={styles.headerText}>
          <Text style={[styles.kicker, { color: palette.accent }]}>{collection.name} complete</Text>
          <Text style={styles.body}>You collected the full {collection.name} look.</Text>
        </View>
      </View>
      {reaction && (
        <View style={styles.reaction} accessible accessibilityLabel={`Unlocked: ${reaction.name} reaction. ${reaction.description}`}>
          <TabIcon name="reactions" color="#FFFFFF" size={20} />
          <Text style={styles.reactionText}>
            Unlocked: <Text style={styles.reactionName}>{reaction.name}</Text> reaction
          </Text>
        </View>
      )}
      <View style={styles.actions}>
        {reaction && <Button variant="secondary" label="Try reaction" onPress={() => onTryReaction(reaction.id)} style={styles.action} />}
        <Button
          variant="secondary"
          label="Wear the look"
          onPress={() => {
            wearCollectionLook(collection.id);
            onWearLook?.();
          }}
          style={styles.action}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  kicker: { ...typography.label, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1.2 },
  body: { ...typography.body, color: '#FFFFFF', fontWeight: '700' },
  reaction: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md },
  reactionText: { ...typography.body, fontSize: 15, color: '#FFFFFF' },
  reactionName: { fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 140 },
});
