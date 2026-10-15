import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { services } from '@/services';
import { testStoreControls, type TestOutcome } from '@/services/store';
import { useEntitlement, useEntitlementStore } from '@/state';
import { Button, ConfirmDialog, Pressable, colors, radius, spacing, typography } from '@/ui';
import { describeEntitlement } from './premiumCopy';

const OUTCOMES: { id: Exclude<TestOutcome, 'pending'>; label: string }[] = [
  { id: 'success', label: 'Succeeds' },
  { id: 'failed', label: 'Fails' },
  { id: 'cancelled', label: 'Is cancelled' },
];

/**
 * TEST BUILDS ONLY (the test store exists only when test purchases are
 * enabled at build time). Simulates buying Premium: no payment details, no
 * charge, no receipt. The result persists on this device until reset.
 */
export function TestPurchasePanel({ productId }: { productId: string | undefined }) {
  const store = testStoreControls(services.store);
  const entitlement = useEntitlement();
  const busy = useEntitlementStore((s) => s.busy);
  const storeAvailable = useEntitlementStore((s) => s.storeAvailable);
  const { purchase, restore } = useEntitlementStore.getState();
  const [confirm, setConfirm] = useState(false);
  const [outcome, setOutcome] = useState<Exclude<TestOutcome, 'pending'>>('success');
  if (!store) return null;
  const active = entitlement.status === 'active' && entitlement.tier !== 'free';

  const buy = async () => {
    if (!productId) return;
    store.setNextOutcome(outcome);
    await purchase(productId);
    setOutcome('success');
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.badge}>TEST BUILD</Text>
      <Text style={styles.title}>Simulated purchases</Text>
      <Text style={styles.body}>Nothing is charged and no payment details are asked for. Test Premium stays on this device until you reset it.</Text>
      <Text style={styles.status} accessibilityLabel={`Test status: ${describeEntitlement(entitlement, storeAvailable)}`}>{`Status: ${describeEntitlement(entitlement, storeAvailable)}`}</Text>

      {!active && (
        <>
          <Text style={styles.label}>Next purchase</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {OUTCOMES.map((o) => (
              <Pressable key={o.id} onPress={() => setOutcome(o.id)} style={[styles.chip, outcome === o.id && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ selected: outcome === o.id }} accessibilityLabel={`Next purchase ${o.label.toLowerCase()}`} sound="select">
                <Text style={[styles.chipText, outcome === o.id && styles.chipTextOn]}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
          <Button label={busy ? 'Working…' : 'Simulate Premium Purchase'} onPress={() => setConfirm(true)} disabled={!productId || busy} sound={null} />
        </>
      )}

      <View style={styles.row}>
        {active && <Button label="Expire Premium" variant="secondary" onPress={() => void store.simulate('expired')} style={styles.flex} />}
        <Button
          label="Restore active Premium"
          variant="secondary"
          onPress={async () => {
            if (!productId) return;
            await store.prepareRestore(productId);
            await restore();
          }}
          style={styles.flex}
        />
        <Button label="Reset to Free" variant="ghost" onPress={() => void store.reset()} style={styles.flex} />
      </View>

      <ConfirmDialog
        visible={confirm}
        title="Test purchase"
        cancelLabel="Not now"
        confirmLabel="Simulate purchase"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          void buy();
        }}
      >
        <Text style={styles.body}>{`This is a test purchase. No payment is collected and nothing is charged. ${outcome === 'success' ? 'Premium will turn on for this device.' : outcome === 'failed' ? 'It will fail, and Premium stays off.' : 'It will be cancelled, and Premium stays off.'}`}</Text>
      </ConfirmDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.sm, borderRadius: radius.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.primarySoft, padding: spacing.md },
  badge: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '900', letterSpacing: 1, color: colors.white, backgroundColor: colors.primaryDark, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  title: { ...typography.heading, fontSize: 18 },
  body: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20 },
  label: { ...typography.label, color: colors.text },
  status: { fontSize: 15, fontWeight: '900', color: colors.primaryDark },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border },
  chipOn: { borderColor: colors.primaryDark },
  chipText: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
  chipTextOn: { color: colors.primaryDark },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  flex: { flexGrow: 1, flexBasis: 140 },
});
