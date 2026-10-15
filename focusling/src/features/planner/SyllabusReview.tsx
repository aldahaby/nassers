import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Toggle } from './Toggle';
import { conditionalRuleText, describeReason, draftAttention, draftCounts, lectureDayKey, placementYear, trustStatusOf, worst, type AttentionItem, type DraftItem, type ImportDraft } from '@/core';
import { playSound } from '@/services/audio';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { useDebugToolsEnabled, usePlannerStore } from '@/state';
import { Button, Card, Pressable, colors, radius, spacing, typography } from '@/ui';
import { Chips, DateField, EffortField, TimeField, TypeChips } from './AssignmentFields';
import { CourseInsightsReview, meetingsText } from './CourseInsightsReview';
import { InfoNote, SectionTitle, StatusPill } from './PlannerBits';
import { draftDueText, formatDayKey, formatMinutes, monthDay, seasonYear, timeLabel, TRUST_STATUS_LABEL, TYPE_LABEL } from './plannerCopy';

/**
 * "Your syllabus is ready!" Nothing from a syllabus is planned or reminded
 * until the student has seen it here. The screen leads with what matters
 * (the course, its important dates, and only the questions that genuinely
 * need the student); everything else is one tap away. Diagnostics live in
 * the Developer view only.
 */
export function SyllabusReview() {
  const draft = usePlannerStore((s) => s.draft);
  const [stage, setStage] = useState<'ready' | 'confirm'>('ready');
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [moreDetails, setMoreDetails] = useState(false);
  const debug = useDebugToolsEnabled();
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

  const attention = draftAttention(draft);
  const included = draft.items.filter((i) => i.include && i.change !== 'removed');
  const scheduled = included.filter((i) => i.dueDayKey || i.recurrence);

  if (stage === 'confirm') {
    return (
      <View style={styles.wrap}>
        <Card>
          <Text style={typography.heading}>Add to your planner</Text>
          <Text style={styles.body}>
            {`${counts.included} item${counts.included === 1 ? '' : 's'} from ${draft.courses[0]?.code ?? draft.courses[0]?.name ?? 'this course'}. ${scheduled.length} with a date${included.length > scheduled.length ? `, ${included.length - scheduled.length} without one yet (saved, but not planned or reminded until they have a date)` : ''}.`}
          </Text>
          {included.map((i) => (
            <View key={i.key} style={styles.confirmRow}>
              <Text style={styles.confirmTitle} numberOfLines={2}>
                {i.title}
              </Text>
              <Text style={styles.confirmDue}>{draftDueText(i, draft)}</Text>
            </View>
          ))}
          {draft.items.some((i) => i.change === 'removed') && <Text style={styles.muted}>{`${counts.removed} item${counts.removed === 1 ? '' : 's'} the updated syllabus no longer lists ${counts.removed === 1 ? 'is' : 'are'} handled as you chose.`}</Text>}
        </Card>
        <Card>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={styles.switchTitle}>Save course details</Text>
              <Text style={styles.muted}>Instructors, class times, grading and policies, kept on this device with your course.</Text>
            </View>
            <Toggle value={draft.details.save} onValueChange={(save) => store.setDraftDetails({ save })} accessibilityLabel="Save course details" />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={styles.switchTitle}>Keep the original on this device</Text>
              <Text style={styles.muted}>Off by default. Studyling keeps only what you confirm, plus where it came from.</Text>
            </View>
            <Toggle value={keepOriginal} onValueChange={setKeepOriginal} accessibilityLabel="Keep the original on this device" />
          </View>
        </Card>
        <Button label={`Add ${counts.included} item${counts.included === 1 ? '' : 's'} to planner`} onPress={add} disabled={counts.included === 0} sound={null} />
        <Button label="Back to review" variant="ghost" onPress={() => setStage('ready')} />
      </View>
    );
  }

  const course = draft.courses[0];
  const ins = draft.insights;
  const instructors = ins.people.filter((p) => p.role === 'instructor');
  const term = ins.identity.term ? seasonYear(ins.identity.term.season, placementYear(draft.years) ?? ins.identity.term.year) : course?.term;
  const sorted = [...draft.items.filter((i) => i.change !== 'removed')].sort(byDate);
  const removed = draft.items.filter((i) => i.change === 'removed');

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle} accessibilityRole="header">
          Your syllabus is ready!
        </Text>
        <Text style={styles.body}>{attention.some((a) => a.kind !== 'grading') ? 'Here’s what Studyling found. A few things need you before they can go in your planner.' : 'Here’s what Studyling found. Have a look, then add it to your planner.'}</Text>
      </View>

      {draft.courses.map((c) => (
        <Card key={c.index}>
          <Text style={styles.kicker}>{c.existingCourseId ? 'Updating course' : 'Course overview'}</Text>
          <TextInput value={c.name} onChangeText={(name) => store.setDraftCourse(c.index, { name })} style={styles.courseName} accessibilityLabel="Course name" />
          {c.index === 0 && (
            <>
              <Text style={styles.overviewMeta}>{[c.code, ins.identity.credits ? `${ins.identity.credits} credits` : null, term, ins.identity.institution].filter(Boolean).join(' · ')}</Text>
              {instructors.length > 0 && <Overview label={instructors.length > 1 ? 'Instructors' : 'Instructor'} value={instructors.map((p) => p.name).join(', ')} />}
              {ins.meetings.length > 0 && <Overview label="Class" value={meetingsText(ins)} />}
              {ins.grading && <Overview label="Grading" value={`${ins.grading.components.map((g) => `${g.name} ${g.weightPercent}%`).join(' · ')}${ins.grading.addsUp ? '' : ` (adds up to ${ins.grading.totalPercent}%)`}`} />}
            </>
          )}
          {c.index > 0 && <Text style={styles.muted}>{[c.code, c.term].filter(Boolean).join(' · ')}</Text>}
          {c.index === 0 && <Button label={moreDetails ? 'Hide course details' : 'More course details'} variant="ghost" onPress={() => setMoreDetails((v) => !v)} />}
        </Card>
      ))}
      {moreDetails && <CourseInsightsReview draft={draft} />}

      {attention.length > 0 && (
        <View style={styles.attention}>
          <SectionTitle>{`Needs your attention (${attention.filter((a) => a.kind !== 'grading').length})`}</SectionTitle>
          {attention.map((a, i) => (
            <AttentionCard key={`${a.kind}-${'key' in a ? a.key : i}-${i}`} a={a} draft={draft} />
          ))}
        </View>
      )}

      {draft.revisionOfSyllabusId && (counts.changed > 0 || counts.removed > 0) && (
        <InfoNote icon="planner">{`This looks like an updated syllabus: ${counts.changed} changed, ${counts.removed} no longer listed. Your own edits are kept; anything that conflicts is flagged.`}</InfoNote>
      )}

      {draft.detailsDiff.length > 0 && (
        <Card>
          <SectionTitle>Changed in this version</SectionTitle>
          {draft.detailsDiff.map((d, i) => (
            <Text key={i} style={styles.diff}>
              {d.label}: {d.from ?? 'not listed'} → {d.to ?? 'removed'}
            </Text>
          ))}
          <Text style={styles.muted}>{draft.details.save ? 'These replace the saved course details when you add this syllabus.' : 'Turn on “Save course details” to apply these.'}</Text>
        </Card>
      )}
      <SectionTitle>{`Important dates (${sorted.length})`}</SectionTitle>
      <Text style={styles.muted}>Tap any item to see its details or change it.</Text>
      {sorted.map((item) => (
        <ReviewItem key={item.key} item={item} draft={draft} open={open === item.key} onToggle={() => setOpen((o) => (o === item.key ? null : item.key))} />
      ))}
      {removed.length > 0 && <SectionTitle>No longer listed</SectionTitle>}
      {removed.map((item) => (
        <ReviewItem key={item.key} item={item} draft={draft} open={open === item.key} onToggle={() => setOpen((o) => (o === item.key ? null : item.key))} />
      ))}

      {debug && <ImportDiagnostics draft={draft} />}

      <Button label="Review & add to planner" onPress={() => setStage('confirm')} disabled={counts.included === 0} />
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

