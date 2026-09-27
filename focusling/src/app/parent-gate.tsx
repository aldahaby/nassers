import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PinPad } from '@/features/family/PinPad';
import { useNow } from '@/hooks/useNow';
import { useDebugToolsEnabled, useGameStore } from '@/state';
import { Button, Screen, colors, spacing, typography } from '@/ui';

/**
 * Parent Gate: the only way from Child View to the parent area. A local PIN
 * with attempt throttling; see docs/FAMILY_MODE.md for its limits.
 */
export default function ParentGateScreen() {
  const family = useGameStore((s) => s.save?.family);
  const petName = useGameStore((s) => s.save?.pet?.name ?? 'your pet');
  const debug = useDebugToolsEnabled();
  const { unlockParentView, setParentPin, debugEnterParentView } = useGameStore.getState();
  const now = useNow(1000);
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [firstNewPin, setFirstNewPin] = useState<string | null>(null);

  if (!family) return <Redirect href="/" />;
  const lockedUntil = family.gate?.lockedUntil ?? 0;
  const lockedFor = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const locked = lockedFor > 0;

  const openParent = () => router.dismissTo('/parent');
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/(child)'));

  const onComplete = (pin: string) => {
    setValue('');
    // No PIN yet (only after a developer reset): create one first.
    if (!family.gate) {
      if (firstNewPin === null) {
        setFirstNewPin(pin);
        setMessage(null);
        return;
      }
      if (pin !== firstNewPin) {
        setFirstNewPin(null);
        setMessage("Those PINs didn't match. Let's try again.");
        return;
      }
      if (setParentPin(pin).ok && unlockParentView(pin).ok) openParent();
      return;
    }
    const result = unlockParentView(pin);
    if (result.ok) return openParent();
    if (result.reason === 'wrong') {
      setMessage(
        result.attemptsBeforePause > 0
          ? `That PIN isn't right. ${result.attemptsBeforePause} more ${result.attemptsBeforePause === 1 ? 'try' : 'tries'} before a short pause.`
          : "That PIN isn't right.",
      );
    } else if (result.reason === 'locked') {
      setMessage(null);
    }
  };

  const creating = !family.gate;
  const title = creating ? (firstNewPin === null ? 'Create a parent PIN' : 'Enter it once more') : 'Grown-ups only';
  const body = creating
    ? 'The parent PIN was reset. Choose 4 new digits.'
    : 'Enter the parent PIN to open settings and missions.';

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.lock}>🔒</Text>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.body}>{body}</Text>
        <Text style={styles.message} accessibilityLiveRegion="polite">
          {locked ? `Too many tries. Try again in ${formatWait(lockedFor)}.` : (message ?? ' ')}
        </Text>
      </View>
      <PinPad value={value} onChange={setValue} onComplete={onComplete} disabled={locked} />
      <View style={styles.footer}>
        <Button variant="ghost" label={`Back to ${petName}`} onPress={leave} />
        {debug && (
          <Button
            variant="secondary"
            label="Enter Parent View (developer)"
            onPress={() => {
              if (debugEnterParentView()) openParent();
            }}
          />
        )}
      </View>
    </Screen>
  );
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center', gap: spacing.xl },
  header: { alignItems: 'center', gap: spacing.sm },
  lock: { fontSize: 36 },
  title: { ...typography.title, textAlign: 'center' },
  body: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  message: { ...typography.label, color: colors.danger, textAlign: 'center', minHeight: 18 },
  footer: { gap: spacing.sm, alignSelf: 'stretch', maxWidth: 420, width: '100%', marginHorizontal: 'auto' },
});
