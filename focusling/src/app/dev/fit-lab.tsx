import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { COLLECTION_LIST } from '@/config/collections';
import { PET_SPECIES, STARTER_SPECIES_ORDER } from '@/config/pets';
import type { GrowthStage } from '@/core';
import { useDebugToolsEnabled } from '@/state';
import { PetArt, Screen, colors, radius, spacing, typography } from '@/ui';

/** Pieces not in any curated Look, so every piece gets checked. */
const EXTRA_LOOKS = [
  { id: 'extras-a', name: 'Extras A', featuredLook: { head: 'ma-headset', face: 'dw-shades-blue', neck: 'dw-pearls', charm: 'cr-badge' } },
  { id: 'extras-b', name: 'Extras B', featuredLook: { head: 'cr-goggles', face: 'ma-visor-pink', neck: 'fc-harness', charm: 'ma-charm', aura: 'aura-none' } },
  { id: 'extras-c', name: 'Extras C', featuredLook: { head: 'dw-beret', face: 'cr-shades', charm: 'dw-charm', aura: 'fc-aura-hearts' } },
  { id: 'extras-d', name: 'Extras D', featuredLook: { head: 'cr-cap-cobalt', face: 'fc-visor-jade', neck: 'ma-collar', aura: 'ma-aura' } },
] as const;

const STAGES: readonly GrowthStage[] = ['baby', 'young', 'adult', 'evolved'];
const STAGE_SCALE: Record<GrowthStage, number> = { baby: 0.78, young: 0.9, adult: 1, evolved: 1.08 };

/**
 * Developer-only Fit Lab: every species × growth stage wearing a collection
 * Look (ownership ignored), for checking anchors and fit overrides.
 */
export default function FitLab() {
  const debug = useDebugToolsEnabled();
  const { look } = useLocalSearchParams<{ look?: string }>();
  const { width } = useWindowDimensions();
  if (!debug) return <Redirect href="/" />;
  const looks = [...COLLECTION_LIST, ...EXTRA_LOOKS];
  const current = looks.find((c) => c.id === look) ?? COLLECTION_LIST[1]!;
  const cell = Math.min(150, (Math.min(width, 900) - spacing.lg * 2 - 60) / 4);

  return (
    <Screen scroll width="wide">
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel="Back">
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={typography.title}>Fit Lab</Text>
      <ScrollView horizontal contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>
        {looks.map((c) => (
          <Pressable key={c.id} onPress={() => router.setParams({ look: c.id })} style={[styles.chip, c.id === current.id && look !== 'compare' && styles.chipOn]} accessibilityRole="tab" accessibilityState={{ selected: c.id === current.id && look !== 'compare' }}>
            <Text style={[styles.chipText, c.id === current.id && look !== 'compare' && styles.chipTextOn]}>{c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable onPress={() => router.setParams({ look: 'compare' })} style={[styles.chip, look === 'compare' && styles.chipOn, { alignSelf: 'flex-start' }]} accessibilityRole="tab">
        <Text style={[styles.chipText, look === 'compare' && styles.chipTextOn]}>Compare collections</Text>
      </Pressable>
      {look === 'compare' ? (
        <View style={{ gap: spacing.sm }}>
          <View style={styles.row}>
            <Text style={styles.label} />
            {COLLECTION_LIST.slice(1).map((c) => (
              <Text key={c.id} style={[styles.colHead, { width: cell * 1.2 }]}>
                {c.name}
              </Text>
            ))}
          </View>
          {STARTER_SPECIES_ORDER.map((species) => (
            <View key={species} style={styles.row}>
              <Text style={styles.label}>{PET_SPECIES[species].name}</Text>
              {COLLECTION_LIST.slice(1).map((c) => (
                <View key={c.id} style={[styles.cell, { width: cell * 1.2, height: cell * 1.2, backgroundColor: c.palette.wash }]} accessible accessibilityLabel={`${species} ${c.name}`}>
                  <PetArt speciesId={species} stage="adult" mood="content" equipped={c.featuredLook} size={cell * 1.15} />
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}
      {look !== 'compare' && STARTER_SPECIES_ORDER.map((species) => (
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { width: 52, ...typography.label, fontSize: 11 },
  cell: { alignItems: 'center', justifyContent: 'flex-end', backgroundColor: colors.surface, borderRadius: radius.md },
  stage: { ...typography.label, fontSize: 10 },
  colHead: { ...typography.label, textAlign: 'center' },
});