function byDate(a: DraftItem, b: DraftItem): number {
  const ka = a.dueDayKey ?? (a.recurrence ? '0000' : null);
  const kb = b.dueDayKey ?? (b.recurrence ? '0000' : null);
  if (ka && kb) return ka < kb ? -1 : ka > kb ? 1 : 0;
  if (ka) return -1;
  if (kb) return 1;
  return 0;
}

function Overview({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.overviewRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.overviewLabel}>{label}</Text>
      <Text style={styles.overviewValue}>{value}</Text>
    </View>
  );
}

/** One genuine question for the student, with the answer controls right there. */
function AttentionCard({ a, draft }: { a: AttentionItem; draft: ImportDraft }) {
  const store = usePlannerStore.getState();
  const [why, setWhy] = useState(false);
  if (a.kind === 'year') {
    const season = draft.years.season;
    const heading = a.evidence.find((e) => e.kind === 'heading');
    const others = a.evidence.filter((e) => e.kind !== 'heading');
    return (
      <View style={styles.askCard}>
        <Text style={styles.askTitle}>Which year is this course?</Text>
        <Text style={styles.body}>
          {heading ? `${heading.note}, but some dates only fit ${a.options.filter((y) => y !== draft.years.termYear).join(' or ')}.` : `The syllabus points to ${a.options.join(' and ')}.`} Pick the year you’re taking it, and Studyling will place the dates. Nothing gets a date until you choose.
        </Text>
        {draft.years.suggested != null && <Text style={styles.hint}>{`Most of the dates in the syllabus fit ${season ? seasonYear(season, draft.years.suggested) : draft.years.suggested}.`}</Text>}
        <View style={styles.row}>
          {[...a.options].sort((x, y) => (x === draft.years.suggested ? -1 : y === draft.years.suggested ? 1 : 0)).map((y) => (
            <Button key={y} label={`${season ? seasonYear(season, y) : String(y)}${y === draft.years.suggested ? ' · fits the dates' : ''}`} variant={y === draft.years.suggested ? 'primary' : 'secondary'} onPress={() => store.chooseDraftYear(y)} style={styles.flexBtn} />
          ))}
        </View>
        <Pressable onPress={() => setWhy((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: why }} style={styles.why}>
          <Text style={styles.whyText}>{why ? 'Hide why we’re asking' : 'Why we’re asking'}</Text>
        </Pressable>
        {why && others.slice(0, 6).map((e, i) => <Text key={i} style={styles.muted}>{`• ${e.note} (page ${e.provenance.page ?? 1})`}</Text>)}
      </View>
    );
  }
  if (a.kind === 'conditional') {
    const item = draft.items.find((i) => i.key === a.key);
    if (!item?.conditional) return null;
    return (
      <View style={styles.askCard}>
        <Text style={styles.askTitle}>{a.title}</Text>
        <Text style={styles.body}>{`Due ${conditionalRuleText(item.conditional)}${item.conditional.time ? ` at ${timeLabel(item.conditional.time)}` : ''}. ${a.question}`}</Text>
        {item.conditional.anchorHint && <Text style={styles.hint}>{`Where to look: ${item.conditional.anchorHint}`}</Text>}
        <ConditionalAnswer item={item} draft={draft} />
      </View>
    );
  }
  if (a.kind === 'choose') {
    const item = draft.items.find((i) => i.key === a.key);
    return (
      <View style={styles.askCard}>
        <Text style={styles.askTitle}>{a.title}</Text>
        <Text style={styles.body}>{item?.reasons.includes('yearConflict') ? 'The syllabus gives this date with a different year from the rest. Which one is right?' : 'The syllabus gives more than one date for this. Which one is right?'}</Text>
        <View style={styles.row}>
          {a.options.map((o) => (
            <Button key={o} label={`${formatDayKey(o)}, ${o.slice(0, 4)}`} variant="secondary" onPress={() => store.editDraftItem(a.key, { dueDayKey: o })} style={styles.flexBtn} />
          ))}
        </View>
      </View>
    );
  }
  if (a.kind === 'noDate') {
    return (
      <View style={styles.askCard}>
        <Text style={styles.askTitle}>{a.title}</Text>
        <Text style={styles.body}>The syllabus doesn’t give a date for this. Add one if you know it; otherwise it’s saved without a date and you can add it later.</Text>
        <DateField value={null} onChange={(dueDayKey) => store.editDraftItem(a.key, { dueDayKey })} />
      </View>
    );
  }
  if (a.kind === 'mismatch') {
    return (
      <View style={styles.askCard}>
        <Text style={styles.askTitle}>{a.title}</Text>
        <Text style={styles.body}>{`${a.note} Double-check this one with your instructor or the course page.`}</Text>
        <Button label="Keep this date" variant="secondary" onPress={() => store.confirmDraftItem(a.key)} />
      </View>
    );
  }
  return (
    <InfoNote icon="book">
      {`The grading list adds up to ${a.total}%, not 100%.${a.missing.length ? ` ${a.missing.join(', ')} ${a.missing.length === 1 ? 'has' : 'have'} no weight in the syllabus.` : ''} Studyling won’t guess the missing part.`}
    </InfoNote>
  );
}

/** "Which lecture were you assigned?": pick from the syllabus's lecture list, or give the date. */
function ConditionalAnswer({ item, draft }: { item: DraftItem; draft: ImportDraft }) {
  const store = usePlannerStore.getState();
  const lectures = draft.insights.lectures ?? [];
  const yearKnown = placementYear(draft.years) !== null;
  if (item.conditional?.anchorKind === 'lecture' && lectures.length > 0) {
    if (!yearKnown) return <Text style={styles.muted}>Answer “Which year is this course?” first, so the lecture dates are right.</Text>;
    return (
      <Chips
        label="Your lecture"
        options={lectures.filter((l) => !item.conditional?.fromLecture || l.number >= item.conditional.fromLecture).map((l) => {
          const day = lectureDayKey(draft.years, l);
          return { value: l.number, label: `${l.number}. ${day ? formatDayKey(day) : monthDay(l.month, l.day)}: ${l.topic}` };
        })}
        value={item.conditional.anchorLecture ?? null}
        onChange={(lecture) => store.resolveDraftConditional(item.key, { lecture })}
      />
    );
  }
  return <DateField label={item.conditional?.anchorKind === 'lecture' ? 'Your lecture date' : 'The date it depends on'} value={item.conditional?.anchorDayKey ?? null} onChange={(dayKey) => dayKey && store.resolveDraftConditional(item.key, { dayKey })} />;
}

function ReviewItem({ item, draft, open, onToggle }: { item: DraftItem; draft: ImportDraft; open: boolean; onToggle: () => void }) {
  const store = usePlannerStore.getState();
  const level = worst(item.confidence.title, item.confidence.type, item.confidence.due);
  const due = draftDueText(item, draft);
  const removed = item.change === 'removed';
  const status = trustStatusOf(item);
  const unresolved = !item.dueDayKey && !item.recurrence;
  const quiet = status === 'fromDocument' || status === 'confirmedByYou';

  return (
    <View style={[styles.item, level === 'needsReview' && styles.itemReview, !item.include && styles.itemOff]}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${item.title}, ${TYPE_LABEL[item.type]}, ${due}. ${removed ? 'No longer listed. ' : ''}${removed ? '' : `Status: ${TRUST_STATUS_LABEL[status]}. `}${open ? 'Collapse' : 'Details'}.`} style={styles.itemHead}>
        <View style={styles.dateCol}>
          <Text style={styles.dateMonth}>{item.dueDayKey ? formatDayKey(item.dueDayKey).split(' ')[1] : '—'}</Text>
          <Text style={styles.dateDay}>{item.dueDayKey ? Number(item.dueDayKey.slice(8)) : ''}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.muted}>
            {TYPE_LABEL[item.type]} · {due}
            {item.weightPercent !== null ? ` · ${item.weightPercent}%` : ''}
            {item.estimatedMinutes ? ` · ${formatMinutes(item.estimatedMinutes)}` : ''}
          </Text>
          <View style={styles.badges}>
            {!removed && !quiet && <StatusPill status={status} />}
            {item.change === 'changed' && <Text style={styles.changeTag}>Changed</Text>}
            {item.change === 'new' && draft.revisionOfSyllabusId && <Text style={styles.changeTag}>New</Text>}
            {removed && <Text style={styles.changeTag}>No longer listed</Text>}
            {!item.include && <Text style={styles.changeTag}>Excluded</Text>}
          </View>
          {item.diffs?.map((d) => (
            <Text key={d.field} style={styles.diff}>
              {d.field === 'due' ? 'Date changed' : d.field === 'title' ? `Title was “${d.from}”` : `Type was ${d.from}`}
            </Text>
          ))}
        </View>
        <Text style={styles.chevron}>{open ? '⌃' : '›'}</Text>
      </Pressable>
      {item.possibleMatch && (
        <View style={[styles.matchBox, styles.matchOuter]}>
          <Text style={styles.body}>{`Is this the same as “${item.possibleMatch.title}” from the earlier syllabus?`}</Text>
          <View style={styles.row}>
            <Button label="Same item" variant="secondary" onPress={() => store.linkDraftItem(item.key)} style={styles.flexBtn} />
            <Button label="Different" variant="ghost" onPress={() => store.unlinkDraftItem(item.key)} style={styles.flexBtn} />
          </View>
        </View>
      )}

      {open && !removed && (
        <View style={styles.editor}>
          {item.requirements && item.requirements.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.label}>What to do</Text>
              {item.requirements.map((r) => (
                <Text key={r} style={styles.body}>{`• ${r}`}</Text>
              ))}
            </View>
          )}
          {item.submission && <Detail label="How to submit" value={item.submission} />}
          {item.late && <Detail label="If it’s late" value={item.late} />}
          {item.coverage && <Detail label="Covers" value={`${item.coverage.weeks ? `Weeks ${item.coverage.weeks.from}–${item.coverage.weeks.to}` : item.coverage.chapters}${item.coverage.topics.length ? `: ${item.coverage.topics.slice(0, 4).join('; ')}${item.coverage.topics.length > 4 ? '…' : ''}` : ''}`} />}
          {item.availableDayKey && <Detail label="Released" value={formatDayKey(item.availableDayKey)} />}
          {item.statedZone && <Detail label="Time zone" value={`Given as ${item.statedZone.label}`} />}
          {item.inferences.map((inf) => (
            <Text key={inf.note} style={styles.inference}>
              {inf.note}
            </Text>
          ))}
          {item.reasons.filter((r) => r !== 'conditional' && r !== 'yearConflict').map((r) => (
            <Text key={r} style={styles.reason}>
              {describeReason(r)}
            </Text>
          ))}
          {(item.notes ?? []).map((n) => (
            <Text key={n} style={styles.reason}>
              {n}
            </Text>
          ))}
          {item.conditional && (
            <View style={styles.field}>
              <Text style={styles.label}>{`Due ${conditionalRuleText(item.conditional)}`}</Text>
              <ConditionalAnswer item={item} draft={draft} />
            </View>
          )}
          {item.dueOptions && (
            <View style={styles.options}>
              <Text style={styles.label}>Which date is right?</Text>
              {item.dueOptions.map((o) => (
                <Button key={o} label={`${formatDayKey(o)}, ${o.slice(0, 4)}`} variant={item.dueDayKey === o ? 'primary' : 'secondary'} onPress={() => store.editDraftItem(item.key, { dueDayKey: o })} />
              ))}
            </View>
          )}
          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <TextInput value={item.title} onChangeText={(title) => store.editDraftItem(item.key, { title })} style={styles.input} accessibilityLabel="Title" />
          </View>
          <TypeChips value={item.type} onChange={(type) => store.editDraftItem(item.key, { type })} />
          {!item.recurrence && !item.conditional && <DateField value={item.dueDayKey} onChange={(dueDayKey) => store.editDraftItem(item.key, { dueDayKey })} />}
          <TimeField value={item.dueTime} onChange={(dueTime) => store.editDraftItem(item.key, { dueTime })} />
          <EffortField value={item.estimatedMinutes} onChange={(estimatedMinutes) => store.editDraftItem(item.key, { estimatedMinutes })} />
          {item.provenance[0] ? <Text style={styles.muted}>{`Found on page ${item.provenance[0].page ?? 1} of your syllabus.`}</Text> : null}
          {unresolved && <Text style={styles.muted}>No date yet. It’s saved as a course requirement without a date, and won’t be planned or reminded until it has one.</Text>}
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.body}>{value}</Text>
    </View>
  );
}

/** Developer view only: how the document was read. */
function ImportDiagnostics({ draft }: { draft: ImportDraft }) {
  const counts = draftCounts(draft);
  return (
    <Card>
      <SectionTitle>Import diagnostics (Developer)</SectionTitle>
      <Text style={styles.muted}>{`Parser ${draft.parserVersion} · ${draft.extraction} · ${draft.pageCount} page${draft.pageCount === 1 ? '' : 's'}`}</Text>
      <Text style={styles.muted}>{`Found ${counts.found} · needs review ${counts.needsReview} · likely ${counts.likely} · confirmed ${counts.confirmed}`}</Text>
      <Text style={styles.muted}>{`Ignored ${draft.ignoredHeaderLines} repeated header/footer line${draft.ignoredHeaderLines === 1 ? '' : 's'}`}</Text>
      <Text style={styles.muted}>{`Years: ${draft.years.options.join(', ') || 'none'}${draft.years.conflict ? ` (conflict${draft.years.chosen ? `, chose ${draft.years.chosen}` : ''})` : ''}`}</Text>
      {draft.years.evidence.map((e, i) => (
        <Text key={i} style={styles.muted}>{`  ${e.kind}: ${e.note} (p${e.provenance.page ?? 1}:${e.provenance.line})`}</Text>
      ))}
      {draft.items.map((i) => (
        <Text key={i.key} style={styles.muted}>{`${i.catalogKey ?? i.key}: ${i.reasons.join(',') || 'ok'} · ${i.confidence.title}/${i.confidence.type}/${i.confidence.due} · p${i.provenance.map((p) => `${p.page ?? 1}:${p.line}`).join(',')}`}</Text>
      ))}
    </Card>
  );
}

const amber = '#8A4B00';

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  hero: { gap: spacing.xs, paddingHorizontal: spacing.xs },
  heroTitle: { fontSize: 26, fontWeight: '900', color: colors.text },
  body: { ...typography.body, fontSize: 15, color: colors.textMuted, lineHeight: 21 },
  muted: { ...typography.label, lineHeight: 18 },
  kicker: { ...typography.label, textTransform: 'uppercase', letterSpacing: 0.8 },
  courseName: { ...typography.heading, minHeight: 44, borderBottomWidth: 1, borderColor: colors.border },
  overviewMeta: { fontSize: 14, fontWeight: '700', color: colors.textMuted, lineHeight: 20 },
  overviewRow: { gap: 2 },
  overviewLabel: { ...typography.label },
  overviewValue: { fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 21 },
  attention: { gap: spacing.sm },
  askCard: { gap: spacing.sm, backgroundColor: '#FFF8EC', borderRadius: radius.lg, borderWidth: 1, borderColor: '#F5D7A3', padding: spacing.md },
  askTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  hint: { fontSize: 14, fontWeight: '700', color: colors.primaryDark, lineHeight: 20 },
  why: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  whyText: { fontSize: 14, fontWeight: '800', color: colors.primaryDark },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.border },
  confirmTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  confirmDue: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textAlign: 'right', maxWidth: '45%' },
  item: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  itemReview: { borderColor: '#F5D7A3', borderStyle: 'dashed' },
  itemOff: { opacity: 0.6 },
  itemHead: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, minHeight: 56, alignItems: 'flex-start' },
  dateCol: { width: 44, alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingVertical: 4 },
  dateMonth: { fontSize: 11, fontWeight: '900', color: colors.primaryDark, textTransform: 'uppercase' },
  dateDay: { fontSize: 18, fontWeight: '900', color: colors.text, minHeight: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  changeTag: { fontSize: 12, fontWeight: '800', color: colors.primaryDark, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  itemTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  diff: { fontSize: 13, fontWeight: '700', color: colors.primaryDark, marginTop: 2 },
  reason: { fontSize: 13, color: amber, lineHeight: 18 },
  inference: { fontSize: 13, color: '#4A3F8F', lineHeight: 18 },
  matchBox: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  matchOuter: { marginHorizontal: spacing.md, marginBottom: spacing.md },
  chevron: { fontSize: 22, fontWeight: '900', color: colors.textMuted },
  editor: { gap: spacing.md, padding: spacing.md, paddingTop: 0 },
  options: { gap: spacing.sm },
  field: { gap: 6 },
  label: { ...typography.label, color: colors.text },
  input: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: 15, color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  flexBtn: { flexGrow: 1, flexBasis: 120 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
});
