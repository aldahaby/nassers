import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { COLLECTION_LIST } from '@/config/collections';
import { CATALOG } from '@/config/shopCatalog';
import { PET_SPECIES, STARTER_SPECIES_ORDER } from '@/config/pets';
import type { AccessorySlot, GrowthStage } from '@/core';
import { useDebugToolsEnabled } from '@/state';
import { PetArt, Screen, colors, radius, spacing, typography, Pressable } from '@/ui';

type Outfit = Partial<Record<AccessorySlot, string>>;
interface BoardLook {
  id: string;
  name: string;
  featuredLook: Outfit;
  wash?: string;
}

/** Pieces not in any curated Look, so every piece gets checked. */
const EXTRA_LOOKS: readonly BoardLook[] = [
  { id: 'extras-a', name: 'Extras A', featuredLook: { head: 'ma-headset', face: 'dw-shades-blue', neck: 'dw-pearls', charm: 'cr-badge' } },
  { id: 'extras-b', name: 'Extras B', featuredLook: { head: 'cr-goggles', face: 'ma-visor-pink', neck: 'fc-harness', charm: 'ma-charm', aura: 'aura-none' } },
  { id: 'extras-c', name: 'Extras C', featuredLook: { head: 'dw-beret', face: 'cr-shades', charm: 'dw-charm', aura: 'fc-aura-hearts' } },
  { id: 'extras-d', name: 'Extras D', featuredLook: { head: 'cr-cap-cobalt', face: 'fc-visor-jade', neck: 'ma-collar', aura: 'ma-aura' } },
  { id: 'extras-e', name: 'Extras E', featuredLook: { head: 'acc-golden-crown', face: 'acc-sunglasses', neck: 'mc-satchel', aura: 'fc-aura-sleepy' } },
  { id: 'extras-f', name: 'Extras F', featuredLook: { head: 'acc-headphones', neck: 'cr-scarf', charm: 'mc-toadstool', aura: 'cr-aura' } },
];

/** A cross-collection remix: proves pieces from different drops work together. */
const REMIX: BoardLook = {
  id: 'remix',
  name: 'User Remix',
  featuredLook: { head: 'dw-beret', face: 'ma-visor', neck: 'cr-scarf', charm: 'dw-charm', aura: 'mc-aura' },
  wash: '#F1EEE8',
};

/** The creative board: Core (Focus Club), the four hero collections and a remix. */
const BOARD: readonly BoardLook[] = [
  ...COLLECTION_LIST.map((c) => ({ id: c.id, name: c.id === 'focus-club' ? 'Core' : c.name, featuredLook: c.featuredLook, wash: c.palette.wash })),
  REMIX,
];

const HEAD_ITEMS = CATALOG.filter((i) => i.equipSlot === 'head' && !i.colorway?.match(/Cobalt|Frost/));

const STAGES: readonly GrowthStage[] = ['baby', 'young', 'adult', 'evolved'];
const STAGE_SCALE: Record<GrowthStage, number> = { baby: 0.78, young: 0.9, adult: 1, evolved: 1.08 };

/**
 * Developer-only Fit Lab and creative QA board. Modes:
 * - board: Core / collections / User Remix × every species (the "do these look
 *   like different styles?" check);
 * - a single Look × species × growth stage (anchors and fit overrides);
 * - hats: every head drawing on every species (crest rules).
 * Grayscale (web) checks that silhouettes and materials read without colour.
 */
