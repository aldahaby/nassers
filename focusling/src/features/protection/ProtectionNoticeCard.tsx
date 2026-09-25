import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '@/state';
import { Button, Card, colors, spacing, typography } from '@/ui';
import { NOTICE_COPY, startErrorMessage } from './protectionCopy';

/** Shown during a session when native protection stopped. The person decides what happens next. */
export function ProtectionNoticeCard() {
  const notice = useGameStore((s) => s.protectionNotice);
  const mode = useGameStore((s) => s.save?.focus.active?.protectionMode);
  const { restartProtection, switchSessionToWholeApp, dismissProtectionNotice } = useGameStore.getState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!notice) return null;
  const copy = NOTICE_COPY[notice];

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    const result = await fn();
    setBusy(false);
    setError(result.ok ? null : startErrorMessage(result.error ?? 'native-error'));
  };

  return (
    <Card style={styles.card}>
      <Text style={typography.heading}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.actions}>
        <Button label={busy ? 'Starting…' : 'Restart protection'} onPress={() => run(restartProtection)} disabled={busy} />
        {mode === 'selective' && (
          <Button label="Block Instagram entirely instead" variant="secondary" onPress={() => run(switchSessionToWholeApp)} disabled={busy} />
        )}
        <Button label="Continue without protection" variant="ghost" onPress={dismissProtectionNotice} disabled={busy} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch' },
  body: { ...typography.body, fontSize: 15, color: colors.textMuted },
  error: { ...typography.label, color: colors.danger },
  actions: { gap: spacing.xs },
});
