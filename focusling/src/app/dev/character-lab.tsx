import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { COLLECTION_LIST } from '@/config/collections';
import { PET_SPECIES, STARTER_SPECIES_ORDER } from '@/config/pets';
import type { AccessorySlot, GrowthStage, PetSpeciesId } from '@/core';
import { RoomColorPicker } from '@/features/room/RoomColorPicker';
import { useDebugToolsEnabled } from '@/state';
import { PetArt, Pressable, RoomScene, Screen, colors, radius, spacing, typography } from '@/ui';
import { EXPRESSIONS, type FaceExpression } from '@/ui/pet/PetFace';

type Outfit = Partial<Record<AccessorySlot, string>>;
const STAGES: readonly GrowthStage[] = ['baby', 'young', 'adult', 'evolved'];
const STAGE_SCALE: Record<GrowthStage, number> = { baby: 0.78, young: 0.9, adult: 1, evolved: 1.08 };
const OUTFITS: readonly { id: string; name: string; outfit: Outfit }[] = [
  { id: 'naked', name: 'A · Naked', outfit: {} },
  { id: 'simple', name: 'B · One accessory', outfit: { face: 'fc-visor-frost' } },
  { id: 'full', name: 'C · Full Look', outfit: COLLECTION_LIST.find((c) => c.id === 'moss-club')!.featuredLook },
  { id: 'arcade', name: 'Midnight Arcade', outfit: COLLECTION_LIST.find((c) => c.id === 'midnight-arcade')!.featuredLook },
  { id: 'remix', name: 'Remix', outfit: { head: 'dw-beret', face: 'ma-visor', neck: 'cr-scarf', charm: 'dw-charm', aura: 'mc-aura' } },
];
/** The naked-pet test rows: A naked, B one accessory, C a full Look. */
const TEST_ROWS = OUTFITS.slice(0, 3);
/** Room test presets (null = the default Focusling room). */
const ROOM_TESTS: readonly { name: string; color: string | null }[] = [
  { name: 'Default', color: null },
  { name: 'White', color: '#FFFFFF' },
  { name: 'Black', color: '#000000' },
  { name: 'Red', color: '#E53935' },
  { name: 'Green', color: '#2E9E4F' },
  { name: 'Blue', color: '#2F6FE0' },
  { name: 'Yellow', color: '#FFE14D' },
  { name: 'Pink', color: '#FF9CC2' },
  { name: 'Purple', color: '#7A3FC4' },
  { name: 'Gray', color: '#8A8A92' },
];
const DECOR = { wall: 'decor-star-garland', floorLeft: 'decor-potted-plant', floorRight: 'decor-glow-lamp', floorCenter: 'decor-cozy-rug' };

/**
 * Developer-only Character Lab (hidden and route-refused when Developer tools
 * are off): the naked-pet test (species × stage × naked / one accessory / full
 * Look), the expression library, face close-ups and the room comparison board.
 */
