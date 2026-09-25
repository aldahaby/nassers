import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ProtectionMode } from '@/core';
import {
  MODE_LABEL,
  PRIVACY_NOTE,
  SCREEN_RECOGNITION_EXPLAINER,
  SCREEN_TIME_EXPLAINER,
} from '@/features/protection/protectionCopy';
import { useGameStore } from '@/state';
import { Button, Card, Screen, colors, radius, spacing, typography } from '@/ui';

const MODES: readonly ProtectionMode[] = ['none', 'selective', 'wholeApp'];
const MODE_HELP: Record<ProtectionMode, string> = {
  none: 'No blocking. Focus on the honor system.',
  selective: 'Instagram stays usable (DMs, feed, profiles). Reels are interrupted during a session.',
  wholeApp: 'Instagram is blocked for the whole session.',
};

/** Detailed protection setup, kept off the main focus screen. */
export default function ProtectionScreen() {
  const settings = useGameStore((s) => s.save?.protection);
  const status = useGameStore((s) => s.protection);
  const sessionActive = useGameStore((s) => Boolean(s.save?.focus.active));
  const { updateProtection, requestProtectionAuthorization, selectProtectedApps, refreshProtection } = useGameStore.getState();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void refreshProtection();
  }, [refreshProtection]);

  if (!settings) return null;
  const authorized = status?.authorization === 'approved';
  const count = status?.selectedTargetCount ?? 0;
  const recognitionUnavailable = status?.screenRecognition === 'unavailable';

  const run = (key: string, fn: () => Promise<void>) => async () => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/focus'))} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Focus protection</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {status?.platform === 'mock' && (
          <Text style={styles.mockNote}>Simulated on this device: nothing is actually blocked.</Text>
        )}
        {sessionActive && <Text style={styles.mockNote}>Changes apply to your next session.</Text>}

        <Card>
          <Text style={styles.cardTitle}>Instagram</Text>
          <View style={styles.modes} accessibilityRole="radiogroup">
            {MODES.map((mode) => {
              const selected = settings.mode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => updateProtection({ mode })}
                  style={[styles.mode, selected && styles.modeOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.modeLabel, selected && styles.modeLabelOn]}>{MODE_LABEL[mode]}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.help}>{MODE_HELP[settings.mode]}</Text>
        </Card>

        {settings.mode !== 'none' && (
          <Card>
            <Text style={styles.cardTitle}>Setup</Text>
            <ChecklistRow
              done={authorized}
              title="Screen Time access"
              body={SCREEN_TIME_EXPLAINER}
              action={!authorized ? { label: status?.authorization === 'denied' ? 'Try again' : 'Allow', onPress: run('auth', requestProtectionAuthorization) } : undefined}
              busy={busy === 'auth'}
            />
            <ChecklistRow
              done={count > 0}
              title={count > 0 ? `${count} app${count === 1 ? '' : 's'} selected` : 'Choose Instagram'}
              body="Pick Instagram in Apple's app picker. Focusling never sees which apps you chose."
              action={authorized ? { label: count > 0 ? 'Change' : 'Choose', onPress: run('pick', selectProtectedApps) } : undefined}
              busy={busy === 'pick'}
            />
            {settings.mode === 'selective' && (
              <ChecklistRow
                done={status?.screenRecognition === 'available'}
                title="Screen recognition"
                body={
                  recognitionUnavailable
                    ? "Screen recognition isn't available on this iPhone. You can block Instagram entirely instead."
                    : `${SCREEN_RECOGNITION_EXPLAINER} iOS asks you to confirm when a session starts.`
                }
                action={recognitionUnavailable ? { label: 'Use Entire app', onPress: async () => updateProtection({ mode: 'wholeApp' }) } : undefined}
              />
            )}
          </Card>
        )}

        {settings.mode === 'selective' && (
          <Card>
            <Text style={styles.cardTitle}>Privacy</Text>
            <Text style={styles.help}>{PRIVACY_NOTE}</Text>
            <Text style={styles.help}>
              Opening a Reel isn&apos;t a failed session. Focusling closes it, and your session, rewards and streak continue.
            </Text>
          </Card>
        )}

        <Button label="Done" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/focus'))} />
      </ScrollView>
    </Screen>
  );
}

function ChecklistRow({
  done,
  title,
  body,
  action,
  busy,
}: {
  done: boolean;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void | Promise<void> };
  busy?: boolean;
}) {
  return (
    <View style={styles.check}>
      <Text style={[styles.checkMark, done && styles.checkMarkDone]}>{done ? '✓' : '○'}</Text>
      <View style={styles.checkText}>
        <Text style={styles.checkTitle}>{title}</Text>
        <Text style={styles.checkBody}>{body}</Text>
      </View>
      {action && (
        <Pressable onPress={() => void action.onPress()} style={styles.checkAction} disabled={busy} accessibilityRole="button" accessibilityLabel={`${action.label}: ${title}`}>
          <Text style={styles.checkActionLabel}>{busy ? '…' : action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 17, fontWeight: '800', color: colors.primaryDark, minWidth: 64 },
  title: { ...typography.heading, flex: 1, textAlign: 'center' },
  spacer: { minWidth: 64 },
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  mockNote: { ...typography.label, textAlign: 'center' },
  cardTitle: { ...typography.heading, fontSize: 18 },
  modes: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, padding: 4 },
  mode: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, alignItems: 'center' },
  modeOn: { backgroundColor: colors.surface },
  modeLabel: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
  modeLabelOn: { color: colors.primaryDark },
  help: { ...typography.body, fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  check: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  checkMark: { fontSize: 18, fontWeight: '900', color: colors.textMuted, width: 22, textAlign: 'center' },
  checkMarkDone: { color: colors.health },
  checkText: { flex: 1, gap: 2 },
  checkTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  checkBody: { ...typography.label, fontWeight: '600', fontSize: 12, lineHeight: 17 },
  checkAction: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  checkActionLabel: { color: colors.white, fontWeight: '800', fontSize: 13 },
});
