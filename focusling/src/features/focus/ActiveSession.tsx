import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { previewAbandon, type AbandonPreview } from '@/core';
import {
  useActiveSessionProgress,
  useDebugToolsEnabled,
  useEquipped,
  useGameStore,
  usePetView,
  useSessionStreak,
} from '@/state';
import { AnimatedPet, Card, ConfirmDialog, ProgressRing, Screen, colors, spacing, typography } from '@/ui';
import { formatClockTime, formatCountdown, plural } from '@/utils/format';
import { FocusDevPanel } from './FocusDevPanel';
import { RewardTiles } from './RewardTiles';

/** Seconds between the pet's quiet little "you've got this" smiles. */
const CHEER_EVERY_MS = 45_000;
const CHEER_LENGTH_MS = 1_600;

/**
 * The running session. Deliberately calm: the pet breathes slowly inside a
 * progress ring, smiles now and then, and nothing pops up unless asked.
 */
export function ActiveSession() {
  const view = usePetView();
  const equipped = useEquipped();
  const progress = useActiveSessionProgress();
  const sessionStreak = useSessionStreak();
  const debug = useDebugToolsEnabled();
  const session = useGameStore((s) => s.save?.focus.active ?? null);
  const refresh = useGameStore((s) => s.refresh);
  const endFocus = useGameStore((s) => s.endFocus);
  const { width } = useWindowDimensions();

  const [cheering, setCheering] = useState(false);
  const [confirm, setConfirm] = useState<AbandonPreview | null>(null);

  // Quiet idle state: a brief happy face every so often, no text or sound.
  useEffect(() => {
    let off: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      setCheering(true);
      off = setTimeout(() => setCheering(false), CHEER_LENGTH_MS);
    }, CHEER_EVERY_MS);
    return () => {
      clearInterval(id);
      clearTimeout(off);
    };
  }, []);

  // When the countdown reaches zero, resolve the session (which opens the reward screen).
  const finishing = useRef(false);
  const done = progress !== null && progress.remainingMs <= 0;
  useEffect(() => {
    if (done && !finishing.current) {
      finishing.current = true;
      refresh();
    }
  }, [done, refresh]);

  if (!view || !progress || !session) return null;
  const { pet, progression } = view;
  const ringSize = Math.min(300, width * 0.76);

  const askToEnd = () => {
    const save = useGameStore.getState().save;
    const preview = save ? previewAbandon(save, Date.now()) : null;
    if (preview) setConfirm(preview);
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <Text style={styles.eyebrow}>Focusing with {pet.name}</Text>

      <ProgressRing size={ringSize} progress={progress.progress} strokeWidth={12}>
        <AnimatedPet
          speciesId={pet.speciesId}
          stage={progression.stage}
          mood="content"
          equipped={equipped}
          size={ringSize * 0.56}
          calm
          expression={cheering ? 'delighted' : 'focused'}
          accessibilityLabel={`${pet.name} is focusing with you`}
        />
      </ProgressRing>

      <View style={styles.timerBlock} accessible accessibilityRole="timer" accessibilityLabel={`${formatCountdown(progress.remainingMs)} remaining`}>
        <Text style={styles.timer}>{formatCountdown(progress.remainingMs)}</Text>
        <Text style={styles.timerMeta}>
          {progress.elapsedMinutes} of {session.plannedDurationMinutes} min · ends {formatClockTime(progress.endsAt)}
        </Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>When you finish</Text>
        <RewardTiles
          tiles={[
            { icon: '🪙', value: `+${progress.projected.coins}`, label: 'coins', color: colors.coinDark },
            { icon: '✨', value: `+${progress.projected.xp}`, label: 'XP', color: colors.xp },
            { icon: '🔥', value: `${sessionStreak}`, label: 'in a row', color: colors.streak },
          ]}
        />
      </Card>

      <Pressable onPress={askToEnd} accessibilityRole="button" style={styles.endLink} hitSlop={12}>
        <Text style={styles.endLabel}>End session early</Text>
      </Pressable>

      {debug && <FocusDevPanel mode="active" />}

      <ConfirmDialog
        visible={confirm !== null}
        title="End this session?"
        cancelLabel="Keep focusing"
        confirmLabel="End session"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          endFocus('abandoned');
        }}
      >
        <Text style={styles.dialogBody}>
          {confirm && confirm.coins + confirm.xp > 0
            ? `You'd keep ${plural(confirm.coins, 'coin')} and ${confirm.xp} XP for the ${plural(confirm.focusedMinutes, 'minute')} you've focused so far.`
            : `Sessions pay out after 5 minutes. You can always start a new one.`}
        </Text>
      </ConfirmDialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingTop: spacing.xl },
  eyebrow: { ...typography.label, textTransform: 'uppercase', letterSpacing: 1 },
  timerBlock: { alignItems: 'center', gap: 2 },
  timer: { fontSize: 60, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'], letterSpacing: -1 },
  timerMeta: { ...typography.label, fontVariant: ['tabular-nums'] },
  card: { alignSelf: 'stretch' },
  cardTitle: { ...typography.label, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.8 },
  endLink: { paddingVertical: spacing.sm },
  endLabel: { ...typography.label, color: colors.textMuted, textDecorationLine: 'underline' },
  dialogBody: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
