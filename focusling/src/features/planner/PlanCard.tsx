import { router, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import type { PlannerState, SessionPlan } from '@/core';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { usePlannerStore } from '@/state';
import { Button, Card, Pressable, TabIcon, colors, radius, spacing, typography } from '@/ui';
import { CourseTag } from './PlannerBits';
import { formatClock, formatDay, formatMinutes } from './plannerCopy';

/**
 * The next planned block with one primary action. "Start & Lock" begins the
 * planned session through the existing focus timer and protection, with no
 * extra timer choice or confirmation.
 */
export function NextPlanCard({ planner, plan, now, emphasis = true }: { planner: PlannerState; plan: SessionPlan; now: number; emphasis?: boolean }) {
  const routes = useAppRoutes();
  const tz = planner.preferences.timezone;
  const course = planner.courses[plan.courseId];
  const assignment = plan.assignmentId ? planner.assignments[plan.assignmentId] : undefined;
  const startsIn = plan.plannedStartAt - now;
  const when = startsIn <= 0 ? 'Ready now' : `${formatDay(plan.plannedStartAt, tz, now)} · ${formatClock(plan.plannedStartAt, tz)}`;
  const start = async () => {
    const r = await usePlannerStore.getState().startPlan(plan.id, 'planner');
    if (r.ok) router.navigate(routes.focus);
  };
  return (
    <Card style={emphasis ? styles.emphasis : undefined}>
      <View style={styles.row}>
        <CourseTag course={course} />
        <Text style={styles.when}>{when}</Text>
      </View>
      <Pressable
        onPress={() => assignment && router.push(`/planner/assignment/${assignment.id}` as Href)}
        accessibilityRole="button"
        accessibilityLabel={`${assignment?.title ?? course?.name ?? 'Study block'}, ${formatMinutes(plan.plannedMinutes)}. Open details.`}
      >
        <Text style={styles.title}>{assignment?.title ?? course?.name ?? 'Study block'}</Text>
        <Text style={styles.meta}>
          {formatMinutes(plan.plannedMinutes)} planned{plan.sequenceCount && plan.sequenceCount > 1 ? ` · block ${plan.sequenceIndex} of ${plan.sequenceCount}` : ''}
        </Text>
      </Pressable>
      <Button label={`Start & Lock · ${plan.plannedMinutes} min`} onPress={() => void start()} sound={null} accessibilityHint="Starts this planned study session with your protection settings" />
    </Card>
  );
}

/** A compact plan row for lists (today, the week, an assignment's plan). */
export function PlanRow({ planner, plan, now, onPress, compact = false }: { planner: PlannerState; plan: SessionPlan; now: number; onPress?: () => void; compact?: boolean }) {
  const tz = planner.preferences.timezone;
  const course = planner.courses[plan.courseId];
  const assignment = plan.assignmentId ? planner.assignments[plan.assignmentId] : undefined;
  const status = plan.status === 'completed' ? 'Done' : plan.status === 'proposed' ? 'Proposed' : plan.status === 'rescheduled' ? 'Moved' : null;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={compact ? styles.planCompact : styles.planRow}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${formatClock(plan.plannedStartAt, tz)}, ${course?.code ?? course?.name ?? ''} ${assignment?.title ?? ''}, ${formatMinutes(plan.plannedMinutes)}${status ? `, ${status}` : ''}`}
    >
      <View style={compact ? undefined : styles.time}>
        <Text style={styles.timeText}>
          {formatClock(plan.plannedStartAt, tz)}
          {compact ? ` · ${formatMinutes(plan.plannedMinutes)}` : ''}
        </Text>
        {!compact && <Text style={styles.dayText}>{formatDay(plan.plannedStartAt, tz, now)}</Text>}
      </View>
      <View style={styles.planText}>
        <CourseTag course={course} />
        <Text style={styles.planTitle} numberOfLines={2}>
          {assignment?.title ?? 'Study block'}
        </Text>
      </View>
      {!compact && (
      <View style={styles.planRight}>
        <Text style={styles.planMinutes}>{formatMinutes(plan.plannedMinutes)}</Text>
        {status && (
          <View style={[styles.status, plan.status === 'completed' && styles.statusDone]}>
            {plan.status === 'completed' && <TabIcon name="check" color={colors.success} size={12} />}
            <Text style={[styles.statusText, plan.status === 'completed' && { color: colors.success }]}>{status}</Text>
          </View>
        )}
      </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  emphasis: { borderWidth: 2, borderColor: colors.primarySoft },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  when: { ...typography.label, color: colors.primaryDark },
  title: { ...typography.heading },
  meta: { ...typography.label, marginTop: 2 },
  planCompact: { gap: 2, paddingVertical: 6, minHeight: 44, borderBottomWidth: 1, borderColor: colors.border },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, minHeight: 56 },
  time: { width: 72 },
  timeText: { fontSize: 15, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'] },
  dayText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  planText: { flex: 1, gap: 2 },
  planTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  planRight: { alignItems: 'flex-end', gap: 4 },
  planMinutes: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  status: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, paddingHorizontal: 8, paddingVertical: 2 },
  statusDone: { backgroundColor: colors.successSoft },
  statusText: { fontSize: 11, fontWeight: '800', color: colors.textMuted },
});
