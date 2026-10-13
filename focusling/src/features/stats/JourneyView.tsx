import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { JOURNEY_CONFIG } from '@/config/journey';
import { GROWTH_STAGES } from '@/config/progression';
import { journeyTimeline, type JourneyMilestone } from '@/core';
import { useEquipped, usePetView, usePlanner, useStudyData } from '@/state';
import { AnimatedPet, Card, TabIcon, colors, radius, spacing, typography } from '@/ui';
import { formatDay, formatMinutes } from '../planner/plannerCopy';
import { milestoneCopy, plural } from './statsCopy';

/**
 * "How far have I come?" A timeline of milestones from real records, each
 * stored once. No streaks, no missed-day penalties, nothing for studying longer.
 */
export function JourneyView() {
  const planner = usePlanner();
  const { records, tasks, journeyInputs } = useStudyData();
  const view = usePetView();
  const equipped = useEquipped();
  const timeline = useMemo(() => (planner ? journeyTimeline(planner.journey) : []), [planner]);
  if (!planner) return null;
  const tz = planner.preferences.timezone;
  const petName = view?.pet.name ?? null;
  const stage = GROWTH_STAGES.find((s) => s.stage === view?.progression.stage);
  const focusMinutes = records.reduce((s, r) => s + r.recordedMinutes, 0);
  const sessionsDone = Math.max(records.filter((r) => r.status === 'completed').length, journeyInputs.lifetime?.sessionsCompleted ?? 0);
  const next = nextMilestone(planner.journey.milestones, sessionsDone, tasks.length);

  return (
    <>
      <Card style={styles.hero}>
        {view && (
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <AnimatedPet speciesId={view.pet.speciesId} stage={view.progression.stage} mood="content" equipped={equipped} size={96} calm expression="auto" />
          </View>
        )}
        <View style={styles.heroText}>
          <Text style={typography.heading} accessibilityRole="header">
            How far you’ve come
          </Text>
          <Text style={styles.body}>
            {petName ? `${petName} has grown alongside your studying` : 'Your pet grows alongside your studying'}
            {stage ? `: now ${stage.label}, level ${view!.progression.level}.` : '.'}
          </Text>
          <Text style={styles.small}>
            {plural(sessionsDone, 'session')} finished · {formatMinutes(focusMinutes)} of recorded focus time · {plural(tasks.length, 'task')} done
          </Text>
        </View>
      </Card>

      {timeline.length === 0 ? (
        <Card>
          <Text style={typography.heading}>Your Journey starts here</Text>
          <Text style={styles.body}>Finish a focus session or complete a task, and it will appear on your timeline.</Text>
        </Card>
      ) : (
        <Card>
          <View style={styles.timeline} accessibilityRole="list">
            {timeline.map((m, i) => (
              <MilestoneRow key={m.id} milestone={m} last={i === timeline.length - 1} courses={planner.courses} petName={petName} tz={tz} />
            ))}
          </View>
        </Card>
      )}

      {next && (
        <Card>
          <Text style={styles.small}>Coming up</Text>
          <Text style={styles.body}>{next}</Text>
        </Card>
      )}

      <View style={styles.notes}>
        <Text style={styles.note}>Milestones come from what you actually did and are never taken away. Breaks never cost you anything here.</Text>
        <Text style={styles.note}>Journey began on this device on {formatDay(planner.journey.startedAt, tz)}. Anything from earlier shows as “Before Journey began”.</Text>
      </View>
    </>
  );
}

function MilestoneRow({ milestone, last, courses, petName, tz }: { milestone: JourneyMilestone; last: boolean; courses: Parameters<typeof milestoneCopy>[1]; petName: string | null; tz: string }) {
  const copy = milestoneCopy(milestone, courses, petName);
  const when = milestone.achievedAt != null ? formatDay(milestone.achievedAt, tz) : 'Before Journey began';
  return (
    <View style={styles.row} accessible accessibilityLabel={`${copy.title}. ${copy.detail} ${when}.`} testID={`milestone-${milestone.id}`}>
      <View style={styles.rail}>
        <View style={styles.dot}>
          <TabIcon name={copy.icon} color={colors.primaryDark} size={16} />
        </View>
        {!last && <View style={styles.line} />}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.small}>{copy.detail}</Text>
        <Text style={styles.when}>{when}</Text>
      </View>
    </View>
  );
}

/** One gentle "next" line for count milestones (never time-of-session or streaks). */
function nextMilestone(have: Record<string, unknown>, sessions: number, tasks: number): string | null {
  const s = JOURNEY_CONFIG.sessionThresholds.find((n) => !have[`sessions:${n}`]);
  if (s && sessions > 0) return `${s} focus sessions finished (${sessions} so far)`;
  const t = JOURNEY_CONFIG.taskThresholds.find((n) => !have[`tasks:${n}`]);
  if (t && tasks > 0) return `${t} tasks completed (${tasks} so far)`;
  return null;
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  heroText: { flex: 1, minWidth: 180, gap: 4 },
  body: { ...typography.body, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '600', color: colors.textMuted, lineHeight: 18 },
  note: { fontSize: 13, fontWeight: '600', color: colors.textMuted, lineHeight: 18 },
  notes: { gap: spacing.sm, paddingHorizontal: spacing.xs },
  timeline: { gap: 0 },
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 32 },
  dot: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, backgroundColor: colors.primarySoft, marginVertical: 2, minHeight: 12 },
  rowText: { flex: 1, gap: 2, paddingBottom: spacing.md },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  when: { fontSize: 12, fontWeight: '800', color: colors.primaryDark },
});
