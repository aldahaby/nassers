import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FocuslingProtectionNative } from '@/services/protection/nativeModule';
import { Button, colors, radius, spacing, typography } from '@/ui';

const LABELS = ['instagram_reels', 'instagram_home', 'instagram_dm', 'instagram_post', 'instagram_profile', 'other'] as const;

/**
 * DEBUG BUILDS ONLY. Lets the developer save labelled, downscaled screenshots
 * from their own phone for training a future detector. Explicit opt-in, visible
 * while active, stored only in the app container, exported manually.
 * The native side refuses these calls in release builds.
 */
export function SampleCollectionPanel() {
  const native = FocuslingProtectionNative;
  const [label, setLabel] = useState<(typeof LABELS)[number]>('instagram_reels');
  const [active, setActive] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [consent, setConsent] = useState(false);

  const refresh = useCallback(async () => {
    if (!native?.debugSampleCounts) return;
    setCounts(await native.debugSampleCounts());
  }, [native]);

  useEffect(() => {
    let alive = true;
    native?.debugSampleCounts?.().then((c) => alive && setCounts(c)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [native]);

  if (!native?.debugSetSampleCollection) return null;

  return (
    <View style={[styles.wrap, active && styles.wrapActive]}>
      <Text style={styles.title}>{active ? `● Collecting "${active}" samples` : 'Detector sample collection (debug)'}</Text>
      <Text style={styles.note}>
        Saves one downscaled screenshot every 2 seconds during a selective session, on this phone only. Avoid DMs, passwords or
        anything private. Nothing is uploaded.
      </Text>
      <View style={styles.labels}>
        {LABELS.map((l) => (
          <Pressable key={l} onPress={() => setLabel(l)} style={[styles.label, label === l && styles.labelOn]} accessibilityRole="radio" accessibilityState={{ selected: label === l }}>
            <Text style={[styles.labelText, label === l && styles.labelTextOn]}>
              {l} ({counts[l] ?? 0})
            </Text>
          </Pressable>
        ))}
      </View>
      {!consent && !active ? (
        <Button variant="secondary" label="I understand: enable collection" onPress={() => setConsent(true)} />
      ) : active ? (
        <Button
          variant="danger"
          label="Stop collecting"
          onPress={async () => {
            await native.debugSetSampleCollection(null);
            setActive(null);
            void refresh();
          }}
        />
      ) : (
        <Button
          variant="secondary"
          label={`Collect "${label}"`}
          onPress={async () => {
            await native.debugSetSampleCollection(label);
            setActive(label);
          }}
        />
      )}
      <View style={styles.row}>
        <Button variant="ghost" label="Export samples" onPress={() => void native.debugExportSamples()} style={styles.cell} />
        <Button
          variant="ghost"
          label="Delete samples"
          onPress={async () => {
            await native.debugDeleteSamples();
            void refresh();
          }}
          style={styles.cell}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  wrapActive: { borderColor: colors.danger, borderStyle: 'solid' },
  title: { ...typography.label, color: colors.text },
  note: { ...typography.label, fontSize: 11, fontWeight: '600' },
  labels: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  label: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4, backgroundColor: colors.surfaceMuted },
  labelOn: { backgroundColor: colors.primary },
  labelText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  labelTextOn: { color: colors.white },
  row: { flexDirection: 'row', gap: spacing.sm },
  cell: { flex: 1 },
});
