import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { services } from '@/services';
import { useGameStore } from '@/state';
import { Button, colors, radius, spacing, typography } from '@/ui';
import { formatClockTime } from '@/utils/format';
import { MODE_LABEL } from './protectionCopy';
import { SampleCollectionPanel } from './SampleCollectionPanel';

/**
 * Developer Mode only. Shows the authoritative native protection state (never
 * raw tokens) and test actions. Emergency cleanup is always available here.
 */
export function ProtectionDebugPanel() {
  const status = useGameStore((s) => s.protection);
  const interventions = useGameStore((s) => s.interventionsThisSession);
  const { updateProtection, startFocus, debugSetRemaining, refreshProtection, emergencyProtectionCleanup } = useGameStore.getState();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void refreshProtection();
  }, [refreshProtection]);

  const act = (label: string, fn: () => Promise<unknown>) => async () => {
    try {
      await fn();
      setMessage(label);
    } catch (error) {
      setMessage(`${label} failed: ${(error as Error).message}`);
    }
    void refreshProtection();
  };

  /** Minimum session length is 5 min; start one and leave 60 s on the clock. */
  const oneMinuteTest = (mode: 'selective' | 'wholeApp') => async () => {
    updateProtection({ mode });
    const result = await startFocus(5);
    if (!result.ok) return setMessage(`Start failed: ${result.error}`);
    debugSetRemaining(60_000);
    setMessage(`1-minute ${MODE_LABEL[mode]} test running`);
  };

  const d = status?.detection;
  const rows: [string, string][] = status
    ? [
        ['Platform', status.platform],
        ['Screen Time authorization', status.authorization],
        ['Screen recognition', status.screenRecognition],
        ['Capture', status.captureStatus],
        ['Detector', status.captureStatus === 'running' ? 'active' : 'inactive'],
        ['Latest classification', d?.latest ? `${d.latest.app} / ${d.latest.surface}` : '—'],
        ['Confidence', d?.latest ? d.latest.confidence.toFixed(2) : '—'],
        ['Vote window', d ? `${d.votes}/${d.window}` : '—'],
        ['Last intervention', d?.lastInterventionAt ? formatClockTime(d.lastInterventionAt) : '—'],
        ['Interventions this session', String(interventions)],
        ['Selected apps (count only)', String(status.selectedTargetCount)],
        ['Native session ID', status.currentSessionId ?? '—'],
        ['Shield', status.shieldStatus],
        ['DeviceActivity', status.monitoringStatus],
        ['Protection mode', MODE_LABEL[status.activeMode]],
        ['Last native error', status.lastError ?? '—'],
      ]
    : [];

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Native protection</Text>
      <View style={styles.table} accessibilityLabel="Native protection status">
        {rows.map(([k, v]) => (
          <View key={k} style={styles.row}>
            <Text style={styles.key}>{k}</Text>
            <Text style={styles.value} numberOfLines={1}>
              {v}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        <Button variant="secondary" label="1-min selective test" onPress={oneMinuteTest('selective')} style={styles.cell} />
        <Button variant="secondary" label="1-min whole-app test" onPress={oneMinuteTest('wholeApp')} style={styles.cell} />
        <Button variant="secondary" label="Fake Reel detection" onPress={act('Fake detection sent', services.protection.debug.triggerFakeDetection)} style={styles.cell} />
        <Button variant="secondary" label="Clear native shields" onPress={act('Shields cleared', services.protection.debug.clearShields)} style={styles.cell} />
        <Button variant="secondary" label="Stop capture" onPress={act('Capture stopped', services.protection.debug.stopCapture)} style={styles.cell} />
        <Button variant="secondary" label="Restart capture" onPress={act('Capture restart requested', services.protection.debug.restartCapture)} style={styles.cell} />
        <Button variant="secondary" label="Reconcile state" onPress={act('Reconciled', refreshProtection)} style={styles.cell} />
      </View>
      <Button variant="danger" label="Emergency cleanup" onPress={act('Emergency cleanup done', emergencyProtectionCleanup)} />
      {message && <Text style={styles.message}>{message}</Text>}
      {status?.platform === 'ios' && __DEV__ && <SampleCollectionPanel />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { ...typography.label, color: colors.text },
  table: { backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing.sm, gap: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  key: { ...typography.label, fontSize: 12, fontWeight: '600' },
  value: { fontSize: 12, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { flexGrow: 1, flexBasis: '45%' },
  message: { ...typography.label, fontSize: 12 },
});
