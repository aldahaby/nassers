import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CatalogItem } from '@/config/shopCatalog';
import { ItemArt, colors, radius, spacing, typography } from '@/ui';

export interface RowAction {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'quiet';
}

interface Props {
  item: CatalogItem;
  status: string;
  highlighted: boolean;
  actions: RowAction[];
  onOpen: () => void;
}

/** One owned item: art, name, status line and its actions. */
export function OwnedItemRow({ item, status, highlighted, actions, onOpen }: Props) {
  return (
    <View style={[styles.row, highlighted && styles.rowOn]}>
      <Pressable onPress={onOpen} style={styles.main} accessibilityRole="button" accessibilityLabel={`${item.name}. ${status}`} accessibilityHint="Opens item details">
        <View style={[styles.art, highlighted && styles.artOn]}>
          <ItemArt itemId={item.id} size={46} />
        </View>
        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.status, highlighted && styles.statusOn]} numberOfLines={2}>
            {highlighted ? '✓ ' : ''}
            {status}
          </Text>
        </View>
      </Pressable>
      <View style={styles.actions}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            onPress={a.onPress}
            style={[styles.action, a.tone === 'quiet' ? styles.actionQuiet : styles.actionPrimary]}
            accessibilityRole="button"
            accessibilityLabel={`${a.label} ${item.name}`}
          >
            <Text style={[styles.actionLabel, a.tone === 'quiet' ? styles.actionLabelQuiet : styles.actionLabelPrimary]}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, borderWidth: 2, borderColor: 'transparent' },
  rowOn: { borderColor: colors.primarySoft },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  art: { width: 58, height: 58, borderRadius: radius.md, backgroundColor: colors.roomWall, alignItems: 'center', justifyContent: 'center' },
  artOn: { backgroundColor: colors.primarySoft },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  status: { ...typography.label, fontSize: 12, fontWeight: '600' },
  statusOn: { color: colors.primaryDark, fontWeight: '800' },
  actions: { gap: 6 },
  action: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8, alignItems: 'center', minWidth: 84 },
  actionPrimary: { backgroundColor: colors.primary },
  actionQuiet: { backgroundColor: colors.surfaceMuted },
  actionLabel: { fontSize: 13, fontWeight: '800' },
  actionLabelPrimary: { color: colors.white },
  actionLabelQuiet: { color: colors.textMuted },
});
