import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { COLLECTION_LIST } from '@/config/collections';
import { getShopItem } from '@/config/shopCatalog';
import {
  collectionProgress,
  conflictsFor,
  getWardrobe,
  nextUnlock,
  WEARABLE_SLOTS,
  withEquipped,
  type AccessorySlot,
  type CosmeticCollection,
  type WardrobeEntry,
} from '@/core';
import { usePetSpeech } from '@/features/inventory/usePetSpeech';
import { CollectionCard } from '@/features/style/CollectionCard';
import { ReactionList } from '@/features/style/ReactionList';
import { StyleStage } from '@/features/style/StyleStage';
import { StyleTabs, type StyleTab } from '@/features/style/StyleTabs';
import { SavedLooks } from '@/features/wardrobe/SavedLooks';
import { WardrobeTile } from '@/features/wardrobe/WardrobeTile';
import { cosmeticName, describeProgress, describeUnlock, slotName } from '@/features/wardrobe/cosmeticCopy';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { useEquipped, useGameStore, usePetView } from '@/state';
import { Button, CollectionBadge, PetArt, Screen, TabIcon, colors, radius, spacing, typography } from '@/ui';

type Filter = 'all' | AccessorySlot;
const FILTERS: readonly Filter[] = ['all', ...WEARABLE_SLOTS];
type Preview = { kind: 'item'; itemId: string } | { kind: 'look'; collectionId: string } | null;

/**
 * The Wardrobe: a lookbook with the pet on top. Pieces, Looks, Collections and
 * Reactions share one large preview; anything can be tried on for free.
 */
