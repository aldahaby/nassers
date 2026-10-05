import { router, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useEntitlement, useEntitlementStore } from '@/state';
import { Button, Card, PremiumMark, colors, spacing, typography } from '@/ui';
import { describeEntitlement } from './premiumCopy';

/**
 * Premium status with Restore and Manage, for Settings and Parent settings.
 * Never shown in Child View. Restore calls AppStore.sync on iOS (the mock in dev).
 */
export function PremiumStatusCard() {
  const entitlement = useEntitlement();
  const storeAvailable = useEntitlementStore((s) => s.storeAvailable);
  const storeKind = useEntitlementStore((s) => s.storeKind);
  const busy = useEntitlementStore((s) => s.busy);
  const message = useEntitlementStore((s) => s.message);
  const { restore, manageSubscription } = useEntitlementStore.getState();
  const active = entitlement.status === 'active' && entitlement.source !== 'devOverride';

  return (
    <Card>
      <View style={styles.head}>
        <Text style={typography.heading}>Focusling Premium</Text>
        <PremiumMark compact />
      </View>
      <Text style={styles.status} accessibilityLabel={`Premium status: ${describeEntitlement(entitlement, storeAvailable)}`}>
        {describeEntitlement(entitlement, storeAvailable)}
      </Text>
      {storeKind === 'mock' && <Text style={styles.muted}>Demo store: no real purchases happen on this build.</Text>}
      <Button variant="secondary" label={active ? 'What’s included' : 'See Premium'} onPress={() => router.push('/premium' as Href)} />
      <View style={styles.row}>
        <Button variant="ghost" label={busy ? 'Restoring…' : 'Restore purchases'} disabled={busy} onPress={() => void restore()} style={styles.cell} />
        <Button variant="ghost" label="Manage subscription" onPress={() => void manageSubscription()} style={styles.cell} />
      </View>
      {message && (
        <Text style={styles.muted} accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  status: { ...typography.body, fontSize: 15, fontWeight: '700' },
  muted: { ...typography.body, fontSize: 14, color: colors.textMuted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { flexGrow: 1, flexBasis: 140 },
});
