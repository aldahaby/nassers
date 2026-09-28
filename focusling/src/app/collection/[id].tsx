import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { getCollection } from '@/config/collections';
import { getReaction } from '@/config/reactions';
import { getShopItem } from '@/config/shopCatalog';
import { collectionProgress, getWardrobe, isReactionUnlocked, withEquipped, type WardrobeEntry } from '@/core';
import { usePetSpeech } from '@/features/inventory/usePetSpeech';
import { PieceDetail } from '@/features/style/PieceDetail';
import { StyleStage } from '@/features/style/StyleStage';
import { WardrobeTile } from '@/features/wardrobe/WardrobeTile';
import { cosmeticName } from '@/features/wardrobe/cosmeticCopy';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { useEquipped, useGameStore, usePetView } from '@/state';
import { Button, CollectionBadge, ItemArt, ReactionIcon, Screen, TabIcon, colors, radius, spacing, typography, Pressable } from '@/ui';

/**
 * One collection as a lookbook: the pet in the curated Look on the
 * collection's set, the Look's pieces, every piece with its provenance
 * ("Earned after …"), and the Reaction completion unlocks.
 */
export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collection = id ? getCollection(id) : undefined;
  const view = usePetView();
  const equipped = useEquipped();
  const save = useGameStore((s) => s.save);
  const petReaction = useGameStore((s) => s.petReaction);
  const { equip, unequipItem, wearCollectionLook, consumePetReaction } = useGameStore.getState();
  const { bubble, say, sayForReaction } = usePetSpeech();
  const routes = useAppRoutes();
  const { width } = useWindowDimensions();
  const [showLook, setShowLook] = useState(true);
  const [tryItem, setTryItem] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [performance, setPerformance] = useState<{ reactionId: string; key: number } | null>(null);
  const [cheer, setCheer] = useState(0);
  const entries = useMemo(() => (save && collection ? getWardrobe(save).filter((e) => e.item.collection === collection.id) : []), [save, collection]);

  if (!collection) return <Redirect href="/wardrobe" />;
  if (!view || !save) return null;
  const { pet, progression } = view;
  const progress = collectionProgress(save, collection.id);
  const reaction = getReaction(collection.reaction);
  const reactionUnlocked = reaction ? isReactionUnlocked(save, reaction.id) : false;
  const lookIds = Object.values(collection.featuredLook).filter(Boolean) as string[];
  const lookOwned = lookIds.filter((i) => (save.inventory.items[i]?.quantity ?? 0) > 0).length;
  const accent = collection.roomAccent ? getShopItem(collection.roomAccent) : undefined;
  const accentOwned = accent ? (save.inventory.items[accent.id]?.quantity ?? 0) > 0 : false;
  const columns = width >= 900 ? 5 : width >= 640 ? 4 : 3;
  const base = showLook ? { ...stripLookSlots(equipped), ...collection.featuredLook } : equipped;
  const shown = tryItem ? withEquipped(base, tryItem) : base;
  const detailEntry = entries.find((e) => e.item.id === detailId);

  const onTile = (entry: WardrobeEntry) => {
    const { item, state } = entry;
    setDetailId(item.id);
    if (state === 'equipped') {
      unequipItem(item.id);
      return;
    }
    if (state === 'owned') {
      setShowLook(false);
      setTryItem(null);
      equip(item.id, { showOnPet: true });
      return;
    }
    setTryItem((t) => (t === item.id ? null : item.id));
    say(`Trying on the ${cosmeticName(item)}!`);
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/wardrobe' as Href))} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <CollectionBadge badge={collection.badge} size={40} />
        <View style={styles.headerText}>
          <Text style={[typography.title, { color: collection.palette.ink }]} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
            {collection.name}
          </Text>
          <Text style={styles.tagline}>{collection.tagline}</Text>
        </View>
      </View>

      <StyleStage
        pet={pet}
        stage={progression.stage}
        mood={view.mood}
        equipped={shown}
        tint={collection.palette.wash}
        bubble={bubble}
        reaction={petReaction}
        onReactionStart={(r) => {
          consumePetReaction();
          sayForReaction(r);
        }}
        performance={performance}
        cheerKey={cheer}
        label={`${pet.name}${showLook ? ` in the ${collection.name} look` : ''}${tryItem ? `, trying on ${cosmeticName(getShopItem(tryItem)!)}` : ''}`}
      />

      <View style={styles.progress} accessible accessibilityLabel={`${progress.owned} of ${progress.total} collected${progress.complete ? ', complete' : ''}`}>
        <View style={styles.progressTop}>
          {progress.complete ? (
            <View style={styles.complete}>
              <TabIcon name="check" color={colors.success} size={16} />
              <Text style={styles.completeText}>Collection complete</Text>
            </View>
          ) : (
            <Text style={[styles.count, { color: collection.palette.ink }]}>
              {progress.owned} / {progress.total} collected
            </Text>
          )}
          <Pressable onPress={() => setShowLook((v) => !v)} accessibilityRole="button" accessibilityLabel={showLook ? 'Show my outfit' : 'Show the curated look'} hitSlop={8}>
            <Text style={styles.toggle}>{showLook ? 'Show my outfit' : 'Show the look'}</Text>
          </Pressable>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round((progress.owned / Math.max(1, progress.total)) * 100)}%`, backgroundColor: collection.palette.primary }]} />
        </View>
      </View>

      <Text style={styles.description}>{collection.description}</Text>

      {lookOwned === lookIds.length ? (
        <Button
          label={`Wear the ${collection.name} look`}
          sound="equip"
          onPress={() => {
            wearCollectionLook(collection.id);
            setShowLook(false);
            setTryItem(null);
            setCheer((c) => c + 1);
          }}
        />
      ) : (
        <Text style={styles.lookHint}>
          The curated look uses {lookIds.length} pieces · you have {lookOwned}. Collect them all to wear it in one tap.
        </Text>
      )}

      {reaction && (
        <View style={[styles.reaction, { borderColor: collection.palette.primary }]}>
          <View style={styles.reactionIcon}>
            <ReactionIcon style={reaction.style} size={40} />
          </View>
          <View style={styles.reactionText}>
            <Text style={styles.reactionName}>{reaction.name} reaction</Text>
            <Text style={styles.reactionDesc}>{reactionUnlocked ? 'Unlocked. Make it your favourite in Reactions.' : 'Unlocks when you complete the collection.'}</Text>
          </View>
          <Button variant="secondary" label="Preview" onPress={() => setPerformance((p) => ({ reactionId: reaction.id, key: (p?.key ?? 0) + 1 }))} />
        </View>
      )}

      <Text style={styles.sectionTitle}>The look</Text>
      <View style={styles.lookStrip}>
        {lookIds.map((lookId) => {
          const item = getShopItem(lookId)!;
          const have = (save.inventory.items[lookId]?.quantity ?? 0) > 0;
          return (
            <Pressable
              key={lookId}
              onPress={() => setDetailId(lookId)}
              style={[styles.lookPiece, { backgroundColor: collection.palette.wash }]}
              accessibilityRole="button"
              accessibilityLabel={`${cosmeticName(item)}${have ? ', owned' : ''}. Show details.`}
            >
              <ItemArt itemId={lookId} size={44} />
              <Text style={styles.lookPieceName} numberOfLines={2}>
                {item.name}
              </Text>
              {have && <TabIcon name="check" color={colors.success} size={12} />}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Pieces</Text>
      {detailEntry && <PieceDetail entry={detailEntry} acquiredAt={save.inventory.items[detailEntry.item.id]?.acquiredAt ?? null} trying={tryItem === detailEntry.item.id} />}
      <View style={styles.grid}>
        {entries.map((entry) => (
          <View key={entry.item.id} style={{ width: `${100 / columns}%`, padding: spacing.xs }}>
            <WardrobeTile entry={entry} isNew={false} trying={tryItem === entry.item.id} onPress={() => onTile(entry)} />
          </View>
        ))}
      </View>

      {accent && (
        <Pressable
          onPress={() => router.navigate(routes.shop as Href)}
          style={styles.accent}
          accessibilityRole="button"
          accessibilityLabel={`Matching room accent: ${accent.name}. ${accentOwned ? 'Owned.' : `In the shop for ${accent.price} coins.`}`}
        >
          <View style={styles.accentArt}>
            <ItemArt itemId={accent.id} size={44} />
          </View>
          <View style={styles.accentText}>
            <Text style={styles.accentKicker}>Matching room accent</Text>
            <Text style={styles.accentName}>{accent.name}</Text>
          </View>
          <Text style={styles.accentStatus}>{accentOwned ? 'Owned' : `${accent.price} coins ›`}</Text>
        </Pressable>
      )}
      <Text style={styles.footnote}>A permanent collection: nothing here expires or rotates.</Text>
    </Screen>
  );
}

function stripLookSlots<T extends Record<string, unknown>>(equipped: T): T {
  const next = { ...equipped };
  for (const slot of ['head', 'face', 'neck', 'charm', 'aura']) delete (next as Record<string, unknown>)[slot];
  return next;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 34, fontWeight: '700', color: colors.primaryDark, marginTop: -4 },
  headerText: { flex: 1 },
  tagline: { ...typography.label, fontSize: 14 },
  progress: { gap: 6 },
  progressTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  count: { fontWeight: '900', fontSize: 16 },
  complete: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  completeText: { fontWeight: '900', color: colors.success },
  toggle: { fontWeight: '800', color: colors.primaryDark, fontSize: 14 },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  description: { ...typography.body, fontSize: 15, color: colors.textMuted },
  lookHint: { ...typography.body, fontSize: 14, color: colors.textMuted },
  reaction: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 2 },
  reactionIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.stageGlow, alignItems: 'center', justifyContent: 'center' },
  reactionText: { flex: 1, minWidth: 120, gap: 2 },
  reactionName: { ...typography.heading, fontSize: 16 },
  reactionDesc: { ...typography.label },
  lookStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  lookPiece: { width: 84, minHeight: 100, alignItems: 'center', gap: 2, padding: spacing.xs, borderRadius: radius.md },
  lookPieceName: { fontSize: 11, fontWeight: '800', color: colors.text, textAlign: 'center' },
  sectionTitle: { ...typography.label, textTransform: 'uppercase', letterSpacing: 0.8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  accent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md },
  accentArt: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.roomWall, alignItems: 'center', justifyContent: 'center' },
  accentText: { flex: 1 },
  accentKicker: { ...typography.label, fontSize: 11, textTransform: 'uppercase' },
  accentName: { ...typography.body, fontWeight: '800' },
  accentStatus: { ...typography.label, color: colors.primaryDark },
  footnote: { ...typography.label, textAlign: 'center' },
});
