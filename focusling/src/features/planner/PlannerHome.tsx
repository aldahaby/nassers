import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  addDays,
  assignmentProgress,
  capacityFor,
  dayKeyIn,
  isActivePlan,
  isMissed,
  isSchedulable,
  liveAssignments,
  nextPlan,
  plansOnDay,
  upcomingAssignments,
  type PlannerState,
} from '@/core';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { useNow } from '@/hooks/useNow';
import { useActiveSession, useEquipped, usePetView, usePlannerStore } from '@/state';
import { AnimatedPet, Button, Card, Pressable, Screen, colors, radius, spacing, typography } from '@/ui';
import { CapacityNote } from './CapacityNote';
import { NextPlanCard, PlanRow } from './PlanCard';
import { CourseTag, InfoNote, SectionTitle, TrustBadge } from './PlannerBits';
import { formatDayKey, formatDue, formatMinutes, weekdayShort } from './plannerCopy';

/**
 * Studyling Planner: TODAY (next block, Start & Lock), UPCOMING work, THIS
 * WEEK's blocks and COURSES. Calm and sparse; the pet stays in the corner.
 */
export function PlannerHome() {
  const planner = usePlannerStore((s) => s.planner);
  const lastProposal = usePlannerStore((s) => s.lastProposal);
  const now = useNow(30_000);
  const view = usePetView();
  const equipped = useEquipped();
  const active = useActiveSession();
  const routes = useAppRoutes();
  const [hideReminderInvite, setHideReminderInvite] = useState(false);

  const derived = useMemo(() => (planner ? derive(planner, now) : null), [planner, now]);
  if (!planner || !derived) return null;
  const tz = planner.preferences.timezone;
  const store = usePlannerStore.getState();
  const hasCourses = Object.values(planner.courses).some((c) => c.active);

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={typography.title} accessibilityRole="header">
            Planner
          </Text>
          <Text style={styles.subtitle}>Studyling turns your syllabus into study blocks.</Text>
        </View>
        {view && (
          <View style={styles.pet} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <AnimatedPet speciesId={view.pet.speciesId} stage={view.progression.stage} mood="content" equipped={equipped} size={64} calm expression="auto" />
          </View>
        )}
      </View>

      {!hasCourses ? (
        <Card>
          <Text style={typography.heading}>Add your first course</Text>
          <Text style={styles.body}>Import a syllabus or type a few deadlines. You review everything before anything is planned.</Text>
          <Button label="Add a course" onPress={() => router.push('/planner/import' as Href)} />
        </Card>
      ) : (
        <>
          {planner.progress.recoveryOffer === 'pending' && (
            <Card>
              <Text style={typography.heading}>Want a little more help this week?</Text>
              <Text style={styles.body}>A few planned blocks slipped by. Studyling can bring back start reminders, or keep things calm.</Text>
              <View style={styles.row2}>
                <Button label="Restore reminders" onPress={() => store.answerRecovery('restore')} style={styles.flex} />
                <Button label="Keep it calm" variant="ghost" onPress={() => store.answerRecovery('calm')} style={styles.flex} />
              </View>
            </Card>
          )}

          <SectionTitle>Today</SectionTitle>
          {active ? (
            <Card style={styles.activeCard}>
              <Text style={typography.heading}>Studying now</Text>
              <Button label="Back to the session" variant="secondary" onPress={() => router.navigate(routes.focus)} />
            </Card>
          ) : derived.next ? (
            <NextPlanCard planner={planner} plan={derived.next} now={now} />
          ) : (
            <Card>
              <Text style={styles.body}>{derived.proposed.length ? 'Review the proposed plan below to fill your week.' : 'No study blocks planned right now.'}</Text>
              {derived.schedulableUnplanned.length > 0 && <Button label="Plan my study" onPress={() => store.proposePlans()} />}
            </Card>
          )}
          {derived.todayOthers.length > 0 && (
            <Card>
              {derived.todayOthers.map((p) => (
                <PlanRow key={p.id} planner={planner} plan={p} now={now} onPress={p.assignmentId ? () => router.push(`/planner/assignment/${p.assignmentId}` as Href) : undefined} />
              ))}
            </Card>
          )}

          {!planner.preferences.remindersEnabled && planner.preferences.notificationPermission !== 'denied' && derived.acceptedCount > 0 && !hideReminderInvite && (
            <Card>
              <InfoNote icon="bell">Studyling can remind you when a study block you planned is ready.</InfoNote>
              <View style={styles.row2}>
                <Button label="Turn on reminders" variant="secondary" onPress={() => void store.enableReminders()} style={styles.flex} />
                <Button label="Not now" variant="ghost" onPress={() => setHideReminderInvite(true)} style={styles.flex} />
              </View>
            </Card>
          )}

          {derived.proposed.length > 0 && (
            <Card>
              <Text style={typography.heading}>Proposed study plan</Text>
              <Text style={styles.body}>
                {derived.proposed.length} block{derived.proposed.length === 1 ? '' : 's'} in your study windows, spread across the days before each deadline.
              </Text>
              {derived.proposed.slice(0, 6).map((p) => (
                <PlanRow key={p.id} planner={planner} plan={p} now={now} onPress={p.assignmentId ? () => router.push(`/planner/assignment/${p.assignmentId}` as Href) : undefined} />
              ))}
              {derived.proposed.length > 6 && <Text style={styles.muted}>+{derived.proposed.length - 6} more in This week</Text>}
              <View style={styles.row2}>
                <Button label="Accept plan" sound="confirm" onPress={() => store.acceptAllProposed()} style={styles.flex} />
                <Button label="Not now" variant="ghost" onPress={() => store.discardProposals()} style={styles.flex} />
              </View>
            </Card>
          )}

          {(lastProposal?.warnings ?? []).concat(derived.capacity).filter((w, i, all) => all.findIndex((x) => x.assignmentId === w.assignmentId) === i)
            .filter((w) => planner.assignments[w.assignmentId]?.capacityNoteDismissedFor !== w.dueAt)
            .slice(0, 3)
            .map((w) => (
              <CapacityNote key={w.assignmentId} planner={planner} assignment={planner.assignments[w.assignmentId]!} warning={w} now={now} />
            ))}

          {derived.needsReview.length > 0 && (
            <Pressable onPress={() => router.push(`/planner/assignment/${derived.needsReview[0]!.id}` as Href)} style={styles.reviewRow} accessibilityRole="button" accessibilityLabel={`${derived.needsReview.length} items need a quick review`}>
              <TrustBadge level="needsReview" compact />
              <Text style={styles.reviewText}>
                {derived.needsReview.length} item{derived.needsReview.length === 1 ? '' : 's'} need{derived.needsReview.length === 1 ? 's' : ''} a quick review before they can be planned
              </Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}

          <SectionTitle>Upcoming</SectionTitle>
          <Card>
            {derived.upcoming.length === 0 && <Text style={styles.muted}>Nothing due in the next two weeks.</Text>}
            {derived.upcoming.map((a) => {
              const progress = assignmentProgress(planner, a.id, now);
              const level = a.reviewState === 'needsReview' || a.reviewState === 'sourceConflict' ? 'needsReview' : null;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => router.push(`/planner/assignment/${a.id}` as Href)}
                  style={styles.assignRow}
                  accessibilityRole="button"
                  accessibilityLabel={`${a.title}, ${planner.courses[a.courseId]?.code ?? planner.courses[a.courseId]?.name}, ${formatDue(a.dueAt, a.dueDateOnly, tz, now)}${level ? ', needs review' : ''}`}
                >
                  <View style={styles.assignText}>
                    <CourseTag course={planner.courses[a.courseId]} />
                    <Text style={styles.assignTitle} numberOfLines={2}>
                      {a.title}
                    </Text>
                    <Text style={styles.muted}>
                      {formatDue(a.dueAt, a.dueDateOnly, tz, now)}
                      {progress.plannedMinutes ? ` · ${formatMinutes(progress.plannedMinutes)} planned` : ''}
                    </Text>
                  </View>
                  {level && <TrustBadge level={level} compact />}
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              );
            })}
          </Card>

          <SectionTitle action={<Button label="Full week" variant="ghost" onPress={() => router.push('/planner/week' as Href)} />}>This week</SectionTitle>
          <View style={styles.week} accessibilityRole="summary">
            {derived.week.map((d) => (
              <Pressable key={d.key} onPress={() => router.push(`/planner/week?day=${d.key}` as Href)} style={[styles.day, d.isToday && styles.dayToday]} accessibilityRole="button" accessibilityLabel={`${formatDayKey(d.key)}: ${d.count} study block${d.count === 1 ? '' : 's'}, ${formatMinutes(d.minutes)}`}>
                <Text style={[styles.dayName, d.isToday && styles.dayNameToday]}>{weekdayShort(d.weekday)}</Text>
                <Text style={styles.dayCount}>{d.count}</Text>
                <Text style={styles.dayMinutes}>{d.minutes ? formatMinutes(d.minutes) : '—'}</Text>
              </Pressable>
            ))}
          </View>

          <SectionTitle>Courses</SectionTitle>
          <Card>
            {Object.values(planner.courses)
              .filter((c) => c.active)
              .map((c, i) => {
                const items = liveAssignments(planner).filter((a) => a.courseId === c.id && a.status === 'open');
                return (
                  <View key={c.id} style={styles.courseRow}>
                    <CourseTag course={c} index={i} />
                    <Text style={styles.muted}>
                      {c.code ? `${c.name} · ` : ''}
                      {items.length} open
                    </Text>
                  </View>
                );
              })}
          </Card>
        </>
      )}

      <View style={styles.row2}>
        <Button label="Add a course" variant="secondary" onPress={() => router.push('/planner/import' as Href)} style={styles.flex} />
        <Button label="Reminders & time" variant="ghost" onPress={() => router.push('/planner/settings' as Href)} style={styles.flex} />
      </View>
      <Text style={styles.footnote}>Your syllabus and plans stay on this device.</Text>
    </Screen>
  );
}

