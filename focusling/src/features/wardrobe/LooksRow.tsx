import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useGameStore, usePetView } from '@/state';
import { PetArt, colors, radius, spacing, typography } from '@/ui';

/** Saved outfits: tap a filled slot to wear it, "Save" to store the current look. */
export function LooksRow() {
  const looks = useGameStore((s) => s.save?.cosmetics.looks ?? []);
  const view = usePetView();
  const { applyLook, saveLook } = useGameStore.getState();
  if (!view) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Looks</Text>
      <View style={styles.row}>
        {looks.map((look, i) => (
          <View key={i} style={styles.slot}>
            {look ? (
              <Pressable
                onPress={() => applyLook(i)}
                style={styles.card}
                accessibilityRole="button"
                accessibilityLabel={`Wear look ${i + 1}`}
              >
                <PetArt speciesId={view.pet.speciesId} stage={view.progression.stage} mood="content" equipped={look.equipped} size={56} />
                <Text style={styles.cardLabel}>Look {i + 1}</Text>
              </Pressable>
            ) : (
              <View style={[styles.card, styles.empty]}>
                <Text style={styles.emptyText}>Empty</Text>
              </View>
            )}
            <Pressable onPress={() => saveLook(i)} accessibilityRole="button" accessibilityLabel={`Save current outfit as look ${i + 1}`} hitSlop={6}>
              <Text style={styles.save}>{look ? 'Replace' : 'Save'}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { ...typography.label, textTransform: 'uppercase', letterSpacing: 0.8 },
  row: { flexDirection: 'row', gap: spacing.md },
  slot: { flex: 1, alignItems: 'center', gap: 4 },
  card: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: 88, borderRadius: radius.md, backgroundColor: colors.surface, paddingVertical: spacing.xs },
  cardLabel: { fontSize: 12, fontWeight: '800', color: colors.text },
  empty: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: 'transparent' },
  emptyText: { ...typography.label },
  save: { fontSize: 13, fontWeight: '800', color: colors.primaryDark, paddingVertical: 4 },
});