export default function CharacterLab() {
  const debug = useDebugToolsEnabled();
  const { width } = useWindowDimensions();
  const [species, setSpecies] = useState<PetSpeciesId>('cloudling');
  const [expression, setExpression] = useState<Exclude<FaceExpression, 'blink'>>('auto');
  const [outfitId, setOutfitId] = useState('naked');
  const [custom, setCustom] = useState('#6E9B4E');
  const [decor, setDecor] = useState(true);
  if (!debug) return <Redirect href="/" />;
  const outfit = OUTFITS.find((o) => o.id === outfitId)!.outfit;
  const avail = Math.min(width, 1100) - spacing.lg * 2;
  const cell = Math.min(140, (avail - 90) / 4);
  const roomCell = Math.min(200, (avail - spacing.sm * 3) / (avail > 700 ? 4 : 2));

  const chips = <T extends string>(items: readonly { id: T; name: string }[], value: T, set: (v: T) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {items.map((it) => (
        <Pressable key={it.id} onPress={() => set(it.id)} style={[styles.chip, it.id === value && styles.chipOn]} accessibilityRole="tab" accessibilityState={{ selected: it.id === value }}>
          <Text style={[styles.chipText, it.id === value && styles.chipTextOn]}>{it.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <Screen scroll width="wide">
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel="Back">
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={typography.title}>Character Lab</Text>

      <Text style={styles.h}>Naked pet test</Text>
      <Text style={styles.note}>If every cosmetic disappeared, would this still be a character people would want? Row A is the test.</Text>
      {STARTER_SPECIES_ORDER.map((sp) => (
        <View key={sp} style={styles.block}>
          <Text style={styles.speciesName}>{PET_SPECIES[sp].name}</Text>
          {TEST_ROWS.map((o) => (
            <View key={o.id} style={styles.row}>
              <Text style={styles.label}>{o.name}</Text>
              {STAGES.map((stage) => (
                <View key={stage} style={[styles.cell, { width: cell, height: cell }]} accessible accessibilityLabel={`${sp} ${stage} ${o.id}`}>
                  <PetArt speciesId={sp} stage={stage} mood="content" equipped={o.outfit} size={cell * STAGE_SCALE[stage]} />
                  <Text style={styles.stage}>{stage}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}

      <Text style={styles.h}>Inspect</Text>
      {chips(STARTER_SPECIES_ORDER.map((id) => ({ id, name: PET_SPECIES[id].name })), species, setSpecies)}
      {chips(EXPRESSIONS.map((id) => ({ id, name: id === 'auto' ? 'content' : id })), expression, setExpression)}
      {chips(OUTFITS.map((o) => ({ id: o.id, name: o.name })), outfitId, setOutfitId)}

      <View style={styles.faceRow}>
        <View style={styles.face} accessible accessibilityLabel={`close-up ${species} ${expression}`}>
          <PetArt speciesId={species} stage="adult" mood="content" expression={expression} equipped={outfit} size={Math.min(320, avail * 0.9)} />
        </View>
      </View>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        {EXPRESSIONS.map((e) => (
          <View key={e} style={[styles.cell, { width: cell * 0.9, height: cell * 0.9 }]} accessible accessibilityLabel={`expression ${e}`}>
            <PetArt speciesId={species} stage="adult" mood="content" expression={e} size={cell * 0.8} />
            <Text style={styles.stage}>{e === 'auto' ? 'content' : e}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.h}>Room comparison board</Text>
      <Pressable onPress={() => setDecor((d) => !d)} accessibilityRole="switch" accessibilityState={{ checked: decor }} style={[styles.chip, decor && styles.chipOn, { alignSelf: 'flex-start' }]}>
        <Text style={[styles.chipText, decor && styles.chipTextOn]}>{decor ? 'Decorations on' : 'Decorations off'}</Text>
      </Pressable>
      <View style={styles.rooms}>
        {[...ROOM_TESTS, { name: `Custom ${custom}`, color: custom }].map((r) => (
          <View key={r.name} style={{ width: roomCell }} accessible accessibilityLabel={`room ${r.name}`}>
            <RoomScene equipped={decor ? DECOR : {}} roomColor={r.color} height={roomCell * 0.9}>
              <PetArt speciesId={species} stage="adult" mood="content" expression={expression} equipped={outfit} size={roomCell * 0.55} />
            </RoomScene>
            <Text style={styles.roomName}>{r.name}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.h}>Custom room colour</Text>
      <RoomColorPicker color={custom} onChange={setCustom} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { ...typography.label, fontSize: 16, color: colors.primaryDark },
  h: { ...typography.heading, fontSize: 18, marginTop: spacing.sm },
  note: { ...typography.label, fontWeight: '600' },
  block: { gap: spacing.xs },
  speciesName: { ...typography.label, textTransform: 'uppercase', letterSpacing: 0.8 },
  chips: { gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, minHeight: 40, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontWeight: '800', color: colors.text },
  chipTextOn: { color: colors.white },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { width: 76, ...typography.label, fontSize: 11 },
  cell: { alignItems: 'center', justifyContent: 'flex-end', backgroundColor: colors.surface, borderRadius: radius.md },
  stage: { ...typography.label, fontSize: 10 },
  faceRow: { alignItems: 'center' },
  face: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.sm },
  rooms: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  roomName: { ...typography.label, fontSize: 11, textAlign: 'center', marginTop: 2 },
});
