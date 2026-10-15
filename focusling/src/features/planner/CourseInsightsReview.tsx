import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { ImportDraft, SyllabusInsights } from '@/core';
import { usePlannerStore } from '@/state';
import { Card, colors, radius, spacing, typography } from '@/ui';
import { InfoNote, SectionTitle } from './PlannerBits';
import { formatDayKey, minuteRange, weekdayShort } from './plannerCopy';
import { Toggle } from './Toggle';

/**
 * What Studyling understood about the course itself. Everything shown here
 * was written in the syllabus (with its page); empty sections say so plainly.
 */
export function CourseInsightsReview({ draft }: { draft: ImportDraft }) {
  const store = usePlannerStore.getState();
  const ins = draft.insights;
  const id = ins.identity;
  const instructors = ins.people.filter((p) => p.role === 'instructor');
  const tas = ins.people.filter((p) => p.role === 'ta');
  const hasEmails = ins.people.some((p) => p.email);

  return (
    <>
      <Card>
        <SectionTitle>Course details</SectionTitle>
        <Field label="Institution" value={id.institution} onChange={(institution) => store.setDraftIdentity({ institution })} />
        <Field label="Section" value={id.section} onChange={(section) => store.setDraftIdentity({ section })} />
        <Detail label="Term" value={id.term ? `${id.term.season[0]!.toUpperCase()}${id.term.season.slice(1)} ${id.term.year}` : null} />
        <Detail label="Instructor" value={instructors.map((p) => p.name).join(', ') || null} />
        {tas.length > 0 && <Detail label="Teaching assistants" value={tas.map((p) => p.name).join(', ')} />}
        <Detail label="Class times" value={meetingsText(ins) || null} />
        <Detail label="Office hours" value={ins.officeHours.map((o) => `${o.who ? `${o.who}: ` : ''}${o.meetings.map((m) => `${weekdayShort(m.weekday)} ${minuteRange(m.startMinute, m.endMinute)}`.trim()).join(', ') || 'by appointment'}${o.where ? ` · ${o.where}` : ''}`).join('\n') || null} />
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.switchTitle}>Save course details</Text>
            <Text style={styles.muted}>Kept on this device only, with your course.</Text>
          </View>
          <Toggle value={draft.details.save} onValueChange={(save) => store.setDraftDetails({ save })} accessibilityLabel="Save course details" />
        </View>
        {hasEmails && draft.details.save && (
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={styles.switchTitle}>Include email addresses</Text>
              <Text style={styles.muted}>Off by default. Names are saved either way.</Text>
            </View>
            <Toggle value={draft.details.saveContacts} onValueChange={(saveContacts) => store.setDraftDetails({ saveContacts })} accessibilityLabel="Include email addresses" />
          </View>
        )}
      </Card>

      {ins.grading && (
        <Card>
          <SectionTitle>Grading</SectionTitle>
          {ins.grading.components.map((c) => (
            <View key={c.name} style={styles.gradeRow} accessible accessibilityLabel={`${c.name}: ${c.weightPercent} percent${c.count ? `, ${c.count} items` : ''}. Page ${c.provenance.page ?? 1}.`}>
              <Text style={styles.gradeName}>
                {c.name}
                {c.count ? ` (${c.count})` : ''}
              </Text>
              <Text style={styles.gradePct}>{c.weightPercent}%</Text>
            </View>
          ))}
          <View style={styles.gradeRow}>
            <Text style={styles.gradeTotal}>Total</Text>
            <Text style={styles.gradeTotal}>{ins.grading.totalPercent}%</Text>
          </View>
          {!ins.grading.addsUp && <InfoNote icon="book">{`These add up to ${ins.grading.totalPercent}%, not 100%. Check the syllabus; Studyling won’t guess the missing part.`}</InfoNote>}
        </Card>
      )}

      {(ins.schedule.length > 0 || ins.coverage.length > 0 || ins.keyDates.length > 0 || ins.policies.length > 0 || (ins.lectures ?? []).length > 0) && (
        <Card>
          <SectionTitle>Course structure</SectionTitle>
          {ins.schedule.length > 0 && <Detail label="Weekly topics" value={`${ins.schedule.length} weeks, e.g. “${ins.schedule[0]!.topic}”`} />}
          {ins.coverage.map((c) => (
            <Detail key={c.itemKey} label={c.itemTitle} value={`Covers ${c.weeks ? `Weeks ${c.weeks.from}–${c.weeks.to}` : c.chapters} (page ${c.provenance.page ?? 1})`} />
          ))}
          {ins.keyDates.map((k) => (
            <Detail key={`${k.label}${k.provenance.line}`} label={k.label} value={k.dayKey ? formatDayKey(k.dayKey) : 'Date not given'} />
          ))}
          {(ins.lectures ?? []).length > 0 && <Detail label="Lecture schedule" value={(ins.lectures ?? []).map((l) => `${l.number}. ${l.topic}`).join('\n')} />}
          {ins.policies.map((p) => (
            <Detail key={`${p.title}${p.provenance.line}`} label={p.title} value={p.summary ?? 'Mentioned in the syllabus'} />
          ))}
          <Text style={styles.muted}>Course dates like drop deadlines are saved with the course, not added as tasks.</Text>
        </Card>
      )}

    </>
  );
}

/** "Classes: Tue/Thu 8:35–9:55 AM · McMed 522". */
export function meetingsText(ins: Pick<SyllabusInsights, 'meetings'>): string {
  const groups = new Map<string, number[]>();
  for (const m of ins.meetings) {
    const k = `${m.kind}|${minuteRange(m.startMinute, m.endMinute)}|${m.location ?? ''}`;
    groups.set(k, [...(groups.get(k) ?? []), m.weekday]);
  }
  return [...groups.entries()]
    .map(([k, days]) => {
      const [kind, time, where] = k.split('|');
      const label = kind === 'class' ? 'Classes' : `${kind![0]!.toUpperCase()}${kind!.slice(1)}s`;
      return `${label}: ${days.map(weekdayShort).join('/')}${time ? ` ${time}` : ''}${where ? ` · ${where}` : ''}`;
    })
    .join('\n');
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.detail} accessible accessibilityLabel={`${label}: ${value ?? 'Not specified'}`}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, !value && styles.notSpecified]}>{value ?? 'Not specified'}</Text>
    </View>
  );
}

function Field({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string) => void }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <TextInput value={value ?? ''} onChangeText={onChange} placeholder="Not specified" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { ...typography.label, lineHeight: 18 },
  flex: { flex: 1 },
  detail: { gap: 2 },
  detailLabel: { ...typography.label },
  detailValue: { fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 21 },
  notSpecified: { color: colors.textMuted, fontStyle: 'italic', fontWeight: '600' },
  input: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: 15, color: colors.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  gradeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 4, borderBottomWidth: 1, borderColor: colors.border },
  gradeName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  gradePct: { fontSize: 15, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'] },
  gradeTotal: { fontSize: 15, fontWeight: '900', color: colors.primaryDark },
  diff: { fontSize: 14, fontWeight: '700', color: colors.primaryDark },
});