function derive(planner: PlannerState, now: number) {
  const tz = planner.preferences.timezone;
  const today = dayKeyIn(now, tz);
  const next = nextPlan(planner, now);
  const todayPlans = plansOnDay(planner, today, tz).filter((p) => isActivePlan(p) && !isMissed(p, now));
  const plans = Object.values(planner.plans);
  const proposed = plans.filter((p) => p.status === 'proposed').sort((a, b) => a.plannedStartAt - b.plannedStartAt);
  const live = liveAssignments(planner);
  const schedulable = live.filter(isSchedulable);
  const schedulableUnplanned = schedulable.filter((a) => a.estimatedMinutes && (assignmentProgress(planner, a.id, now).unplannedMinutes ?? 0) > 0);
  const capacity = schedulable.map((a) => capacityFor(planner, a.id, now)).filter((w): w is NonNullable<typeof w> => Boolean(w));
  const week = Array.from({ length: 7 }, (_, i) => {
    const key = addDays(today, i);
    const dayPlans = plansOnDay(planner, key, tz).filter((p) => isActivePlan(p) || p.status === 'completed');
    return { key, weekday: new Date(`${key}T12:00:00Z`).getUTCDay(), count: dayPlans.length, minutes: dayPlans.reduce((s, p) => s + p.plannedMinutes, 0), isToday: i === 0 };
  });
  return {
    next,
    todayOthers: todayPlans.filter((p) => p.id !== next?.id),
    proposed,
    acceptedCount: plans.filter(isActivePlan).length,
    schedulableUnplanned,
    capacity,
    needsReview: live.filter((a) => a.status === 'open' && (a.reviewState === 'needsReview' || a.reviewState === 'sourceConflict')),
    upcoming: upcomingAssignments(planner, now, 14).slice(0, 8),
    week,
  };
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1 },
  subtitle: { ...typography.label },
  pet: { width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.stage, alignItems: 'center', justifyContent: 'center' },
  body: { ...typography.body, fontSize: 15, color: colors.textMuted, lineHeight: 21 },
  muted: { ...typography.label, lineHeight: 18 },
  row2: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  flex: { flexGrow: 1, flexBasis: 140 },
  activeCard: { borderWidth: 2, borderColor: colors.primarySoft },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#FFF8EC', borderRadius: radius.md, padding: spacing.md, minHeight: 48 },
  reviewText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  chevron: { fontSize: 22, fontWeight: '900', color: colors.textMuted },
  assignRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, minHeight: 56 },
  assignText: { flex: 1, gap: 2 },
  assignTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  week: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, minHeight: 72, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, gap: 2 },
  dayToday: { borderWidth: 2, borderColor: colors.primary },
  dayName: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  dayNameToday: { color: colors.primaryDark },
  dayCount: { fontSize: 18, fontWeight: '900', color: colors.text },
  dayMinutes: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  courseRow: { gap: 2, paddingVertical: 4 },
  footnote: { ...typography.label, textAlign: 'center' },
});
