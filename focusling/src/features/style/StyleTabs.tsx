import { StyleSheet, Text, View } from 'react-native';
import { TabIcon, colors, radius, type TabIconName, Pressable } from '@/ui';

export type StyleTab = 'pieces' | 'looks' | 'collections' | 'reactions';

const TABS: readonly { id: StyleTab; label: string; icon: TabIconName }[] = [
  { id: 'pieces', label: 'Pieces', icon: 'wardrobe' },
  { id: 'looks', label: 'Looks', icon: 'looks' },
  { id: 'collections', label: 'Collections', icon: 'collections' },
  { id: 'reactions', label: 'Reactions', icon: 'reactions' },
];

/** Segmented control for the Wardrobe. Icons above labels so it fits at 320 pt. */
export function StyleTabs({ value, onChange }: { value: StyleTab; onChange: (tab: StyleTab) => void }) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {TABS.map((t) => {
        const active = t.id === value;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            style={[styles.tab, active && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.label}
          >
            <TabIcon name={t.icon} color={active ? colors.white : colors.textMuted} size={20} />
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: 4, gap: 4 },
  // Tabs size to their labels, then share the spare width, so "Collections" never clips at 320 pt (web has no adjustsFontSizeToFit).
  tab: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, gap: 2, paddingHorizontal: 2 },
  tabActive: { backgroundColor: colors.ink },
  label: { fontSize: 12, fontWeight: '800', color: colors.textMuted, letterSpacing: -0.1 },
  labelActive: { color: colors.white },
});
