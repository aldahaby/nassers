import { useState } from 'react';
import { Text, View } from 'react-native';
import type { AccessTier } from '@/core';
import { describeEntitlement } from '@/features/premium/premiumCopy';
import { services } from '@/services';
import { MockStoreService } from '@/services/store';
import { useDebugToolsEnabled, useEntitlement, useEntitlementStore } from '@/state';
import { Button, typography } from '@/ui';
import { devStyles as styles } from './devStyles';

const TIERS: readonly { tier: AccessTier | null; label: string }[] = [
  { tier: null, label: 'Use store' },
  { tier: 'free', label: 'Force Free' },
  { tier: 'premium', label: 'Force Premium' },
  { tier: 'premiumStudentPromo', label: 'Force Student' },
];

/**
 * QA for Premium: a memory-only tier override, mock store outcomes and the
 * student-offer demo. Every action is refused by the store unless Developer
 * tools are on, and the override clears when they're turned off.
 */
export function PremiumDevTools() {
  const debug = useDebugToolsEnabled();
  const entitlement = useEntitlement();
  const storeAvailable = useEntitlementStore((s) => s.storeAvailable);
  const override = useEntitlementStore((s) => s.devOverride);
  const studentOffer = useEntitlementStore((s) => s.studentOffer);
  const { setDevOverride, setStudentOffer } = useEntitlementStore.getState();
  const mock = services.store instanceof MockStoreService ? services.store : null;
  const [note, setNote] = useState<string | null>(null);

  return (
    <View style={{ gap: 8 }}>
      <Text style={typography.heading}>Premium (QA)</Text>
      <Text style={styles.status} accessibilityLabel="Entitlement status">
        {describeEntitlement(entitlement, storeAvailable)} · store: {services.store.kind}
      </Text>
      <View style={styles.grid}>
        {TIERS.map((t) => (
          <Button
            key={t.label}
            variant={override === t.tier ? 'primary' : 'secondary'}
            label={t.label}
            accessibilityHint={override === t.tier ? 'Selected' : undefined}
            onPress={() => setDevOverride(t.tier, debug)}
            style={styles.cell}
          />
        ))}
      </View>
      {mock && (
        <>
          <Text style={styles.muted}>Demo store: next purchase / store events</Text>
          <View style={styles.grid}>
            {(['pending', 'cancelled', 'failed'] as const).map((o) => (
              <Button
                key={o}
                variant="secondary"
                label={`Next: ${o}`}
                onPress={() => {
                  mock.nextOutcome = o;
                  setNote(`The next demo purchase will be ${o}.`);
                }}
                style={styles.cell}
              />
            ))}
            {(['expired', 'revoked'] as const).map((s) => (
              <Button
                key={s}
                variant="secondary"
                label={`Simulate ${s}`}
                onPress={() => {
                  mock.simulate(s);
                  setNote(`Demo store reported: ${s}.`);
                }}
                style={styles.cell}
              />
            ))}
          </View>
        </>
      )}
      <Button
        variant="secondary"
        label={studentOffer === 'eligible-mock' ? 'Hide student offer demo' : 'Show student offer demo'}
        onPress={() => setStudentOffer(studentOffer === 'eligible-mock' ? 'none' : 'eligible-mock', debug)}
      />
      <Text style={styles.muted}>The student demo only shows how an eligible offer would look on the Premium screen. There is no verification in this build.</Text>
      {note && <Text style={styles.muted}>{note}</Text>}
    </View>
  );
}
