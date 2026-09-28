import { StyleSheet, Text, View } from 'react-native';
import type { MissionView } from '@/core';
import { CoinIcon, colors, radius, shadow, spacing, typography, Pressable } from '@/ui';
import { describeGoal, describeProgress, describeReward, formatRecurrence } from './missionCopy';

interface Props {
  view: MissionView;
  onPress?: () => void;
  /** Compact: pet screen; full: mission lists. */
  compact?: boolean;
  accessibilityHint?: string;
}

/** One mission with a text + bar progress readout. Missed missions stay neutral. */
export function MissionCard({ view, onPress, compact = false, accessibilityHint }: Props) {
  const { mission, status } = view;
  const ratio = view.target > 0 ? Math.min(1, view.progress / view.target) : 0;
  const done = status === 'complete';
  const muted = status !== 'active' && !done;
  const progressText = describeProgress(view);
  const label = `Mission: ${mission.title}. ${describeGoal(mission)}. ${progressText}. Reward ${describeReward(mission)}.`;

  const body = (
    <View style={[styles.card, shadow, done && styles.cardDone, muted && styles.cardMuted]}>
      <View style={styles.header}>
        <Text style={styles.badge}>{done ? '✓' : '🎯'}</Text>
        <View style={styles.titles}>
          <Text style={styles.kicker}>{compact ? 'Mission' : formatRecurrence(mission.recurrence)}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {mission.title}
          </Text>
        </View>
        <View style={styles.reward}>
          <CoinIcon size={16} />
          <Text style={styles.rewardText}>+{mission.rewardCoins}</Text>
        </View>
      </View>
      {!compact && <Text style={styles.goal}>{mission.description || describeGoal(mission)}</Text>}
      {status === 'active' || done ? (
        <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.fill, { width: `${Math.round((done ? 1 : ratio) * 100)}%` }, done && styles.fillDone]} />
        </View>
      ) : null}
      <View style={styles.footer}>
        <Text style={[styles.progress, done && styles.progressDone]}>{progressText}</Text>
        {!compact && <Text style={styles.small}>+{mission.rewardXp} XP</Text>}
      </View>
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label}>
        {body}
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  cardDone: { backgroundColor: colors.successSoft },
  cardMuted: { opacity: 0.75 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: { fontSize: 24, width: 32, textAlign: 'center', color: colors.health, fontWeight: '900' },
  titles: { flex: 1 },
  kicker: { ...typography.label, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { ...typography.heading, fontSize: 18 },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF4DC', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  rewardText: { fontWeight: '800', color: colors.coinDark },
  goal: { ...typography.body, fontSize: 15, color: colors.textMuted },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  fillDone: { backgroundColor: colors.health },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progress: { ...typography.label, color: colors.text },
  progressDone: { color: colors.success },
  small: { ...typography.label },
});
