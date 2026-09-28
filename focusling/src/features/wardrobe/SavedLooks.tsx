import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LOOK_NAME_MAX_LENGTH, lookName } from '@/core';
import { useGameStore, usePetView } from '@/state';
import { PetArt, TabIcon, colors, radius, spacing, typography } from '@/ui';

/**
 * My Looks: three personal outfit slots (separate from collection Looks).
 * Save the current outfit, wear it, overwrite, rename or delete.
 */
export function SavedLooks({ onWear }: { onWear?: () => void }) {
  const looks = useGameStore((s) => s.save?.cosmetics.looks ?? []);
  const view = usePetView();
  const { applyLook, saveLook, clearLook, renameLook } = useGameStore.getState();
  const [selected, setSelected] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  if (!view) return null;
  const firstEmpty = looks.findIndex((l) => l === null);
  const sel = selected !== null ? looks[selected] : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {looks.map((look, i) =>
          look ? (
            <Pressable
              key={i}
              onPress={() => {
                applyLook(i);
                setSelected(i);
                setRenaming(null);
                onWear?.();
              }}
              style={[styles.card, selected === i && styles.cardOn]}
              accessibilityRole="button"
              accessibilityLabel={`Wear ${lookName(look, i)}`}
            >
              <PetArt speciesId={view.pet.speciesId} stage={view.progression.stage} mood="content" equipped={look.equipped} size={64} />
              <Text style={styles.name} numberOfLines={1}>
                {lookName(look, i)}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              key={i}
              onPress={() => {
                saveLook(i);
                setSelected(i);
              }}
              style={[styles.card, styles.empty]}
              accessibilityRole="button"
              accessibilityLabel={i === firstEmpty ? 'Save current outfit' : `Save current outfit in slot ${i + 1}`}
            >
              <TabIcon name="plus" color={colors.primaryDark} size={22} />
              <Text style={styles.emptyText}>{i === firstEmpty ? 'Save current' : 'Empty'}</Text>
            </Pressable>
          ),
        )}
      </View>
      {sel && selected !== null && (
        <View style={styles.tools}>
          {renaming !== null ? (
            <>
              <TextInput
                value={renaming}
                onChangeText={setRenaming}
                maxLength={LOOK_NAME_MAX_LENGTH}
                autoFocus
                style={styles.input}
                accessibilityLabel="Look name"
                onSubmitEditing={() => {
                  renameLook(selected, renaming);
                  setRenaming(null);
                }}
              />
              <Tool
                label="Save name"
                onPress={() => {
                  renameLook(selected, renaming);
                  setRenaming(null);
                }}
              />
            </>
          ) : (
            <>
              <Text style={styles.toolsTitle} numberOfLines={1}>
                {lookName(sel, selected)}
              </Text>
              <Tool label="Replace with current" onPress={() => saveLook(selected)} />
              <Tool label="Rename" onPress={() => setRenaming(sel.name ?? '')} />
              <Tool
                label="Delete"
                danger
                onPress={() => {
                  clearLook(selected);
                  setSelected(null);
                }}
              />
            </>
          )}
        </View>
      )}
    </View>
  );
}

function Tool({ label, onPress, danger = false }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.tool} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}>
      <Text style={[styles.toolText, danger && styles.danger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  card: { flex: 1, minHeight: 104, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.xs, borderWidth: 2, borderColor: 'transparent' },
  cardOn: { borderColor: colors.primary },
  name: { fontSize: 12, fontWeight: '800', color: colors.text, maxWidth: '100%' },
  empty: { borderStyle: 'dashed', borderColor: colors.border, backgroundColor: 'transparent', gap: 4 },
  emptyText: { fontSize: 12, fontWeight: '800', color: colors.primaryDark },
  tools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm },
  toolsTitle: { ...typography.label, color: colors.text, flexGrow: 1, flexBasis: 90 },
  tool: { minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primarySoft, justifyContent: 'center' },
  toolText: { fontSize: 13, fontWeight: '800', color: colors.primaryDark },
  danger: { color: colors.danger },
  input: { flex: 1, minHeight: 40, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: 15, fontWeight: '700', color: colors.text },
});
