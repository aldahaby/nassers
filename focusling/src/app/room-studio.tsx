import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { DEFAULT_ROOM_COLOR } from '@/config/room';
import { ROOM_THEMES, getRoomTheme } from '@/config/roomThemes';
import { RoomColorPicker } from '@/features/room/RoomColorPicker';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { playSound } from '@/services/audio';
import { useCapabilities, useEquipped, useGameStore, useIsChildView, usePetView, useRoomColor, useRoomTheme } from '@/state';
import { AnimatedPet, Button, PremiumMark, Pressable, RoomScene, Screen, colors, radius, spacing, typography } from '@/ui';

/**
 * Room Studio: choose any colour for your Focusling's room. Free for everyone
 * (Self Mode and Child View, no PIN, no coins or milestones). The preview
 * updates live; nothing is saved until Done. Only the room changes colour,
 * never the app's own interface.
 *
 * Premium themes (whole-room treatments) sit on top: anyone can preview them
 * here; only people with Premium can keep one. Done always saves the colour.
 */
export default function RoomStudio() {
  const view = usePetView();
  const equipped = useEquipped();
  const saved = useRoomColor();
  const savedTheme = useRoomTheme();
  const setRoomColor = useGameStore((s) => s.setRoomColor);
  const setRoomTheme = useGameStore((s) => s.setRoomTheme);
  const caps = useCapabilities();
  const childView = useIsChildView();
  const routes = useAppRoutes();
  const { width } = useWindowDimensions();
  const [draft, setDraft] = useState<string>(saved ?? DEFAULT_ROOM_COLOR);
  const [draftTheme, setDraftTheme] = useState<string | null>(savedTheme);
  if (!view) return null;
  const { pet, progression, mood } = view;
  const petSize = Math.min(220, width * 0.5);
  const leave = () => (router.canGoBack() ? router.back() : router.replace(routes.pet));
  const theme = getRoomTheme(draftTheme);
  const previewOnly = Boolean(theme) && !caps.canUsePremiumRoomThemes;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable onPress={leave} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={typography.title} accessibilityRole="header">
            Room Studio
          </Text>
          <Text style={styles.subtitle}>Any colour you like. Always free.</Text>
        </View>
      </View>

      <RoomScene equipped={equipped} roomColor={draft} theme={draftTheme} height={petSize * 1.45}>
        <AnimatedPet speciesId={pet.speciesId} stage={progression.stage} mood={mood} equipped={equipped} size={petSize} accessibilityLabel={`${pet.name} in the room preview`} />
      </RoomScene>

      <View style={styles.themeHead}>
        <Text style={styles.sectionTitle}>Themes</Text>
        <PremiumMark compact />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themes} accessibilityRole="radiogroup" accessibilityLabel="Room themes">
        <ThemeChip label="My colour" selected={!draftTheme} onPress={() => setDraftTheme(null)} roomColor={draft} />
        {ROOM_THEMES.map((t) => (
          <ThemeChip key={t.id} label={t.name} premium={t.access === 'premium'} selected={draftTheme === t.id} onPress={() => setDraftTheme(t.id)} theme={t.id} />
        ))}
      </ScrollView>

      {theme ? (
        <View style={styles.themeCard} accessibilityLiveRegion="polite">
          <Text style={styles.themeName}>{theme.name}</Text>
          <Text style={styles.themeText}>{theme.description}</Text>
          {previewOnly ? (
            <>
              <Text style={styles.themeText}>Previewing. Themes are included with Focusling Premium. Done keeps your colour.</Text>
              {!childView && <Button variant="secondary" label="See Premium" onPress={() => router.push('/premium' as Href)} />}
            </>
          ) : (
            <Text style={styles.themeText}>Your colour is kept for when you switch back to My colour.</Text>
          )}
        </View>
      ) : (
        <RoomColorPicker color={draft} onChange={setDraft} />
      )}

      <View style={styles.actions}>
        <Button
          label="Reset"
          variant="ghost"
          onPress={() => {
            setDraft(DEFAULT_ROOM_COLOR);
            setDraftTheme(null);
          }}
          style={styles.action}
          accessibilityHint="Back to the default Focusling room"
        />
        <Button label="Cancel" variant="secondary" onPress={leave} style={styles.action} />
        <Button
          label="Done"
          sound={null}
          onPress={() => {
            playSound('confirm');
            setRoomColor(draft.toUpperCase() === DEFAULT_ROOM_COLOR ? null : draft);
            // A theme is kept only with Premium; a preview never changes the saved theme.
            if (caps.canUsePremiumRoomThemes) setRoomTheme(draftTheme);
            leave();
          }}
          style={styles.action}
        />
      </View>
      <Text style={styles.note}>The room is yours to style. The rest of Focusling keeps its usual colours so everything stays easy to read.</Text>
    </Screen>
  );
}

function ThemeChip({
  label,
  selected,
  premium,
  onPress,
  roomColor,
  theme,
}: {
  label: string;
  selected: boolean;
  premium?: boolean;
  onPress: () => void;
  roomColor?: string;
  theme?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      sound="select"
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}${premium ? ', Premium theme' : ''}`}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <View style={styles.chipArt}>
        <RoomScene equipped={{}} roomColor={roomColor} theme={theme} height={64}>
          <View />
        </RoomScene>
      </View>
      <Text style={styles.chipLabel} numberOfLines={2}>
        {label}
      </Text>
      {premium && <PremiumMark compact />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  themeHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { ...typography.label, textTransform: 'uppercase', letterSpacing: 0.8 },
  themes: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: { width: 112, padding: 6, gap: 4, borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.primary },
  chipArt: { borderRadius: radius.sm, overflow: 'hidden' },
  chipLabel: { fontSize: 13, fontWeight: '800', color: colors.text },
  themeCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  themeName: { ...typography.heading, fontSize: 18 },
  themeText: { ...typography.body, fontSize: 14, color: colors.textMuted },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 34, fontWeight: '700', color: colors.primaryDark, marginTop: -4 },
  headerText: { flex: 1 },
  subtitle: { ...typography.label },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 90 },
  note: { ...typography.label, textAlign: 'center', lineHeight: 19 },
});
