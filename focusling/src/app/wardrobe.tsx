import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { COLLECTIONS, COSMETICS } from '@/config/cosmetics';
import { getShopItem } from '@/config/shopCatalog';
import { getStageDefinitionById, getWardrobe, nextUnlock, WEARABLE_SLOTS, type AccessorySlot, type WardrobeEntry } from '@/core';
import { usePetSpeech } from '@/features/inventory/usePetSpeech';
import { PetReactionStage } from '@/features/pet/PetReactionStage';
import { WardrobeTile } from '@/features/wardrobe/WardrobeTile';
import { LooksRow } from '@/features/wardrobe/LooksRow';
import { cosmeticName, describeProgress, describeUnlock, slotName } from '@/features/wardrobe/cosmeticCopy';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { useEquipped, useGameStore, usePetView } from '@/state';
import { Button, Screen, SpeechBubble, TabIcon, colors, radius, spacing, typography } from '@/ui';

type Filter = 'all' | AccessorySlot;
const FILTERS: readonly Filter[] = ['all', ...WEARABLE_SLOTS];

/**
 * The wardrobe: a collection, not a settings menu. The pet is the centre;
 * everything owned, earnable and in the shop is shown, and anything can be
 * tried on for free.
 */
export default function WardrobeScreen() {
  const view = usePetView();
  const equipped = useEquipped();
  const save = useGameStore((s) => s.save);
  const reaction = useGameStore((s) => s.petReaction);
  const { equip, unequipItem, consumePetReaction, markItemsSeen } = useGameStore.getState();
  const { bubble, say, sayForReaction } = usePetSpeech();
  const routes = useAppRoutes();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>('all');
  const [tryOn, setTryOn] = useState<string | null>(null);
  // "New" badges stay visible for this visit, then clear when leaving.
  const [newOnOpen] = useState(() => useGameStore.getState().save?.cosmetics.newItemIds ?? []);

  useEffect(() => () => markItemsSeen(newOnOpen), [markItemsSeen, newOnOpen]);

  const entries = useMemo(() => (save ? getWardrobe(save) : []), [save]);
  const next = useMemo(() => (save ? nextUnlock(save) : null), [save]);

  if (!view || !save) return null;
  const { pet, progression, mood } = view;
  const tryItem = tryOn ? getShopItem(tryOn) : undefined;
  const tryEntry = entries.find((e) => e.item.id === tryOn);
  const shown = tryItem?.equipSlot ? { ...equipped, [tryItem.equipSlot]: tryItem.id } : equipped;
  const collection = entries.filter((e) => e.item.collection === 'focus-club');
  const collected = collection.filter((e) => e.state === 'owned' || e.state === 'equipped').length;
  const visible = filter === 'all' ? entries : entries.filter((e) => e.item.equipSlot === filter);
  const petSize = Math.min(280, width * 0.66);
  const spot = petSize * getStageDefinitionById(progression.stage).scale * 1.3;
  const columns = width >= 900 ? 6 : width >= 640 ? 5 : width >= 400 ? 4 : 3;

  const onTile = (entry: WardrobeEntry) => {
    const { item, state } = entry;
    if (state === 'equipped') {
      setTryOn(null);
      unequipItem(item.id);
      return;
    }
    if (state === 'owned') {
      setTryOn(null);
      equip(item.id, { showOnPet: true });
      return;
    }
    // Locked: a free try-on that changes nothing.
    setTryOn((current) => (current === item.id ? null : item.id));
    say(`Trying on the ${cosmeticName(item)}!`);
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
            {COLLECTIONS['focus-club']!.name} · {collected} of {collection.length} collected
          </Text>
        </View>
      </View>

      <View style={styles.stage}>
        <View style={[styles.spotlight, { width: spot, height: spot, borderRadius: spot / 2 }]} />
        <SpeechBubble text={bubble} />
        <PetReactionStage
          speciesId={pet.speciesId}
          stage={progression.stage}
          mood={mood}
          equipped={shown}
          size={petSize}
          reaction={reaction}
          onReactionStart={(r) => {
            consumePetReaction();
            sayForReaction(r);
          }}
          accessibilityLabel={`${pet.name}${tryItem ? `, trying on the ${cosmeticName(tryItem)}` : ''}`}
        />
      </View>

      {tryItem && tryEntry ? (
        <View style={styles.tryOn} accessibilityLiveRegion="polite">
          <Text style={styles.tryTitle}>Trying on {cosmeticName(tryItem)}</Text>
          <Text style={styles.tryBody}>
            {tryEntry.state === 'buyable'
              ? `In the shop for ${tryItem.price} coins.`
              : tryItem.unlock && tryEntry.progress
                ? `${describeUnlock(tryItem.unlock)} · ${describeProgress(tryItem.unlock, tryEntry.progress)}`
                : ''}
          </Text>
          <View style={styles.tryActions}>
            <Button variant="ghost" label="Stop trying on" onPress={() => setTryOn(null)} style={styles.tryButton} />
            {tryEntry.state === 'buyable' && (
              <Button variant="secondary" label="See in the shop" onPress={() => router.navigate(routes.shop as Href)} style={styles.tryButton} />
            )}
          </View>
        </View>
      ) : (
        <LooksRow />
      )}

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

      <View style={styles.grid}>
        {visible.map((entry) => (
          <View key={entry.item.id} style={{ width: `${100 / columns}%`, padding: spacing.xs }}>
            <WardrobeTile entry={entry} isNew={newOnOpen.includes(entry.item.id)} trying={tryOn === entry.item.id} onPress={() => onTile(entry)} />
          </View>
        ))}
      </View>

      {next && (
        <View style={styles.next} accessible accessibilityLabel={`Next for ${pet.name}: ${cosmeticName(next.item)}. ${describeUnlock(next.item.unlock!)}, ${describeProgress(next.item.unlock!, next.progress)}.`}>
          <TabIcon name="lock" color={colors.primaryDark} size={20} />
          <Text style={styles.nextText}>
            Next for {pet.name}: <Text style={styles.nextName}>{cosmeticName(next.item)}</Text> · {describeUnlock(next.item.unlock!).toLowerCase()} ({describeProgress(next.item.unlock!, next.progress)})
          </Text>
        </View>
      )}
      <Text style={styles.footnote}>
        Accessories are just for looks: they don&apos;t change coins or XP. Earned pieces come from focusing, never from chance. Up to {COSMETICS.maxLooks} saved looks.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 34, fontWeight: '700', color: colors.primaryDark, marginTop: -4 },
  headerText: { flex: 1 },
  subtitle: { ...typography.label },
  stage: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md },
  spotlight: { position: 'absolute', backgroundColor: colors.stage },
  tryOn: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs, borderWidth: 2, borderColor: colors.primarySoft },
  tryTitle: { ...typography.heading, fontSize: 18 },
  tryBody: { ...typography.body, fontSize: 15, color: colors.textMuted },
  tryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  tryButton: { flexGrow: 1, flexBasis: 140 },
  filters: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  filter: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  filterActive: { backgroundColor: colors.ink },
  filterText: { fontWeight: '800', fontSize: 14, color: colors.text },
  filterTextActive: { color: colors.white },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  next: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  nextText: { ...typography.body, fontSize: 14, flex: 1, color: colors.primaryDark },
  nextName: { fontWeight: '800' },
  footnote: { ...typography.label, textAlign: 'center', lineHeight: 19 },
});