export default function WardrobeScreen() {
  const params = useLocalSearchParams<{ tab?: StyleTab }>();
  const view = usePetView();
  const equipped = useEquipped();
  const save = useGameStore((s) => s.save);
  const reaction = useGameStore((s) => s.petReaction);
  const { equip, unequipItem, consumePetReaction, markItemsSeen, wearCollectionLook } = useGameStore.getState();
  const { bubble, say, sayForReaction } = usePetSpeech();
  const routes = useAppRoutes();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<StyleTab>(params.tab ?? 'pieces');
  const [filter, setFilter] = useState<Filter>('all');
  const [preview, setPreview] = useState<Preview>(null);
  const [performance, setPerformance] = useState<{ reactionId: string; key: number } | null>(null);
  const [cheer, setCheer] = useState(0);
  // "New" badges stay visible for this visit, then clear when leaving.
  const [newOnOpen] = useState(() => useGameStore.getState().save?.cosmetics.newItemIds ?? []);
  useEffect(() => () => markItemsSeen(newOnOpen), [markItemsSeen, newOnOpen]);

  const entries = useMemo(() => (save ? getWardrobe(save) : []), [save]);
  const next = useMemo(() => (save ? nextUnlock(save) : null), [save]);
  if (!view || !save) return null;
  const { pet, progression } = view;

  // What the preview pet wears: the outfit, or a try-on on top of it.
  const previewItem = preview?.kind === 'item' ? getShopItem(preview.itemId) : undefined;
  const previewLook = preview?.kind === 'look' ? COLLECTION_LIST.find((c) => c.id === preview.collectionId) : undefined;
  const shown = previewItem
    ? withEquipped(equipped, previewItem.id)
    : previewLook
      ? { ...stripWearables(equipped), ...previewLook.featuredLook }
      : equipped;
  const wearingLook = COLLECTION_LIST.find((c) => sameOutfit(equipped, c.featuredLook));
  const stageTint = (previewLook ?? wearingLook)?.palette.wash;
  const columns = width >= 900 ? 6 : width >= 640 ? 5 : width >= 400 ? 4 : 3;
  const completeCount = COLLECTION_LIST.filter((c) => collectionProgress(save, c.id).complete).length;
  const owned = entries.filter((e) => e.state === 'owned' || e.state === 'equipped').length;

  const onTile = (entry: WardrobeEntry) => {
    const { item, state } = entry;
    if (state === 'equipped') {
      setPreview(null);
      unequipItem(item.id);
      return;
    }
    if (state === 'owned') {
      setPreview(null);
      const swapped = conflictsFor(equipped, item.id).map((id) => getShopItem(id)?.name).filter(Boolean);
      equip(item.id, { showOnPet: true });
      if (swapped.length) setTimeout(() => say(`Swapped out the ${swapped.join(' and ')} so it fits.`), 900);
      return;
    }
    setPreview((current) => (current?.kind === 'item' && current.itemId === item.id ? null : { kind: 'item', itemId: item.id }));
    say(`Trying on the ${cosmeticName(item)}!`);
  };

  const previewReaction = (reactionId: string) => setPerformance((p) => ({ reactionId, key: (p?.key ?? 0) + 1 }));

  const lookAction = (c: CosmeticCollection) => {
    const progress = collectionProgress(save, c.id);
    const ownedLook = Object.values(c.featuredLook).filter((id) => id && (save.inventory.items[id]?.quantity ?? 0) > 0).length;
    const lookSize = Object.keys(c.featuredLook).length;
    return { progress, ownedLook, lookSize, canWear: ownedLook === lookSize };
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace(routes.pet))} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={typography.title} accessibilityRole="header">
            Wardrobe
          </Text>
          <Text style={styles.subtitle}>
            {owned} pieces · {completeCount} of {COLLECTION_LIST.length} collections complete
          </Text>
        </View>
      </View>

      <StyleStage
        pet={pet}
        stage={progression.stage}
        mood={view.mood}
        equipped={shown}
        tint={stageTint}
        bubble={bubble}
        reaction={reaction}
        onReactionStart={(r) => {
          consumePetReaction();
          sayForReaction(r);
        }}
        performance={performance}
        cheerKey={cheer}
        label={`${pet.name}${previewItem ? `, trying on the ${cosmeticName(previewItem)}` : previewLook ? `, trying on the ${previewLook.name} look` : ''}`}
      />

      {preview ? (
        <View style={styles.tryOn} accessibilityLiveRegion="polite">
          <Text style={styles.tryTitle}>
            Trying on {previewItem ? cosmeticName(previewItem) : `the ${previewLook?.name} look`}
          </Text>
          {previewItem && <TryOnDetail entry={entries.find((e) => e.item.id === previewItem.id)} />}
          <View style={styles.tryActions}>
            <Button variant="ghost" label="Stop trying on" onPress={() => setPreview(null)} style={styles.tryButton} />
            {previewItem && entries.find((e) => e.item.id === previewItem.id)?.state === 'buyable' && (
              <Button variant="secondary" label="See in the shop" onPress={() => router.navigate(routes.shop as Href)} style={styles.tryButton} />
            )}
          </View>
        </View>
      ) : wearingLook ? (
        <View style={styles.wearing} accessible accessibilityLabel={`Wearing the ${wearingLook.name} look`}>
          <CollectionBadge badge={wearingLook.badge} size={22} />
          <Text style={styles.wearingText}>Wearing the {wearingLook.name} look</Text>
        </View>
      ) : null}

      <StyleTabs value={tab} onChange={setTab} />

      {tab === 'pieces' && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="tablist">
            {FILTERS.map((f) => {
              const active = f === filter;
              const count = f === 'all' ? entries.length : entries.filter((e) => e.item.equipSlot === f).length;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[styles.filter, active && styles.filterActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${f === 'all' ? 'All' : slotName(f)}, ${count} items`}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>{f === 'all' ? 'All' : slotName(f)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {groupByCollection(filter === 'all' ? entries : entries.filter((e) => e.item.equipSlot === filter)).map((group) => (
            <View key={group.id} style={styles.group}>
              <GroupHeader group={group} save={save} />
              <View style={styles.grid}>
                {group.entries.map((entry) => (
                  <View key={entry.item.id} style={{ width: `${100 / columns}%`, padding: spacing.xs }}>
                    <WardrobeTile
                      entry={entry}
                      isNew={newOnOpen.includes(entry.item.id)}
                      trying={preview?.kind === 'item' && preview.itemId === entry.item.id}
                      onPress={() => onTile(entry)}
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </>
      )}

      {tab === 'looks' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Looks</Text>
          <SavedLooks onWear={() => setCheer((c) => c + 1)} />
          <Text style={styles.sectionTitle}>Collection Looks</Text>
          {COLLECTION_LIST.map((c) => {
            const { ownedLook, lookSize, canWear } = lookAction(c);
            return (
              <View key={c.id} style={[styles.lookCard, { backgroundColor: c.palette.wash }]}>
                <PetArt speciesId={pet.speciesId} stage={progression.stage} mood="content" equipped={c.featuredLook} size={84} />
                <View style={styles.lookText}>
                  <View style={styles.lookTitleRow}>
                    <CollectionBadge badge={c.badge} size={22} />
                    <Text style={[styles.lookName, { color: c.palette.ink }]}>{c.name}</Text>
                  </View>
                  <Text style={styles.lookSub}>{canWear ? 'Ready to wear' : `${ownedLook} of ${lookSize} pieces owned`}</Text>
                  <View style={styles.lookButtons}>
                    {canWear ? (
                      <Button
                        label="Wear look"
                        onPress={() => {
                          setPreview(null);
                          wearCollectionLook(c.id);
                          setCheer((k) => k + 1);
                        }}
                        style={styles.lookButton}
                      />
                    ) : (
                      <Button variant="secondary" label="Try on" onPress={() => setPreview({ kind: 'look', collectionId: c.id })} style={styles.lookButton} />
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {tab === 'collections' && (
        <View style={styles.section}>
          {COLLECTION_LIST.map((c) => {
            const p = collectionProgress(save, c.id);
            return (
              <CollectionCard
                key={c.id}
                collection={c}
                owned={p.owned}
                total={p.total}
                complete={p.complete}
                pet={{ speciesId: pet.speciesId, stage: progression.stage }}
                onPress={() => router.push(`/collection/${c.id}` as Href)}
              />
            );
          })}
        </View>
      )}

      {tab === 'reactions' && (
        <View style={styles.section}>
          <Text style={styles.hint}>Tap to preview on {pet.name}. Your favourite plays now and then: when a session ends, or when you tap {pet.name}.</Text>
          <ReactionList onPreview={previewReaction} columns={width >= 640 ? 4 : width >= 400 ? 3 : 2} />
        </View>
      )}

      {tab === 'pieces' && next && (
        <View style={styles.next} accessible accessibilityLabel={`Next for ${pet.name}: ${cosmeticName(next.item)}. ${describeUnlock(next.item.unlock!)}, ${describeProgress(next.item.unlock!, next.progress)}.`}>
          <TabIcon name="lock" color={colors.primaryDark} size={20} />
          <Text style={styles.nextText}>
            Next for {pet.name}: <Text style={styles.nextName}>{cosmeticName(next.item)}</Text> · {describeUnlock(next.item.unlock!).toLowerCase()} ({describeProgress(next.item.unlock!, next.progress)})
          </Text>
        </View>
      )}
      <Text style={styles.footnote}>Just for looks: no effect on coins or XP. Every piece shows how it&apos;s earned; nothing is random, nothing expires.</Text>
    </Screen>
  );
}

function TryOnDetail({ entry }: { entry: WardrobeEntry | undefined }) {
  if (!entry) return null;
  const { item } = entry;
  const text =
    entry.state === 'buyable'
      ? `In the shop for ${item.price} coins.`
      : item.unlock && entry.progress
        ? `${describeUnlock(item.unlock)} · ${describeProgress(item.unlock, entry.progress)}`
        : '';
  return text ? <Text style={styles.tryBody}>{text}</Text> : null;
}

interface Group {
  id: string;
  collection: CosmeticCollection | null;
  entries: WardrobeEntry[];
}

function groupByCollection(entries: WardrobeEntry[]): Group[] {
  const groups: Group[] = COLLECTION_LIST.map((c) => ({ id: c.id, collection: c, entries: entries.filter((e) => e.item.collection === c.id) }));
  groups.push({ id: 'classic', collection: null, entries: entries.filter((e) => !e.item.collection) });
  return groups.filter((g) => g.entries.length > 0);
}

function GroupHeader({ group, save }: { group: Group; save: NonNullable<ReturnType<typeof useGameStore.getState>['save']> }) {
  if (!group.collection) return <Text style={styles.groupTitle}>Classic shop</Text>;
  const c = group.collection;
  const p = collectionProgress(save, c.id);
  return (
    <Pressable onPress={() => router.push(`/collection/${c.id}` as Href)} style={styles.groupHeader} accessibilityRole="button" accessibilityLabel={`${c.name}, ${p.owned} of ${p.total} collected. Open collection.`}>
      <CollectionBadge badge={c.badge} size={26} />
      <Text style={[styles.groupTitle, { color: c.palette.ink }]}>{c.name}</Text>
      <Text style={styles.groupCount}>
        {p.owned}/{p.total}
      </Text>
      <Text style={styles.groupChevron}>›</Text>
    </Pressable>
  );
}

function stripWearables<T extends Record<string, unknown>>(equipped: T): T {
  const next = { ...equipped };
  for (const slot of WEARABLE_SLOTS) delete (next as Record<string, unknown>)[slot];
  return next;
}

function sameOutfit(equipped: Partial<Record<string, string>>, look: Partial<Record<string, string>>): boolean {
  return WEARABLE_SLOTS.every((slot) => (equipped[slot] ?? null) === (look[slot] ?? null));
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 34, fontWeight: '700', color: colors.primaryDark, marginTop: -4 },
  headerText: { flex: 1 },
  subtitle: { ...typography.label },
  tryOn: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs, borderWidth: 2, borderColor: colors.primarySoft },
  tryTitle: { ...typography.heading, fontSize: 18 },
  tryBody: { ...typography.body, fontSize: 15, color: colors.textMuted },
  tryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  tryButton: { flexGrow: 1, flexBasis: 140 },
  wearing: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'center', backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  wearingText: { fontWeight: '800', fontSize: 13, color: colors.text },
  filters: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  filter: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  filterActive: { backgroundColor: colors.ink },
  filterText: { fontWeight: '800', fontSize: 14, color: colors.text },
  filterTextActive: { color: colors.white },
  group: { gap: spacing.xs },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40 },
  groupTitle: { ...typography.heading, fontSize: 17, flexShrink: 1 },
  groupCount: { ...typography.label, marginLeft: 'auto' },
  groupChevron: { fontSize: 22, fontWeight: '900', color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  section: { gap: spacing.md },
  sectionTitle: { ...typography.label, textTransform: 'uppercase', letterSpacing: 0.8 },
  lookCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, padding: spacing.md },
  lookText: { flex: 1, gap: 4 },
  lookTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lookName: { ...typography.heading, fontSize: 17, flexShrink: 1 },
  lookSub: { ...typography.label },
  lookButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
  lookButton: { flexGrow: 1 },
  hint: { ...typography.body, fontSize: 14, color: colors.textMuted },
  next: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  nextText: { ...typography.body, fontSize: 14, flex: 1, color: colors.primaryDark },
  nextName: { fontWeight: '800' },
  footnote: { ...typography.label, textAlign: 'center', lineHeight: 19 },
});
