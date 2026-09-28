import { router, type Href } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { PET_SPECIES } from '@/config/pets';
import { describeProtection, getStageDefinitionById } from '@/core';
import { PROTECTION_STATE_COPY } from '@/features/family/protectionState';
import { describeGoal, describeProgress, formatRecurrence, formatWindow } from '@/features/missions/missionCopy';
import { MODE_LABEL } from '@/features/protection/protectionCopy';
import { useActiveSession, useCurrentMission, useGameStore, usePetView, usePlayToday, useTodayStats } from '@/state';
import { Button, Card, PetArt, Screen, colors, radius, spacing, typography } from '@/ui';

/** Width at which the dashboard switches to two columns (iPad portrait and up). */
const WIDE_BREAKPOINT = 768;

/** Parent Dashboard: today's healthy-habit numbers, the current mission, protection and the child's pet. */
export default function ParentDashboard() {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const family = useGameStore((s) => s.save?.family);
  const protectionSettings = useGameStore((s) => s.save?.protection);
  const protectionStatus = useGameStore((s) => s.protection);
  const activeSession = useActiveSession();
  const today = useTodayStats();
  const mission = useCurrentMission();
  const play = usePlayToday();
  const petView = usePetView();
  const { enterChildView, refreshProtection } = useGameStore.getState();

  useEffect(() => {
    void refreshProtection();
  }, [refreshProtection]);

  if (!family || !petView || !protectionSettings) return null;
  const nickname = family.child.nickname || 'Your child';
  const protectionState = describeProtection(protectionSettings, protectionStatus, activeSession);
  const protectionCopy = PROTECTION_STATE_COPY[protectionState];
  const { pet, progression } = petView;
  const stageLabel = getStageDefinitionById(progression.stage).label;
  const habitCoins = today.coinsEarned + today.missionCoinsEarned;

  const toChild = () => {
    enterChildView();
    router.dismissTo('/(child)');
  };

  return (
    <Screen scroll width="wide">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>Parent area</Text>
          <Text style={typography.title} accessibilityRole="header">
            {nickname}’s day
          </Text>
        </View>
        <Button label="Child View" icon="🐾" onPress={toChild} style={styles.childButton} />
      </View>

      <View style={[styles.grid, wide && styles.gridWide]}>
        <Tile wide={wide} title="Today">
          <View style={styles.metrics}>
            <Metric value={today.focusMinutes} label="focus minutes" />
            <Metric value={today.sessionsCompleted} label="successful sessions" />
            <Metric value={today.missionsCompleted} label="missions completed" />
            <Metric value={habitCoins} label="coins from healthy habits" />
          </View>
          <Text style={styles.muted}>
            Play today: {play?.coinsEarned ?? 0} of {play?.cap ?? 0} play coins
            {family.play.access === 'afterMission' ? ' · Play unlocks after a mission' : ''}
          </Text>
        </Tile>

        <Tile wide={wide} title="Current mission">
          {mission ? (
            <>
              <Text style={styles.big}>{mission.mission.title}</Text>
              <Text style={styles.body}>{describeGoal(mission.mission)}</Text>
              <Row label="Progress" value={describeProgress(mission)} />
              <Row label="Reward" value={`${mission.mission.rewardCoins} coins · ${mission.mission.rewardXp} XP`} />
              <Row
                label="When"
                value={`${formatRecurrence(mission.mission.recurrence)}${mission.mission.window ? ` · ${formatWindow(mission.mission.window)}` : ''}`}
              />
            </>
          ) : (
            <Text style={styles.body}>No mission for today. Add one to give {nickname} a daily goal.</Text>
          )}
          <Button variant="secondary" label="Missions" onPress={() => router.push('/parent/missions' as Href)} />
        </Tile>

        <Tile wide={wide} title="Protection">
          <View style={styles.stateRow}>
            <Text style={[styles.pill, styles[`pill_${protectionCopy.tone}`]]}>{protectionCopy.label}</Text>
            <Text style={styles.body}>Rule: {MODE_LABEL[protectionSettings.mode]}</Text>
          </View>
          <Text style={styles.muted}>{protectionCopy.body}</Text>
          <Button variant="secondary" label="Protection" onPress={() => router.push('/protection')} />
        </Tile>

        <Tile wide={wide} title="Child">
          <View style={styles.childRow}>
            <PetArt speciesId={pet.speciesId} stage={progression.stage} mood="content" size={84} />
            <View style={styles.childText}>
              <Text style={styles.big}>{nickname}</Text>
              <Text style={styles.body}>
                {pet.name} · {stageLabel} {PET_SPECIES[pet.speciesId].name}
              </Text>
              <Text style={styles.muted}>Level {progression.level}</Text>
            </View>
          </View>
        </Tile>
      </View>

      <View style={[styles.actions, wide && styles.actionsWide]}>
        <Button variant="secondary" icon="🎯" label="Missions" onPress={() => router.push('/parent/missions' as Href)} style={styles.action} />
        <Button variant="secondary" icon="🛡" label="Protection" onPress={() => router.push('/protection')} style={styles.action} />
        <Button variant="secondary" icon="⚙️" label="Parent settings" onPress={() => router.push('/parent/settings' as Href)} style={styles.action} />
        <Button icon="🐾" label="Child View" onPress={toChild} style={styles.action} />
      </View>
      <Text style={styles.footnote}>
        Focusling shows only focus totals and missions. It doesn’t read messages, browsing, photos or location, and nothing leaves this device.
      </Text>
    </Screen>
  );
}

function Tile({ title, children, wide }: { title: string; children: ReactNode; wide: boolean }) {
  return (
    <Card style={wide ? styles.tileWide : styles.tile}>
      <Text style={styles.tileTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </Card>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.metric} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.md },
  headerText: { flexShrink: 1 },
  kicker: { ...typography.label, textTransform: 'uppercase', letterSpacing: 0.8 },
  childButton: { minWidth: 150 },
  grid: { gap: spacing.lg },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: {},
  tileWide: { flexBasis: '48%', flexGrow: 1 },
  tileTitle: { ...typography.label, textTransform: 'uppercase', letterSpacing: 0.8 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metric: { flexBasis: '45%', flexGrow: 1, backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md },
  metricValue: { fontSize: 30, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'] },
  metricLabel: { ...typography.label },
  big: { ...typography.heading },
  body: { ...typography.body, fontSize: 15 },
  muted: { ...typography.body, fontSize: 14, color: colors.textMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { ...typography.label },
  rowValue: { ...typography.body, fontSize: 14, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  stateRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  pill: { fontWeight: '800', fontSize: 14, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
  pill_neutral: { backgroundColor: colors.surfaceMuted, color: colors.text },
  pill_good: { backgroundColor: '#DDF6E8', color: colors.success },
  pill_warn: { backgroundColor: '#FFF0D6', color: '#8A5A00' },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  childText: { flex: 1, gap: 2 },
  actions: { gap: spacing.sm },
  actionsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  action: { flexGrow: 1, flexBasis: 200 },
  footnote: { ...typography.label, textAlign: 'center', lineHeight: 19 },
});