export default function FitLab() {
  const debug = useDebugToolsEnabled();
  const { look, gray } = useLocalSearchParams<{ look?: string; gray?: string }>();
  const [grayscale, setGrayscale] = useState(gray === '1');
  const { width } = useWindowDimensions();
  if (!debug) return <Redirect href="/" />;
  const looks: BoardLook[] = [...BOARD, ...EXTRA_LOOKS];
  const mode = look === 'board' || look === 'hats' ? look : look ? 'look' : 'board';
  const current = looks.find((c) => c.id === look) ?? BOARD[1]!;
  const avail = Math.min(width, 1100) - spacing.lg * 2 - 60;
  const cell = Math.min(150, avail / 4);
  const boardCell = Math.min(160, avail / BOARD.length);
  const filter = grayscale && Platform.OS === 'web' ? ({ filter: 'grayscale(1)' } as object) : null;

  const tab = (id: string, name: string) => {
    const on = id === look || (id === 'board' && mode === 'board');
    return (
      <Pressable key={id} onPress={() => router.setParams({ look: id })} style={[styles.chip, on && styles.chipOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
        <Text style={[styles.chipText, on && styles.chipTextOn]}>{name}</Text>
      </Pressable>
    );
  };

  return (
    <Screen scroll width="wide">
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel="Back">
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={typography.title}>Fit Lab</Text>
      <ScrollView horizontal contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>
        {tab('board', 'Creative board')}
        {tab('hats', 'Hats × crests')}
        {looks.map((c) => tab(c.id, c.name))}
      </ScrollView>
      {Platform.OS === 'web' ? (
        <View style={styles.toggle}>
          <Switch value={grayscale} onValueChange={setGrayscale} accessibilityLabel="Grayscale" />
          <Text style={styles.toggleText}>Grayscale (silhouette and material check)</Text>
        </View>
      ) : (
        <Text style={styles.note}>Grayscale: turn on the device’s colour filter (iOS Accessibility › Display › Colour Filters › Greyscale).</Text>
      )}
      <View style={[{ gap: spacing.sm }, filter]}>
        {mode === 'board' && (
          <>
            <View style={styles.row}>
              <Text style={styles.label} />
              {BOARD.map((c) => (
                <Text key={c.id} style={[styles.colHead, { width: boardCell }]} numberOfLines={1}>
                  {c.name}
                </Text>
              ))}
            </View>
            {STARTER_SPECIES_ORDER.map((species) => (
              <View key={species} style={styles.row}>
                <Text style={styles.label}>{PET_SPECIES[species].name}</Text>
                {BOARD.map((c) => (
                  <View key={c.id} style={[styles.cell, { width: boardCell, height: boardCell, backgroundColor: c.wash ?? colors.surface }]} accessible accessibilityLabel={`${species} ${c.name}`}>
                    <PetArt speciesId={species} stage="adult" mood="content" equipped={c.featuredLook} size={boardCell * 0.96} />
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
        {mode === 'hats' && (
          <>
            {STARTER_SPECIES_ORDER.map((species) => (
              <View key={species} style={[styles.row, { flexWrap: 'wrap' }]}>
                <Text style={styles.label}>{PET_SPECIES[species].name}</Text>
                {HEAD_ITEMS.map((item) => (
                  <View key={item.id} style={[styles.cell, { width: cell * 0.8, height: cell * 0.8 }]} accessible accessibilityLabel={`${species} ${item.id}`}>
                    <PetArt speciesId={species} stage={species === 'cloudling' ? 'adult' : 'evolved'} mood="content" equipped={{ head: item.id }} size={cell * 0.76} />
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
        {mode === 'look' &&
          STARTER_SPECIES_ORDER.map((species) => (
            <View key={species} style={styles.row}>
              <Text style={styles.label}>{PET_SPECIES[species].name}</Text>
              {STAGES.map((stage) => (
                <View key={stage} style={[styles.cell, { width: cell, height: cell }]} accessible accessibilityLabel={`${species} ${stage}`}>
                  <PetArt speciesId={species} stage={stage} mood="content" equipped={current.featuredLook} size={cell * STAGE_SCALE[stage]} />
                  <Text style={styles.stage}>{stage}</Text>
                </View>
              ))}
            </View>
          ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { ...typography.label, fontSize: 16, color: colors.primaryDark },
  chips: { gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, minHeight: 40, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontWeight: '800', color: colors.text },
  chipTextOn: { color: colors.white },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggleText: { ...typography.label },
  note: { ...typography.label, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { width: 76, ...typography.label, fontSize: 11 },
  cell: { alignItems: 'center', justifyContent: 'flex-end', backgroundColor: colors.surface, borderRadius: radius.md },
  stage: { ...typography.label, fontSize: 10 },
  colHead: { ...typography.label, textAlign: 'center' },
});
