import { router, useLocalSearchParams, type Href } from 'expo-router';
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
import { formatDue, formatMinutes, unresolvedText } from './plannerCopy';

/**
 * Studyling Planner answers four questions, in order:
 *   1. What should I work on today?  (today's study plan, or how to make one)
 *   2. What's due next?               (upcoming deadlines, dated only)
 *   3. What needs my attention?        (items waiting on the student's answer)
 *   4. Which course should I open?     (courses)
 * Assessments without a date sit in their own, quieter list, never mixed in
 * with dated deadlines. The pet stays in the corner.
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
  const { imported } = useLocalSearchParams<{ imported?: string }>();
  const [hideImported, setHideImported] = useState(false);

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

          {imported && Number(imported) > 0 && !hideImported && (
            <Card style={styles.importedCard}>
              <Text style={typography.heading}>{`${imported} assessment${imported === '1' ? '' : 's'} added`}</Text>
              <Text style={styles.body}>Want to plan your first study session? Pick one, give your own time estimate, and Studyling suggests blocks you can accept or skip.</Text>
              <View style={styles.row2}>
                <Button label="Plan a study session" onPress={() => router.push('/planner/plan' as Href)} style={styles.flex} />
                <Button label="Later" variant="ghost" onPress={() => setHideImported(true)} style={styles.flex} />
              </View>
            </Card>
          )}

          <SectionTitle action={<Button label="Full week" variant="ghost" onPress={() => router.push('/planner/week' as Href)} />}>Today’s study plan</SectionTitle>
          {active ? (
            <Card style={styles.activeCard}>
              <Text style={typography.heading}>Studying now</Text>
              <Button label="Back to the session" variant="secondary" onPress={() => router.navigate(routes.focus)} />
            </Card>
          ) : derived.next ? (
            <NextPlanCard planner={planner} plan={derived.next} now={now} />
          ) : derived.proposed.length === 0 ? (
            <Card>
              <Text style={styles.cardTitle}>Nothing planned for today</Text>
              {derived.schedulableUnplanned.length > 0 ? (
                <>
                  <Text style={styles.body}>You have estimates ready. Studyling can spread study blocks before each deadline.</Text>
                  <Button label="Suggest my study plan" onPress={() => store.proposePlans()} />
                </>
              ) : derived.plannable > 0 ? (
                <>
                  <Text style={styles.body}>Choose an assessment and how long you think it’ll take; Studyling suggests study blocks before it’s due.</Text>
                  <Button label="Plan a study session" onPress={() => router.push('/planner/plan' as Href)} />
                </>
              ) : (
                <Text style={styles.body}>{derived.attention.length ? 'Answer the questions below so your assessments get dates; then you can plan study time.' : 'No upcoming dated assessments. Add a course or a deadline to start planning.'}</Text>
              )}
            </Card>
          ) : null}
          {derived.todayOthers.length > 0 && (
            <Card>
              {derived.todayOthers.map((p) => (
                <PlanRow key={p.id} planner={planner} plan={p} now={now} onPress={p.assignmentId ? () => router.push(`/planner/assignment/${p.assignmentId}` as Href) : undefined} />
              ))}
            </Card>
          )}

          {derived.proposed.length > 0 && (
            <Card>
              <Text style={styles.kicker}>Suggested by Studyling · not a course requirement</Text>
              <Text style={styles.body}>{`${derived.proposed.length} study block${derived.proposed.length === 1 ? '' : 's'} in your study times, before each deadline.`}</Text>
              {derived.proposed.slice(0, 4).map((p) => (
                <PlanRow key={p.id} planner={planner} plan={p} now={now} onPress={p.assignmentId ? () => router.push(`/planner/assignment/${p.assignmentId}` as Href) : undefined} />
              ))}
              {derived.proposed.length > 4 && <Text style={styles.muted}>{`+${derived.proposed.length - 4} more in Full week`}</Text>}
              <View style={styles.row2}>
                <Button label="Accept plan" sound="confirm" onPress={() => store.acceptAllProposed()} style={styles.flex} />
                <Button label="Not now" variant="ghost" onPress={() => store.discardProposals()} style={styles.flex} />
              </View>
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

          {(lastProposal?.warnings ?? []).concat(derived.capacity).filter((w, i, all) => all.findIndex((x) => x.assignmentId === w.assignmentId) === i)
            .filter((w) => planner.assignments[w.assignmentId]?.capacityNoteDismissedFor !== w.dueAt)
            .slice(0, 2)
            .map((w) => (
              <CapacityNote key={w.assignmentId} planner={planner} assignment={planner.assignments[w.assignmentId]!} warning={w} now={now} />
            ))}

          <SectionTitle>Upcoming deadlines</SectionTitle>
          <Card>
            {derived.upcoming.length === 0 && <Text style={styles.muted}>Nothing with a date in the next two weeks.</Text>}
            {derived.upcoming.map((a) => {
              const progress = assignmentProgress(planner, a.id, now);
              return (
                <AssignmentRow key={a.id} planner={planner} id={a.id} detail={`${formatDue(a.dueAt, a.dueDateOnly, tz, now)}${progress.plannedMinutes ? ` · ${formatMinutes(progress.plannedMinutes)} planned` : ''}`} flag={a.reviewState === 'needsReview' || a.reviewState === 'sourceConflict'} />
              );
            })}
          </Card>

          {derived.attention.length > 0 && (
            <>
              <SectionTitle>Needs your attention</SectionTitle>
              <Card style={styles.attentionCard}>
                {derived.attention.map((a) => (
                  <AssignmentRow key={a.id} planner={planner} id={a.id} detail={a.conditional && !a.conditional.anchorDayKey ? 'Which lecture were you assigned? Answer to get the date' : a.dueCandidates?.length ? 'Two possible dates: pick the right one' : 'Check this one before it can be planned'} flag />
                ))}
              </Card>
            </>
          )}

          {derived.undated.length > 0 && (
            <>
              <SectionTitle>Waiting for a date</SectionTitle>
              <Card style={styles.undatedCard}>
                {derived.undated.map((a) => (
                  <AssignmentRow key={a.id} planner={planner} id={a.id} detail={unresolvedText(a)} quiet />
                ))}
              </Card>
            </>
          )}

          <SectionTitle>Courses</SectionTitle>
          <Card>
            {Object.values(planner.courses)
              .filter((c) => c.active)
              .map((c, i) => {
                const items = liveAssignments(planner).filter((a) => a.courseId === c.id && a.status === 'open');
                return (
                  <Pressable key={c.id} style={styles.courseRow} onPress={() => router.push(`/planner/course/${c.id}` as Href)} accessibilityRole="button" accessibilityLabel={`${c.code ?? c.name}, ${items.length} open. Open course.`}>
                    <View style={styles.flexText}>
                      <CourseTag course={c} index={i} />
                      {c.code ? <Text style={styles.muted} numberOfLines={1}>{c.name}</Text> : null}
                    </View>
                    <Text style={styles.muted}>{`${items.length} open`}</Text>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
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

function AssignmentRow({ planner, id, detail, flag = false, quiet = false }: { planner: PlannerState; id: string; detail: string; flag?: boolean; quiet?: boolean }) {
  const a = planner.assignments[id]!;
  return (
    <Pressable onPress={() => router.push(`/planner/assignment/${a.id}` as Href)} style={styles.assignRow} accessibilityRole="button" accessibilityLabel={`${a.title}, ${planner.courses[a.courseId]?.code ?? planner.courses[a.courseId]?.name ?? ''}, ${detail}`}>
      <View style={styles.assignText}>
        <CourseTag course={planner.courses[a.courseId]} />
        <Text style={[styles.assignTitle, quiet && styles.assignQuiet]} numberOfLines={2}>
          {a.title}
        </Text>
        <Text style={styles.muted}>{detail}</Text>
      </View>
      {flag && <TrustBadge level="needsReview" compact />}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
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
    // Waiting on the student's answer (lecture, one of two dates) or a quick check of a dated item.
    attention: live.filter((a) => a.status === 'open' && ((!a.dueAt && (Boolean(a.conditional && !a.conditional.anchorDayKey) || Boolean(a.dueCandidates?.length))) || (a.dueAt && (a.reviewState === 'needsReview' || a.reviewState === 'sourceConflict')))),
    // No date and nothing to answer yet (exam period, TBA): listed separately, never as urgent.
    undated: live.filter((a) => a.status === 'open' && !a.dueAt && !(a.conditional && !a.conditional.anchorDayKey) && !a.dueCandidates?.length),
    plannable: live.filter((a) => a.status === 'open' && isSchedulable(a) && (a.dueAt ?? 0) > now).length,
    upcoming: upcomingAssignments(planner, now, 14).filter((a) => a.dueAt).slice(0, 6),
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
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6, minHeight: 52 },
  flexText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 17, fontWeight: '900', color: colors.text },
  kicker: { ...typography.label, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.primaryDark },
  importedCard: { borderWidth: 2, borderColor: colors.primarySoft },
  attentionCard: { backgroundColor: '#FFF8EC' },
  undatedCard: { backgroundColor: colors.surfaceMuted },
  assignQuiet: { color: colors.textMuted },
  footnote: { ...typography.label, textAlign: 'center' },
});
