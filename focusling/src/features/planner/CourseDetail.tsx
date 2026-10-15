import { router, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { assignmentProgress, liveAssignments } from '@/core';
import { useNow } from '@/hooks/useNow';
import { usePlannerStore } from '@/state';
import { Card, Pressable, colors, spacing, typography } from '@/ui';
import { CourseTag, InfoNote, SectionTitle } from './PlannerBits';
import { formatDayKey, formatDue, formatMinutes, minuteRange, TYPE_LABEL, weekdayShort } from './plannerCopy';

/**
 * One course as the syllabus describes it: who teaches it, when it meets,
 * how it's graded, what each week covers, its key dates, and its
 * assignments with the study time recorded for each. Local only.
 */
export function CourseDetailScreen({ id }: { id: string }) {
  const planner = usePlannerStore((s) => s.planner);
  const now = useNow(60_000);
  const course = planner?.courses[id];
  if (!planner || !course) {
    return (
      <Card>
        <Text style={styles.body}>This course isn’t in your planner.</Text>
      </Card>
    );
  }
  const d = course.details;
  const tz = course.timezone;
  const tasks = liveAssignments(planner).filter((a) => a.courseId === id).sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));

  return (
    <View style={styles.wrap}>
      <Card>
        <CourseTag course={course} />
        <Text style={typography.title}>{course.name}</Text>
        <Text style={styles.muted}>{[course.code, d?.identity.section ? `Section ${d.identity.section}` : null, course.term, d?.identity.institution].filter(Boolean).join(' · ')}</Text>
      </Card>

      {!d && <InfoNote icon="book">No course details were saved for this course. Importing its syllabus can add them.</InfoNote>}

      {d && (
        <Card>
          <SectionTitle>People and times</SectionTitle>
          {d.people.map((p) => (
            <Line key={`${p.role}${p.name}`} label={p.role === 'instructor' ? 'Instructor' : 'TA'} value={`${p.name}${p.email ? ` · ${p.email}` : ''}`} />
          ))}
          {d.meetings.map((m, i) => (
            <Line key={`m${i}`} label={m.kind[0]!.toUpperCase() + m.kind.slice(1)} value={`${weekdayShort(m.weekday)} ${minuteRange(m.startMinute, m.endMinute)}`.trim()} />
          ))}
          {d.officeHours.map((o, i) => (
            <Line key={`o${i}`} label={`Office hours${o.who ? ` (${o.who})` : ''}`} value={`${o.meetings.map((m) => `${weekdayShort(m.weekday)} ${minuteRange(m.startMinute, m.endMinute)}`.trim()).join(', ') || 'By appointment'}${o.where ? ` · ${o.where}` : ''}`} />
          ))}
          {!d.people.length && !d.meetings.length && !d.officeHours.length && <Text style={styles.muted}>Not specified in the syllabus.</Text>}
        </Card>
      )}

      {d?.grading && (
        <Card>
          <SectionTitle>Grading</SectionTitle>
          {d.grading.components.map((c) => (
            <Line key={c.name} label={c.name} value={`${c.weightPercent}%`} />
          ))}
          {!d.grading.addsUp && <Text style={styles.muted}>{`These add up to ${d.grading.totalPercent}% in the syllabus.`}</Text>}
        </Card>
      )}

      {d && d.schedule.length > 0 && (
        <Card>
          <SectionTitle>Weekly topics</SectionTitle>
          {d.schedule.map((w) => (
            <Line key={w.week} label={`Week ${w.week}${w.startDayKey ? ` · ${formatDayKey(w.startDayKey)}` : ''}`} value={`${w.topic}${w.readings ? ` · ${w.readings}` : ''}`} />
          ))}
        </Card>
      )}

      {d && (d.keyDates.length > 0 || d.policies.length > 0) && (
        <Card>
          <SectionTitle>Key dates and policies</SectionTitle>
          {d.keyDates.map((k, i) => (
            <Line key={`k${i}`} label={k.label} value={k.dayKey ? formatDayKey(k.dayKey) : 'Date not given'} />
          ))}
          {d.policies.length > 0 && <Line label="Policies in the syllabus" value={d.policies.map((p) => `${p.title} (p. ${p.provenance.page ?? 1})`).join(' · ')} />}
        </Card>
      )}

      <SectionTitle>{`Assignments (${tasks.length})`}</SectionTitle>
      <Card>
        {tasks.length === 0 && <Text style={styles.muted}>No assignments yet.</Text>}
        {tasks.map((a) => {
          const studied = assignmentProgress(planner, a.id, now).studiedMinutes;
          return (
            <Pressable key={a.id} onPress={() => router.push(`/planner/assignment/${a.id}` as Href)} style={styles.task} accessibilityRole="button" accessibilityLabel={`${a.title}, ${TYPE_LABEL[a.type]}, ${a.dueAt ? formatDue(a.dueAt, a.dueDateOnly, tz, now) : 'no date yet'}${studied ? `, ${formatMinutes(studied)} studied` : ''}${a.status === 'completed' ? ', done' : ''}`}>
              <View style={styles.flex}>
                <Text style={[styles.taskTitle, a.status === 'completed' && styles.done]}>{a.title}</Text>
                <Text style={styles.muted}>
                  {TYPE_LABEL[a.type]} · {a.dueAt ? formatDue(a.dueAt, a.dueDateOnly, tz, now) : 'No date yet'}
                  {a.weight !== undefined ? ` · ${a.weight}%` : ''}
                </Text>
              </View>
              <Text style={styles.studied}>{a.status === 'completed' ? 'Done' : studied ? formatMinutes(studied) : ''}</Text>
            </Pressable>
          );
        })}
      </Card>
      <Text style={styles.muted}>Course details stay on this device. Nothing is shared with other students.</Text>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  body: { ...typography.body, fontSize: 15, color: colors.textMuted },
  muted: { ...typography.label, lineHeight: 18 },
  flex: { flex: 1 },
  line: { gap: 2, paddingVertical: 4 },
  lineLabel: { ...typography.label },
  lineValue: { fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 21 },
  task: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border },
  taskTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  done: { textDecorationLine: 'line-through', color: colors.textMuted },
  studied: { fontSize: 13, fontWeight: '800', color: colors.primaryDark },
});
