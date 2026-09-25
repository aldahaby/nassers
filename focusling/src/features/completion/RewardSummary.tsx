import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { EquipSlot, GrowthStage, PetSpeciesId, SessionSummary } from '@/core';
import { AnimatedPet, Button, Card, Confetti, CountUpText, Screen, colors, radius, spacing, typography, useNativeDriver } from '@/ui';
import { XpGainBar } from './XpGainBar';

interface Props {
  summary: SessionSummary;
  pet: { name: string; speciesId: PetSpeciesId; stage: GrowthStage; equipped: Partial<Record<EquipSlot, string>> };
  continueLabel: string;
  onContinue: () => void;
  reducedMotion: boolean;
}

interface Row {
  icon: string;
  label: string;
  value: string;
  color: string;
}

const ROW_START_MS = 350;
const ROW_STAGGER_MS = 160;

/** The reward screen: what you earned, with the balance and XP bar counting up. */
export function RewardSummary({ summary, pet, continueLabel, onContinue, reducedMotion }: Props) {
  const { reward } = summary;
  const completed = summary.outcome === 'completed';
  const { width } = useWindowDimensions();

  const rows: Row[] = [
    { icon: '⏱', label: 'Minutes focused', value: `${reward.focusedMinutes}`, color: colors.text },
    { icon: '🪙', label: 'Coins earned', value: `+${reward.coins - reward.completionBonusCoins}`, color: colors.coinDark },
    ...(completed
      ? [{ icon: '🎁', label: 'Completion bonus', value: `+${reward.completionBonusCoins}`, color: colors.coinDark }]
      : []),
    { icon: '✨', label: 'XP earned', value: `+${reward.xp}`, color: colors.xp },
  ];
  const countStart = ROW_START_MS + rows.length * ROW_STAGGER_MS;

  // The pet hops a few times on arrival, then settles.
  const [cheerKey, setCheerKey] = useState(0);
  useEffect(() => {
    if (!completed || reducedMotion) return;
    const timers = [300, 1500, 2700].map((ms, i) => setTimeout(() => setCheerKey(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [completed, reducedMotion]);

  return (
    <View style={styles.flex}>
      <Screen scroll contentStyle={styles.content}>
        <AnimatedPet
          speciesId={pet.speciesId}
          stage={pet.stage}
          mood={completed ? 'joyful' : 'content'}
          equipped={pet.equipped}
          size={Math.min(170, width * 0.42)}
          cheerKey={cheerKey}
          accessibilityLabel={`${pet.name}`}
        />
        <View style={styles.heading}>
          <Text style={styles.title}>{completed ? 'Session complete!' : 'Session ended early'}</Text>
          <Text style={styles.subtitle}>
            {completed
              ? summary.completedWhileAway
                ? `Finished while you were away. ${pet.name} is proud of you.`
                : `${pet.name} loved focusing with you.`
              : 'You still made some progress.'}
          </Text>
        </View>

        <Card style={styles.card}>
          {rows.map((row, i) => (
            <RevealRow key={row.label} row={row} delay={ROW_START_MS + i * ROW_STAGGER_MS} instant={reducedMotion} />
          ))}
        </Card>

        <Card style={styles.card}>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Coin balance</Text>
            <CountUpText
              from={summary.coinsBefore}
              to={summary.coinsAfter}
              delay={countStart}
              duration={1000}
              prefix="🪙 "
              style={styles.balance}
              instant={reducedMotion}
            />
          </View>
          <XpGainBar xpBefore={summary.xpBefore} xpAfter={summary.xpAfter} delay={countStart + 200} instant={reducedMotion} />
        </Card>

        <StreakLine summary={summary} />

        <Button label={continueLabel} onPress={onContinue} style={styles.button} />
      </Screen>
      {completed && <Confetti disabled={reducedMotion} />}
    </View>
  );
}

function RevealRow({ row, delay, instant }: { row: Row; delay: number; instant: boolean }) {
  const [anim] = useState(() => new Animated.Value(instant ? 1 : 0));
  useEffect(() => {
    if (instant) return;
    Animated.timing(anim, { toValue: 1, duration: 320, delay, easing: Easing.out(Easing.back(1.6)), useNativeDriver }).start();
  }, [anim, delay, instant]);
  return (
    <Animated.View
      style={[
        styles.row,
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
      ]}
      accessible
      accessibilityLabel={`${row.label}: ${row.value}`}
    >
      <Text style={styles.rowLabel}>
        {row.icon}  {row.label}
      </Text>
      <Text style={[styles.rowValue, { color: row.color }]}>{row.value}</Text>
    </Animated.View>
  );
}

function StreakLine({ summary }: { summary: SessionSummary }) {
  let text: string | null = null;
  if (summary.outcome === 'completed') {
    if (summary.dayStreakAfter > summary.dayStreakBefore) {
      text =
        summary.dayStreakAfter === 1
          ? 'Day streak started: 1 day'
          : `Day streak: ${summary.dayStreakBefore} → ${summary.dayStreakAfter} days`;
    } else {
      text = `${summary.sessionStreakAfter} ${summary.sessionStreakAfter === 1 ? 'session' : 'sessions'} in a row · ${summary.dayStreakAfter}-day streak`;
    }
  } else if (summary.dayStreakAfter > 0) {
    text = `Your ${summary.dayStreakAfter}-day streak is still going.`;
  }
  if (!text) return null;
  return (
    <View style={styles.streak}>
      <Text style={styles.streakText}>🔥 {text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { alignItems: 'center', paddingTop: spacing.xl },
  heading: { alignItems: 'center', gap: spacing.xs },
  title: { ...typography.title, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  card: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { ...typography.body, fontWeight: '700' },
  rowValue: { fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { ...typography.label },
  balance: { fontSize: 26, fontWeight: '900', color: colors.coinDark, fontVariant: ['tabular-nums'] },
  streak: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  streakText: { fontWeight: '800', color: colors.streak, textAlign: 'center' },
  button: { alignSelf: 'stretch' },
});
