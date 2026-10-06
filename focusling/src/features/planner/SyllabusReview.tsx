import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Toggle } from './Toggle';
import { describeReason, draftCounts, worst, type DraftItem, type ImportDraft } from '@/core';
import { playSound } from '@/services/audio';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { usePlannerStore } from '@/state';
import { Button, Card, Pressable, colors, radius, spacing, typography } from '@/ui';
import { DateField, EffortField, TimeField, TypeChips } from './AssignmentFields';
import { InfoNote, SectionTitle, TrustBadge } from './PlannerBits';
import { formatDayKey, formatMinutes, TYPE_LABEL } from './plannerCopy';

/**
 * Student review: nothing from a syllabus is planned or reminded until the
 * student has seen it here. Uncertain fields are obvious (badge + words +
 * a soft outline), never alarming. Edits confirm fields; "Add" persists.
 */
export function SyllabusReview() {
  const draft = usePlannerStore((s) => s.draft);
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const routes = useAppRoutes();
  const store = usePlannerStore.getState();
  if (!draft) {
    return (
      <Card>
        <Text style={styles.body}>Nothing to review. Import a syllabus first.</Text>
        <Button label="Import a syllabus" onPress={() => router.replace('/planner/import' as Href)} />
      </Card>
    );
  }
  const counts = draftCounts(draft);

  if (draft.duplicateOfSyllabusId) {
    return (
      <Card>
        <Text style={typography.heading}>Already imported</Text>
        <Text style={styles.body}>This syllabus matches one you already reviewed. Nothing changed, so nothing new was added.</Text>
        <Button
          label="Back to Planner"
          onPress={() => {
            store.cancelDraft();
            router.dismissTo(routes.planner as Href);
          }}
        />
      </Card>
    );
  }

  const add = () => {
    const res = store.commitDraft(keepOriginal);
    if (!res) return;
    playSound('confirm');
    // Plan right away for anything with a reviewed date and an estimate.
    usePlannerStore.getState().proposePlans(res.assignmentIds.length ? res.assignmentIds : undefined);
    router.dismissTo(routes.planner as Href);
  };

  return (
    <View style={styles.wrap}>
      {draft.courses.map((c) => (
        <Card key={c.index}>
          <Text style={styles.kicker}>{c.existingCourseId ? 'Updating course' : 'New course'}</Text>
          <TextInput value={c.name} onChangeText={(name) => store.setDraftCourse(c.index, { name })} style={styles.courseName} accessibilityLabel="Course name" />
          <Text style={styles.muted}>
            {[c.code, c.term, `times in ${c.timezone.replace(/_/g, ' ')}`].filter(Boolean).join(' · ')}
          </Text>
        </Card>
      ))}

      <View style={styles.summary} accessible accessibilityLabel={`${counts.found} items found. ${counts.needsReview} need review. ${counts.confirmed} confirmed.`}>
        <Stat n={counts.found} label="found" />
        <Stat n={counts.needsReview} label="need review" />
        <Stat n={counts.confirmed} label="confirmed" />
      </View>

      {draft.revisionOfSyllabusId && (counts.changed > 0 || counts.removed > 0) && (
        <InfoNote icon="planner">
          This looks like an updated syllabus: {counts.changed} changed, {counts.removed} no longer listed. Your own edits are kept; anything that conflicts is flagged.
        </InfoNote>
      )}
      {counts.needsReview > 0 && <InfoNote icon="book">Items marked “Needs review” won’t be planned or reminded until you fix or confirm them.</InfoNote>}

      <SectionTitle>{`Items (${counts.included} included)`}</SectionTitle>
      {draft.items.map((item) => (
        <ReviewItem key={item.key} item={item} draft={draft} open={open === item.key} onToggle={() => setOpen((o) => (o === item.key ? null : item.key))} />
      ))}

      <Card>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.switchTitle}>Keep the original on this device</Text>
            <Text style={styles.muted}>Off by default. Studyling keeps only the dates and titles you confirm, plus where they came from.</Text>
          </View>
          <Toggle value={keepOriginal} onValueChange={setKeepOriginal} accessibilityLabel="Keep the original on this device" />
        </View>
      </Card>

      <Button label={`Add ${counts.included} item${counts.included === 1 ? '' : 's'} to planner`} onPress={add} disabled={counts.included === 0} sound={null} />
      <Button
        label="Cancel import"
        variant="ghost"
        onPress={() => {
          store.cancelDraft();
          router.back();
        }}
      />
    </View>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ReviewItem({ item, draft, open, onToggle }: { item: DraftItem; draft: ImportDraft; open: boolean; onToggle: () => void }) {
  const store = usePlannerStore.getState();
  const level = worst(item.confidence.title, item.confidence.type, item.confidence.due);
  const due = item.recurrence ? `Every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][item.recurrence.weekday]}${item.dueTime ? ` · ${item.dueTime}` : ''} (weekly)` : item.dueDayKey ? `${formatDayKey(item.dueDayKey)}${item.dueTime ? ` · ${item.dueTime}` : ' · date only'}` : 'No date';
  const where = item.provenance[0] ? `From page ${item.provenance[0].page ?? 1}, line ${item.provenance[0].line}${item.provenance.length > 1 ? ` (and ${item.provenance.length - 1} more place)` : ''}` : '';
  const removed = item.change === 'removed';

  return (
    <View style={[styles.item, level === 'needsReview' && styles.itemReview, !item.include && styles.itemOff]}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${item.title}, ${TYPE_LABEL[item.type]}, ${due}. ${removed ? 'No longer listed. ' : ''}Trust: ${level}. ${open ? 'Collapse' : 'Edit'}.`} style={styles.itemHead}>
        <View style={styles.flex}>
          <View style={styles.badges}>
            <TrustBadge level={level} />
            {item.change === 'changed' && <Text style={styles.changeTag}>Changed</Text>}
            {item.change === 'new' && draft.revisionOfSyllabusId && <Text style={styles.changeTag}>New</Text>}
            {removed && <Text style={styles.changeTag}>No longer listed</Text>}
            {!item.include && <Text style={styles.changeTag}>Excluded</Text>}
          </View>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.muted}>
            {TYPE_LABEL[item.type]} · {due}
            {item.estimatedMinutes ? ` · ${formatMinutes(item.estimatedMinutes)}` : ''}
          </Text>
          {item.diffs?.map((d) => (
            <Text key={d.field} style={styles.diff}>
              {d.field === 'due' ? 'Date changed' : d.field === 'title' ? `Title was “${d.from}”` : `Type was ${d.from}`}
            </Text>
          ))}
          {item.reasons.map((r) => (
            <Text key={r} style={styles.reason}>
              {describeReason(r)}
            </Text>
          ))}
        </View>
        <Text style={styles.chevron}>{open ? '⌃' : '›'}</Text>
      </Pressable>

      {open && !removed && (
        <View style={styles.editor}>
          {item.dueOptions && (
            <View style={styles.options}>
              <Text style={styles.label}>Which date is right?</Text>
              {item.dueOptions.map((o) => (
                <Button key={o} label={formatDayKey(o)} variant={item.dueDayKey === o ? 'primary' : 'secondary'} onPress={() => store.editDraftItem(item.key, { dueDayKey: o })} />
              ))}
            </View>
          )}
          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <TextInput value={item.title} onChangeText={(title) => store.editDraftItem(item.key, { title })} style={styles.input} accessibilityLabel="Title" />
          </View>
          <TypeChips value={item.type} onChange={(type) => store.editDraftItem(item.key, { type })} />
          {!item.recurrence && <DateField value={item.dueDayKey} onChange={(dueDayKey) => store.editDraftItem(item.key, { dueDayKey })} />}
          <TimeField value={item.dueTime} onChange={(dueTime) => store.editDraftItem(item.key, { dueTime })} />
          <EffortField value={item.estimatedMinutes} onChange={(estimatedMinutes) => store.editDraftItem(item.key, { estimatedMinutes })} />
          {where ? <Text style={styles.muted}>{where}</Text> : null}
          {item.snippet ? <Text style={styles.snippet}>“{item.snippet}”</Text> : null}
          <View style={styles.row}>
            {level !== 'confirmed' && (item.dueDayKey || item.recurrence) && <Button label="Looks right" variant="secondary" onPress={() => store.confirmDraftItem(item.key)} style={styles.flexBtn} />}
            <Button label={item.include ? 'Exclude' : 'Include'} variant="ghost" onPress={() => store.editDraftItem(item.key, { include: !item.include })} style={styles.flexBtn} />
          </View>
        </View>
      )}
      {open && removed && (
        <View style={styles.editor}>
          <Text style={styles.body}>The updated syllabus doesn’t list this anymore. Keep it in your planner, or remove it?</Text>
          <View style={styles.row}>
            <Button label="Keep it" variant={item.include ? 'primary' : 'secondary'} onPress={() => store.editDraftItem(item.key, { include: true })} style={styles.flexBtn} />
            <Button label="Remove it" variant={!item.include ? 'primary' : 'secondary'} onPress={() => store.editDraftItem(item.key, { include: false })} style={styles.flexBtn} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  body: { ...typography.body, fontSize: 15, color: colors.textMuted, lineHeight: 21 },
  muted: { ...typography.label, lineHeight: 18 },
  kicker: { ...typography.label, textTransform: 'uppercase', letterSpacing: 0.8 },
  courseName: { ...typography.heading, minHeight: 44, borderBottomWidth: 1, borderColor: colors.border },
  summary: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  statN: { fontSize: 24, fontWeight: '900', color: colors.text },
  statLabel: { ...typography.label, textAlign: 'center' },
  item: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  itemReview: { borderColor: '#F5D7A3', borderStyle: 'dashed' },
  itemOff: { opacity: 0.6 },
  itemHead: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, minHeight: 56 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  changeTag: { fontSize: 12, fontWeight: '800', color: colors.primaryDark, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  itemTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  diff: { fontSize: 13, fontWeight: '700', color: colors.primaryDark, marginTop: 2 },
  reason: { fontSize: 13, color: '#8A4B00', marginTop: 2 },
  chevron: { fontSize: 22, fontWeight: '900', color: colors.textMuted },
  editor: { gap: spacing.md, padding: spacing.md, paddingTop: 0 },
  options: { gap: spacing.sm },
  field: { gap: 6 },
  label: { ...typography.label, color: colors.text },
  input: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: 15, color: colors.text },
  snippet: { fontSize: 13, fontStyle: 'italic', color: colors.textMuted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  flex: { flex: 1 },
  flexBtn: { flexGrow: 1, flexBasis: 120 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
});
