import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { DEFAULT_ROOM_COLOR } from '@/config/room';
import { RoomColorPicker } from '@/features/room/RoomColorPicker';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { playSound } from '@/services/audio';
import { useEquipped, useGameStore, usePetView, useRoomColor } from '@/state';
import { AnimatedPet, Button, Pressable, RoomScene, Screen, colors, spacing, typography } from '@/ui';

/**
 * Room Studio: choose any colour for your Focusling's room. Free for everyone
 * (Self Mode and Child View, no PIN, no coins or milestones). The preview
 * updates live; nothing is saved until Done. Only the room changes colour,
 * never the app's own interface.
 */
export default function RoomStudio() {
  const view = usePetView();
  const equipped = useEquipped();
  const saved = useRoomColor();
  const setRoomColor = useGameStore((s) => s.setRoomColor);
  const routes = useAppRoutes();
  const { width } = useWindowDimensions();
  const [draft, setDraft] = useState<string>(saved ?? DEFAULT_ROOM_COLOR);
  if (!view) return null;
  const { pet, progression, mood } = view;
  const petSize = Math.min(220, width * 0.5);
  const leave = () => (router.canGoBack() ? router.back() : router.replace(routes.pet));

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

      <RoomScene equipped={equipped} roomColor={draft} height={petSize * 1.45}>
        <AnimatedPet speciesId={pet.speciesId} stage={progression.stage} mood={mood} equipped={equipped} size={petSize} accessibilityLabel={`${pet.name} in the room preview`} />
      </RoomScene>

      <RoomColorPicker color={draft} onChange={setDraft} />

      <View style={styles.actions}>
        <Button label="Reset" variant="ghost" onPress={() => setDraft(DEFAULT_ROOM_COLOR)} style={styles.action} accessibilityHint="Back to the default Focusling room" />
        <Button label="Cancel" variant="secondary" onPress={leave} style={styles.action} />
        <Button
          label="Done"
          sound={null}
          onPress={() => {
            playSound('confirm');
            setRoomColor(draft.toUpperCase() === DEFAULT_ROOM_COLOR ? null : draft);
            leave();
          }}
          style={styles.action}
        />
      </View>
      <Text style={styles.note}>The room is yours to style. The rest of Focusling keeps its usual colours so everything stays easy to read.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 34, fontWeight: '700', color: colors.primaryDark, marginTop: -4 },
  headerText: { flex: 1 },
  subtitle: { ...typography.label },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 90 },
  note: { ...typography.label, textAlign: 'center', lineHeight: 19 },
});
