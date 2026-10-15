import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isSchedulable, liveAssignments } from '@/core';
import { useNow } from '@/hooks/useNow';
import { usePlannerStore } from '@/state';
import { Button, Card, Pressable, colors, radius, spacing, typography } from '@/ui';
import { EffortField } from './AssignmentFields';
import { PlanRow } from './PlanCard';
import { CourseTag, InfoNote, SectionTitle } from './PlannerBits';
import { formatDue, formatMinutes } from './plannerCopy';

/**
 * "Plan a study session": choose an assessment with a confirmed date, give
 * YOUR estimate (Studyling never guesses one), see suggested blocks before the
 * deadline, then accept, change or skip them. Suggestions are Studyling's,
 * never course requirements.
 */
export function PlanStudy({ initialId }: { initialId?: string }) {
  const planner = usePlannerStore((s) => s.planner);
  const now = useNow(60_000);
  const [picked, setPicked] = useState<string | null>(initialId ?? null);
  const [suggested, setSuggested] = useState(false);
  const store = usePlannerStore.getState();
  if (!planner) return null;
  const tz = planner.preferences.timezone;
  const choices = liveAssignments(planner)
    .filter((a) => a.status === 'open' && isSchedulable(a) && (a.dueAt ?? 0) > now)
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
  const a = picked ? planner.assignments[picked] : undefined;

  if (!a) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title} accessibilityRole="header">
          What do you want to work on?
        </Text>
        {choices.length === 0 ? (
          <InfoNote icon="book">Nothing has a confirmed date yet. Answer the questions on your assessments first (for example “Which lecture were you assigned?”), then come back.</InfoNote>
        ) : (
          <Card>
            {choices.map((c) => (
              <Pressable key={c.id} onPress={() => setPicked(c.id)} style={styles.row} accessibilityRole="button" accessibilityLabel={`${c.title}, ${planner.courses[c.courseId]?.code ?? ''}, ${formatDue(c.dueAt, c.dueDateOnly, tz, now)}`}>
                <View style={styles.flex}>
                  <CourseTag course={planner.courses[c.courseId]} />
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {c.title}
                  </Text>
                  <Text style={styles.muted}>{`${formatDue(c.dueAt, c.dueDateOnly, tz, now)}${c.estimatedMinutes ? ` · your estimate ${formatMinutes(c.estimatedMinutes)}` : ''}`}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </Card>
        )}
        <Button label="Not now" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  const proposals = Object.values(planner.plans)
    .filter((p) => p.assignmentId === a.id && p.status === 'proposed')
    .sort((x, y) => x.plannedStartAt - y.plannedStartAt);
  const result = usePlannerStore.getState().lastProposal;

  return (
    <View style={styles.wrap}>
      <Card>
        <CourseTag course={planner.courses[a.courseId]} />
        <Text style={typography.heading}>{a.title}</Text>
        <Text style={styles.muted}>{formatDue(a.dueAt, a.dueDateOnly, tz, now)}</Text>
      </Card>
      <Card>
        <Text style={styles.label}>How long do you think it will take you?</Text>
        <EffortField
          value={a.estimatedMinutes ?? null}
          onChange={(estimatedMinutes) => {
            store.updateAssignment(a.id, { estimatedMinutes });
            setSuggested(false);
          }}
        />
        <Text style={styles.muted}>Your own guess. You can change it any time; Studyling never estimates for you.</Text>
        <Button
          label={proposals.length ? 'Suggest again' : 'Suggest study blocks'}
          disabled={!a.estimatedMinutes}
          onPress={() => {
            store.discardProposals(a.id);
            store.proposePlans([a.id]);
            setSuggested(true);
          }}
        />
      </Card>

      {suggested && (
        <Card>
          <Text style={styles.kicker}>Suggested by Studyling · not a course requirement</Text>
          {proposals.length ? (
            <>
              <Text style={styles.body}>{`${proposals.length} block${proposals.length === 1 ? '' : 's'} in your study times before the deadline. Accept them, or skip and plan your own way.`}</Text>
              {proposals.map((p) => (
                <PlanRow key={p.id} planner={planner} plan={p} now={now} />
              ))}
              <View style={styles.row2}>
                <Button
                  label="Accept these blocks"
                  sound="confirm"
                  onPress={() => {
                    store.acceptAllProposed(a.id);
                    router.back();
                  }}
                  style={styles.grow}
                />
                <Button
                  label="Skip"
                  variant="ghost"
                  onPress={() => {
                    store.discardProposals(a.id);
                    setSuggested(false);
                  }}
                  style={styles.grow}
                />
              </View>
              <Button label="Change my study times" variant="ghost" onPress={() => router.push('/planner/settings' as Href)} />
            </>
          ) : (
            <Text style={styles.body}>{result?.warnings?.length ? 'There isn’t enough free study time before the deadline for that estimate. Try a smaller estimate, or add study times in Reminders & time.' : 'No free study time was found before the deadline. Add study times in Reminders & time, then try again.'}</Text>
          )}
        </Card>
      )}
      <Button label="Choose a different assessment" variant="ghost" onPress={() => { setPicked(null); setSuggested(false); }} />
      <SectionTitle>How it works</SectionTitle>
      <Text style={styles.muted}>Blocks fit your study times and leave a buffer before the deadline. Studying counts toward this assessment once, in Planner, Stats and Journey. It never marks the assessment done; you do.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  title: { fontSize: 22, fontWeight: '900', color: colors.text },
  body: { ...typography.body, fontSize: 15, color: colors.textMuted, lineHeight: 21 },
  muted: { ...typography.label, lineHeight: 18 },
  label: { ...typography.label, color: colors.text, fontSize: 15 },
  kicker: { ...typography.label, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.primaryDark },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border },
  rowTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  flex: { flex: 1, gap: 2 },
  chevron: { fontSize: 22, fontWeight: '900', color: colors.textMuted },
  row2: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grow: { flexGrow: 1, flexBasis: 140 },
  card: { borderRadius: radius.lg },
});
