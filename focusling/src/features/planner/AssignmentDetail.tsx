import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { assignmentProgress, capacityFor, dayKeyIn, describeReason, isSchedulable, timeOfDay, worst, type AssignmentField } from '@/core';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { useNow } from '@/hooks/useNow';
import { useActiveSession, usePlannerStore } from '@/state';
import { Button, Card, colors, radius, spacing, typography } from '@/ui';
import { DateField, EffortField, TimeField, TypeChips } from './AssignmentFields';
import { CapacityNote } from './CapacityNote';
import { PlanRow } from './PlanCard';
import { CourseTag, InfoNote, SectionTitle, TrustBadge } from './PlannerBits';
import { formatClock, formatDay, formatDue, formatMinutes, START_CONTEXT_LABEL, TYPE_LABEL } from './plannerCopy';

const SOURCE_LABEL = { parser: 'From a syllabus (not yet reviewed)', syllabus: 'From a reviewed syllabus', lms: 'From your class site', user: 'Added by you' } as const;

export function AssignmentDetail({ id, editEstimate = false }: { id: string; editEstimate?: boolean }) {
  const planner = usePlannerStore((s) => s.planner);
  const now = useNow(30_000);
  const active = useActiveSession();
  const routes = useAppRoutes();
  const [editing, setEditing] = useState(editEstimate);
  const [title, setTitle] = useState<string | null>(null);
  const store = usePlannerStore.getState();
  const a = planner?.assignments[id];
  if (!planner || !a || a.deletedAt) {
    return (
      <Card>
        <Text style={styles.body}>This assignment isn’t in your planner.</Text>
      </Card>
    );
  }
  const course = planner.courses[a.courseId];
  const tz = course?.timezone ?? planner.preferences.timezone;
  const progress = assignmentProgress(planner, a.id, now);
  const capacity = capacityFor(planner, a.id, now);
  const syllabus = a.syllabusId ? planner.syllabi[a.syllabusId] : undefined;
  const level = worst(a.fieldConfidence.title, a.fieldConfidence.type, a.fieldConfidence.due);
  const current = progress.upcomingPlans[0];
  const plannedNow = current && current.plannedStartAt - 15 * 60_000 <= now;
  const dueKey = a.dueAt ? dayKeyIn(a.dueAt, tz) : null;
  const dueTime = a.dueAt && !a.dueDateOnly ? timeOfDay(a.dueAt, tz) : null;

  const startPlanned = async () => {
    if (!current) return;
    const r = await store.startPlan(current.id, 'planner');
    if (r.ok) router.navigate(routes.focus);
  };
  const startUnplanned = async () => {
    const r = await store.startStudy({ assignmentId: a.id, minutes: planner.preferences.preferredSessionMinutes, source: 'app' });
    if (r.ok) router.navigate(routes.focus);
  };

  return (
    <View style={styles.wrap}>
      <Card>
        <View style={styles.rowBetween}>
          <CourseTag course={course} />
          <TrustBadge level={a.reviewState === 'sourceConflict' ? 'needsReview' : level} />
        </View>
        <Text style={typography.title}>{a.title}</Text>
        <Text style={styles.meta}>
          {TYPE_LABEL[a.type]} · {formatDue(a.dueAt, a.dueDateOnly, tz, now)}
          {a.status === 'completed' ? ' · Done' : ''}
        </Text>
        <Text style={styles.muted}>
          {SOURCE_LABEL[a.sourceAuthority]}
          {syllabus ? ` · ${syllabus.filename ?? 'pasted text'}, revision ${syllabus.revision}` : ''}
          {a.provenance ? ` · page ${a.provenance.page ?? 1}, line ${a.provenance.line}` : ''}
        </Text>
        {a.missingFromSource && <Text style={styles.reason}>The latest syllabus doesn’t list this anymore.</Text>}
        {(a.reviewReasons ?? []).map((r) => (
          <Text key={r} style={styles.reason}>
            {describeReason(r)}
          </Text>
        ))}
      </Card>

      {a.conflicts &&
        (Object.entries(a.conflicts) as [AssignmentField, { sourceValue: string }][]).map(([field, c]) => (
          <Card key={field}>
            <Text style={typography.heading}>The {field === 'due' ? 'due date' : field} changed at the source</Text>
            <Text style={styles.body}>You edited this, so Studyling kept your version. The source now says {field === 'due' ? formatSourceDate(c.sourceValue, tz) : `“${c.sourceValue}”`}.</Text>
            <View style={styles.row}>
              <Button label="Keep mine" variant="secondary" onPress={() => store.resolveConflict(a.id, field, 'mine')} style={styles.flex} />
              <Button label="Use the new one" variant="secondary" onPress={() => store.resolveConflict(a.id, field, 'source')} style={styles.flex} />
            </View>
          </Card>
        ))}

      {a.reviewState === 'needsReview' && !editing && (
        <InfoNote icon="book">This item needs a quick look before Studyling plans it or sends any reminder.{a.dueAt ? '' : ' Add its due date.'}</InfoNote>
      )}

      {a.status === 'open' && !active && (
        <>
          {current && plannedNow ? (
            <Button label={`Start planned ${current.plannedMinutes} min`} onPress={() => void startPlanned()} sound={null} accessibilityHint="Starts your planned session with your protection settings" />
          ) : (
            <Button label="Start & Lock now" onPress={() => void startUnplanned()} sound={null} accessibilityHint={`Starts a ${planner.preferences.preferredSessionMinutes} minute study session for this assignment`} />
          )}
        </>
      )}

      <Card>
        <View style={styles.stats}>
          <Stat label="Estimate" value={a.estimatedMinutes ? formatMinutes(a.estimatedMinutes) : 'Not set'} />
          <Stat label="Studied" value={formatMinutes(progress.studiedMinutes)} />
          <Stat label="Planned" value={formatMinutes(progress.plannedMinutes)} />
          <Stat label="Remaining" value={progress.remainingMinutes === null ? '—' : formatMinutes(progress.remainingMinutes)} />
        </View>
        {!a.estimatedMinutes && <Text style={styles.muted}>Add your own estimate so Studyling can plan study blocks.</Text>}
      </Card>

      {capacity && <CapacityNote planner={planner} assignment={a} warning={capacity} now={now} />}

      {editing ? (
        <Card>
          <Text style={typography.heading}>Edit</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <TextInput value={title ?? a.title} onChangeText={setTitle} onBlur={() => title !== null && title.trim() && title !== a.title && store.updateAssignment(a.id, { title })} style={styles.input} accessibilityLabel="Title" />
          </View>
          <TypeChips value={a.type} onChange={(type) => store.updateAssignment(a.id, { type })} />
          <DateField value={dueKey} onChange={(k) => k && store.updateAssignment(a.id, { dueDayKey: k })} />
          <TimeField value={dueTime} onChange={(t) => store.updateAssignment(a.id, { dueTime: t })} />
          <EffortField value={a.estimatedMinutes ?? null} onChange={(m) => store.updateAssignment(a.id, { estimatedMinutes: m })} />
          <View style={styles.row}>
            {a.reviewState === 'needsReview' && a.dueAt && <Button label="Looks right" variant="secondary" onPress={() => store.confirmAssignment(a.id)} style={styles.flex} />}
            <Button
              label="Done"
              variant="ghost"
              onPress={() => {
                if (title !== null && title.trim() && title !== a.title) store.updateAssignment(a.id, { title });
                setTitle(null);
                setEditing(false);
              }}
              style={styles.flex}
            />
          </View>
        </Card>
      ) : (
        <View style={styles.row}>
          <Button label="Edit details" variant="secondary" onPress={() => setEditing(true)} style={styles.flex} />
          {isSchedulable(a) && a.estimatedMinutes ? <Button label={progress.upcomingPlans.length ? 'Re-plan' : 'Plan study'} variant="secondary" onPress={() => store.proposePlans([a.id])} style={styles.flex} /> : null}
        </View>
      )}

      {progress.proposedPlans.length > 0 && (
        <Card>
          <Text style={typography.heading}>Proposed blocks</Text>
          {progress.proposedPlans.map((p) => (
            <PlanRow key={p.id} planner={planner} plan={p} now={now} />
          ))}
          <View style={styles.row}>
            <Button label="Accept" sound="confirm" onPress={() => store.acceptAllProposed(a.id)} style={styles.flex} />
            <Button label="Discard" variant="ghost" onPress={() => store.discardProposals(a.id)} style={styles.flex} />
          </View>
        </Card>
      )}

      <SectionTitle>Planned study</SectionTitle>
      <Card>
        {progress.upcomingPlans.length === 0 && <Text style={styles.muted}>No accepted blocks yet.</Text>}
        {progress.upcomingPlans.map((p) => (
          <View key={p.id} style={styles.planLine}>
            <View style={styles.flex}>
              <PlanRow planner={planner} plan={p} now={now} />
            </View>
            <View style={styles.planActions}>
              <Button label="Later" variant="ghost" onPress={() => store.reschedulePlan(p.id, p.plannedStartAt + 24 * 3_600_000)} />
              <Button label="Skip" variant="ghost" onPress={() => store.skipPlan(p.id)} />
            </View>
          </View>
        ))}
      </Card>

      {progress.sessions.length > 0 && (
        <>
          <SectionTitle>Study history</SectionTitle>
          <Card>
            {progress.sessions.map((s) => (
              <View key={s.id} style={styles.history} accessible accessibilityLabel={`${formatDay(s.actualStartAt, tz, now)}: ${formatMinutes(s.actualFocusedMinutes)} studied, ${s.outcome === 'completed' ? 'completed' : 'ended early'}. ${START_CONTEXT_LABEL[s.startContext]}.`}>
                <Text style={styles.historyMain}>
                  {formatDay(s.actualStartAt, tz, now)}, {formatClock(s.actualStartAt, tz)} · {formatMinutes(s.actualFocusedMinutes)}
                  {s.outcome === 'endedEarly' ? ' · ended early' : ''}
                </Text>
                <Text style={styles.muted}>
                  {START_CONTEXT_LABEL[s.startContext]}
                  {s.protectionRequested ? (s.protectionActivated ? ' · protected' : ' · not protected') : ''}
                  {s.retrievalCompleted ? ' · recall done' : ''}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}

      <View style={styles.row}>
        {a.status === 'open' ? (
          <Button label="Mark as done" variant="secondary" sound="confirm" onPress={() => store.completeAssignment(a.id)} style={styles.flex} />
        ) : (
          <Button label="Not done yet" variant="secondary" onPress={() => store.reopenAssignment(a.id)} style={styles.flex} />
        )}
        <Button
          label="Remove"
          variant="ghost"
          onPress={() => {
            store.deleteAssignment(a.id);
            router.back();
          }}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

function formatSourceDate(v: string, tz: string) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? `${formatDay(n, tz)}, ${formatClock(n, tz)}` : 'no date';
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  meta: { ...typography.body, fontSize: 15, fontWeight: '700' },
  muted: { ...typography.label, lineHeight: 18 },
  body: { ...typography.body, fontSize: 15, color: colors.textMuted, lineHeight: 21 },
  reason: { fontSize: 13, color: '#8A4B00' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  flex: { flexGrow: 1, flexBasis: 130 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { flexGrow: 1, flexBasis: 70, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '900', color: colors.text },
  field: { gap: 6 },
  label: { ...typography.label, color: colors.text },
  input: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: 15, color: colors.text },
  planLine: { gap: 2 },
  planActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  history: { paddingVertical: 6, gap: 2 },
  historyMain: { fontSize: 15, fontWeight: '700', color: colors.text },
});
