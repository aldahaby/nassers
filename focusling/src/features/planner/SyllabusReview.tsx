import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Toggle } from './Toggle';
import { conditionalRuleText, describeReason, draftAttention, weekdayOfKey, draftCounts, lectureDayKey, placementYear, trustStatusOf, worst, type AttentionItem, type DraftItem, type ImportDraft } from '@/core';
import { playSound } from '@/services/audio';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { useDebugToolsEnabled, usePlannerStore } from '@/state';
import { Button, Card, Pressable, colors, radius, spacing, typography } from '@/ui';
import { Chips, DateField, EffortField, TimeField, TypeChips } from './AssignmentFields';
import { CourseInsightsReview, meetingsText } from './CourseInsightsReview';
import { InfoNote, SectionTitle, StatusPill } from './PlannerBits';
import { draftDueText, formatDayKey, formatMinutes, monthDay, seasonYear, timeLabel, TRUST_STATUS_LABEL, TYPE_LABEL } from './plannerCopy';

/**
 * Syllabus review in three short stages. Nothing from a syllabus is planned or
 * reminded until the student approves it here.
 *   A. Your course at a glance: what was found, in one card.
 *   B. Just a few things to check: only questions that change a date or the
 *      schedule, each answerable on its own (or skipped: the item stays undated).
 *   C. Ready for your planner: what will be saved, dated vs waiting for a date,
 *      and the exact count, then explicit approval.
 * Page references, evidence and diagnostics stay behind "Source details" or the
 * Developer view.
 */
export function SyllabusReview() {
  const draft = usePlannerStore((s) => s.draft);
  const [stage, setStage] = useState<'glance' | 'check' | 'ready'>('glance');
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [moreDetails, setMoreDetails] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
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
    // Only study blocks for items that already have an estimate; the planner then offers
    // "Plan your first study session" for the rest (the student chooses).
    usePlannerStore.getState().proposePlans(res.assignmentIds.length ? res.assignmentIds : undefined);
    router.dismissTo(`${routes.planner}?imported=${res.assignmentIds.length}` as Href);
  };
  const cancel = () => {
    store.cancelDraft();
    router.back();
  };

  const attentionAll = draftAttention(draft);
  const questions = attentionAll.filter((a) => a.kind !== 'grading' && !('key' in a && skipped.includes(`${a.kind}:${a.key}`)) && !(a.kind === 'year' && skipped.includes('year')));
  const notes = attentionAll.filter((a) => a.kind === 'grading');
  const included = draft.items.filter((i) => i.include && i.change !== 'removed');
  const dated = included.filter((i) => i.dueDayKey || i.recurrence).sort(byDate);
  const undated = included.filter((i) => !i.dueDayKey && !i.recurrence);
  const removed = draft.items.filter((i) => i.change === 'removed');
  const ins = draft.insights;
  const course = draft.courses[0];
  const instructors = ins.people.filter((p) => p.role === 'instructor');
  const year = placementYear(draft.years);
  const term = ins.identity.term ? seasonYear(ins.identity.term.season, year ?? ins.identity.term.year) : course?.term;
  const steps = ['Your course', 'Check', 'Add'] as const;
  const stepIndex = stage === 'glance' ? 0 : stage === 'check' ? 1 : 2;
  const skip = (id: string) => setSkipped((xs) => [...xs, id]);

  return (
    <View style={styles.wrap}>
      <View style={styles.steps} accessibilityRole="progressbar" accessibilityLabel={`Step ${stepIndex + 1} of 3: ${steps[stepIndex]}`}>
        {steps.map((label, i) => (
          <View key={label} style={[styles.step, i <= stepIndex && styles.stepOn]}>
            <Text style={[styles.stepText, i <= stepIndex && styles.stepTextOn]}>{`${i + 1}. ${label}`}</Text>
          </View>
        ))}
      </View>

      {stage === 'glance' && (
        <>
          <Text style={styles.heroTitle} accessibilityRole="header">
            Your course at a glance
          </Text>
          {draft.courses.map((c) => (
            <Card key={c.index}>
              {c.existingCourseId && <Text style={styles.kicker}>Updating a course you already have</Text>}
              <TextInput value={c.name} onChangeText={(name) => store.setDraftCourse(c.index, { name })} style={styles.courseName} accessibilityLabel="Course name (you can edit it)" />
              <Text style={styles.overviewMeta}>{[c.code, c.index === 0 && ins.identity.credits ? `${ins.identity.credits} credits` : null, c.index === 0 ? term : c.term, c.index === 0 ? ins.identity.institution : null].filter(Boolean).join(' · ')}</Text>
              {c.index === 0 && instructors.length > 0 && <Overview label={instructors.length > 1 ? 'Instructors' : 'Instructor'} value={instructors.map((p) => p.name).join(', ')} />}
              {c.index === 0 && ins.meetings.length > 0 && <Overview label="Class" value={meetingsText(ins)} />}
            </Card>
          ))}
          <View style={styles.statsRow} accessible accessibilityLabel={`${included.length} assessments found: ${dated.length} with a date, ${undated.length} waiting for a date.`}>
            <Stat n={included.length} label="assessments" />
            <Stat n={dated.length} label="with a date" />
            <Stat n={undated.length} label="waiting for a date" />
          </View>
          <View style={[styles.statusLine, questions.length ? styles.statusAsk : styles.statusOk]} accessibilityLiveRegion="polite">
            <Text style={styles.statusText}>{questions.length ? `${questions.length} thing${questions.length === 1 ? '' : 's'} to check, so your dates are right.` : 'Everything we found is clear.'}</Text>
          </View>
          {draft.revisionOfSyllabusId && (counts.changed > 0 || counts.removed > 0) && <InfoNote icon="planner">{`This looks like an updated syllabus: ${counts.changed} changed, ${counts.removed} no longer listed. Your own edits are kept.`}</InfoNote>}
          <Button label={questions.length ? `Next: check ${questions.length} thing${questions.length === 1 ? '' : 's'}` : 'Next: preview your planner'} onPress={() => setStage(questions.length ? 'check' : 'ready')} disabled={counts.included === 0} />
          <Disclosure label="More about this course" open={moreDetails} onToggle={() => setMoreDetails((v) => !v)}>
            <CourseInsightsReview draft={draft} />
          </Disclosure>
          <Button label="Cancel import" variant="ghost" onPress={cancel} />
        </>
      )}

      {stage === 'check' && (
        <>
          <Text style={styles.heroTitle} accessibilityRole="header">
            {questions.length ? 'Just a few things to check' : 'All set!'}
          </Text>
          <Text style={styles.body}>{questions.length ? 'Each answer places a date. Not sure? Skip it: the item is saved without a date and you can answer later.' : 'Every question is answered. Next, see what goes into your planner.'}</Text>
          {questions.map((a, i) => (
            <View key={`${a.kind}-${'key' in a ? a.key : i}`} style={styles.question}>
              <AttentionCard a={a} draft={draft} />
              {a.kind !== 'skippedPages' && (
                <Pressable onPress={() => skip(a.kind === 'year' ? 'year' : `${a.kind}:${'key' in a ? a.key : ''}`)} style={styles.skip} accessibilityRole="button" accessibilityLabel={`Skip for now: ${'title' in a ? a.title : 'year'}`}>
                  <Text style={styles.skipText}>Skip for now</Text>
                </Pressable>
              )}
            </View>
          ))}
          {notes.map((a, i) => (
            <AttentionCard key={`note-${i}`} a={a} draft={draft} />
          ))}
          <Button label="Next: preview your planner" onPress={() => setStage('ready')} />
          <Button label="Back" variant="ghost" onPress={() => setStage('glance')} />
        </>
      )}

      {stage === 'ready' && (
        <>
          <Text style={styles.heroTitle} accessibilityRole="header">
            Ready for your planner
          </Text>
          <Text style={styles.body}>Tap an item to see what to do, how to submit, or to change it.</Text>
          <SectionTitle>{`With a date (${dated.length})`}</SectionTitle>
          <Text style={styles.muted}>These can get study blocks and reminders.</Text>
          {dated.map((item) => (
            <ReviewItem key={item.key} item={item} draft={draft} open={open === item.key} onToggle={() => setOpen((o) => (o === item.key ? null : item.key))} />
          ))}
          {dated.length === 0 && <Text style={styles.muted}>None yet.</Text>}
          {undated.length > 0 && (
            <>
              <SectionTitle>{`Waiting for a date (${undated.length})`}</SectionTitle>
              <Text style={styles.muted}>Saved as course requirements. No study blocks or reminders until they have a date.</Text>
              {undated.map((item) => (
                <ReviewItem key={item.key} item={item} draft={draft} open={open === item.key} onToggle={() => setOpen((o) => (o === item.key ? null : item.key))} />
              ))}
            </>
          )}
          {removed.length > 0 && <SectionTitle>No longer in the syllabus</SectionTitle>}
          {removed.map((item) => (
            <ReviewItem key={item.key} item={item} draft={draft} open={open === item.key} onToggle={() => setOpen((o) => (o === item.key ? null : item.key))} />
          ))}
          {draft.detailsDiff.length > 0 && (
            <Card>
              <SectionTitle>Course details changed</SectionTitle>
              {draft.detailsDiff.map((d, i) => (
                <Text key={i} style={styles.diff}>
                  {d.label}: {d.from ?? 'not listed'} → {d.to ?? 'removed'}
                </Text>
              ))}
            </Card>
          )}
          <Card>
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={styles.switchTitle}>Save course details</Text>
                <Text style={styles.muted}>Instructors, class times, grading and policies, on this device.</Text>
              </View>
              <Toggle value={draft.details.save} onValueChange={(save) => store.setDraftDetails({ save })} accessibilityLabel="Save course details" />
            </View>
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={styles.switchTitle}>Keep the original file text</Text>
                <Text style={styles.muted}>Off by default. Studyling keeps only what you approve.</Text>
              </View>
              <Toggle value={keepOriginal} onValueChange={setKeepOriginal} accessibilityLabel="Keep the original on this device" />
            </View>
          </Card>
          {debug && <ImportDiagnostics draft={draft} />}
          <View style={styles.sticky}>
            <Button label={`Add ${counts.included} item${counts.included === 1 ? '' : 's'} to planner`} onPress={add} disabled={counts.included === 0} sound={null} />
            <Text style={styles.stickyNote}>{`${dated.length} with a date · ${undated.length} waiting for a date`}</Text>
          </View>
          <Button label="Back" variant="ghost" onPress={() => setStage(questions.length ? 'check' : 'glance')} />
        </>
      )}
    </View>
  );
}

/** Where a conflicting option comes from ("the year written next to this date"); null when it's simply stated. */
function dueOptionNote(item: DraftItem | undefined, dayKey: string, draft: ImportDraft): string | null {
  if (!item?.reasons.includes('yearConflict')) return item?.reasons.includes('conflictingDates') ? 'One of the dates the syllabus gives' : null;
  const y = Number(dayKey.slice(0, 4));
  if (item.writtenDate?.explicitYear === y) return 'The year written next to this date';
  return placementYear(draft.years) !== null ? 'Fits the course year you chose' : 'Fits the year in the syllabus heading';
}

/** A date choice: the date on one line, where it comes from below. */
function OptionButton({ item, dayKey, draft, selected, onPress }: { item: DraftItem | undefined; dayKey: string; draft: ImportDraft; selected: boolean; onPress: () => void }) {
  const note = dueOptionNote(item, dayKey, draft);
  const date = `${formatDayKey(dayKey)}, ${dayKey.slice(0, 4)}`;
  return (
    <Pressable onPress={onPress} style={[styles.option, selected && styles.optionOn]} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={`${date}${note ? `. ${note}` : ''}`}>
      <Text style={styles.optionDate}>{date}</Text>
      {note && <Text style={styles.optionNote}>{note}</Text>}
    </Pressable>
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

/** Secondary content, collapsed by default. */
function Disclosure({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.disclosure}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.disclosureHead}>
        <Text style={styles.disclosureText}>{label}</Text>
        <Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open && <View style={styles.disclosureBody}>{children}</View>}
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
        {a.options.map((o) => (
          <OptionButton key={o} item={item} dayKey={o} draft={draft} selected={false} onPress={() => store.editDraftItem(a.key, { dueDayKey: o })} />
        ))}
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
  if (a.kind === 'skippedPages') {
    return (
      <View style={styles.askCard}>
        <Text style={styles.askTitle}>{`Page${a.pages.length === 1 ? '' : 's'} ${a.pages.join(', ')} couldn’t be read`}</Text>
        <Text style={styles.body}>{`${a.pages.length === 1 ? 'That page is' : 'Those pages are'} a scanned picture with no text, so nothing on ${a.pages.length === 1 ? 'it' : 'them'} was imported. Check ${a.pages.length === 1 ? 'it' : 'them'} in the PDF and add anything missing yourself.`}</Text>
      </View>
    );
  }
  if (a.kind === 'unknownDate') {
    return (
      <View style={styles.askCard}>
        <Text style={styles.askTitle}>{a.title}</Text>
        <Text style={styles.body}>{a.reason === 'examPeriod' ? 'The syllabus only says it’s in the exam period. Know the date already? Add it. Otherwise it waits without a date (no reminders) until you add it.' : 'The date hasn’t been announced. Add it if you know it; otherwise it waits without a date.'}</Text>
        <DateField label="Date, if you know it" value={null} onChange={(dueDayKey) => store.editDraftItem(a.key, { dueDayKey })} />
      </View>
    );
  }
  if (a.kind === 'lectureWeekdays') {
    return (
      <InfoNote icon="book">{`${a.count} lecture date${a.count === 1 ? '' : 's'} in the schedule ${a.count === 1 ? 'doesn’t' : 'don’t'} match ${a.count === 1 ? 'its' : 'their'} weekday in ${a.year} (e.g. ${a.example}). If that year is wrong, change your answer to “Which year is this course?”.`}</InfoNote>
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
          // The schedule's own weekday disagreeing with the date in this year is shown, not hidden.
          const listed = l.weekday !== null && day && weekdayOfKey(day) !== l.weekday ? ` (listed as ${WEEKDAY_SHORT[l.weekday]})` : '';
          return { value: l.number, label: `${l.number}. ${day ? formatDayKey(day) : monthDay(l.month, l.day)}${listed}: ${l.topic}` };
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
  const [editing, setEditing] = useState(false);
  const [source, setSource] = useState(false);
  const level = worst(item.confidence.title, item.confidence.type, item.confidence.due);
  // The date badge already shows month and day; the line keeps the weekday and time.
  const dueFull = draftDueText(item, draft);
  const due = item.dueDayKey ? dueFull.replace(/^(\w{3}) \w{3} \d{1,2}/, '$1') : dueFull;
  const removed = item.change === 'removed';
  const status = trustStatusOf(item);
  const unresolved = !item.dueDayKey && !item.recurrence;
  const quiet = status === 'fromDocument' || status === 'confirmedByYou';

  return (
    <View style={[styles.item, level === 'needsReview' && styles.itemReview, !item.include && styles.itemOff]}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${item.title}, ${TYPE_LABEL[item.type]}, ${dueFull}. ${removed ? 'No longer listed. ' : ''}${removed ? '' : `Status: ${TRUST_STATUS_LABEL[status]}. `}${open ? 'Collapse' : 'Details'}.`} style={styles.itemHead}>
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
                <OptionButton key={o} item={item} dayKey={o} draft={draft} selected={item.dueDayKey === o} onPress={() => store.editDraftItem(item.key, { dueDayKey: o })} />
              ))}
            </View>
          )}
          <EffortField value={item.estimatedMinutes} onChange={(estimatedMinutes) => store.editDraftItem(item.key, { estimatedMinutes })} />
          <Disclosure label="Change title, type or date" open={editing} onToggle={() => setEditing((v) => !v)}>
            <View style={styles.field}>
              <Text style={styles.label}>Title</Text>
              <TextInput value={item.title} onChangeText={(title) => store.editDraftItem(item.key, { title })} style={styles.input} accessibilityLabel="Title" />
            </View>
            <TypeChips value={item.type} onChange={(type) => store.editDraftItem(item.key, { type })} />
            {!item.recurrence && !item.conditional && <DateField value={item.dueDayKey} onChange={(dueDayKey) => store.editDraftItem(item.key, { dueDayKey })} />}
            <TimeField value={item.dueTime} onChange={(dueTime) => store.editDraftItem(item.key, { dueTime })} />
          </Disclosure>
          <Disclosure label="Source details" open={source} onToggle={() => setSource((v) => !v)}>
            {item.provenance[0] ? <Text style={styles.muted}>{`Found on page ${item.provenance[0].page ?? 1} of your syllabus${item.provenance.length > 1 ? ` (and ${item.provenance.length - 1} more place${item.provenance.length > 2 ? 's' : ''})` : ''}.`}</Text> : null}
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
            <Text style={styles.muted}>{`Status: ${TRUST_STATUS_LABEL[status]}`}</Text>
          </Disclosure>
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
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', gap: 6 },
  option: { minHeight: 52, borderRadius: radius.md, borderWidth: 2, borderColor: colors.primarySoft, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionDate: { fontSize: 16, fontWeight: '900', color: colors.primaryDark },
  optionNote: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  step: { flex: 1, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, paddingVertical: 6, alignItems: 'center' },
  stepOn: { backgroundColor: colors.primarySoft },
  stepText: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  stepTextOn: { color: colors.primaryDark },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: 6, alignItems: 'center' },
  statN: { fontSize: 22, fontWeight: '900', color: colors.text },
  statLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textAlign: 'center' },
  statusLine: { borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  statusAsk: { backgroundColor: '#FFF4E0' },
  statusOk: { backgroundColor: colors.successSoft },
  statusText: { fontSize: 15, fontWeight: '800', color: colors.text },
  question: { gap: 2 },
  skip: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  skipText: { fontSize: 14, fontWeight: '800', color: colors.textMuted, textDecorationLine: 'underline' },
  sticky: { gap: 4 },
  stickyNote: { ...typography.label, textAlign: 'center' },
  disclosure: { backgroundColor: colors.surface, borderRadius: radius.lg },
  disclosureHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: spacing.md },
  disclosureText: { fontSize: 15, fontWeight: '800', color: colors.primaryDark },
  disclosureBody: { gap: spacing.md, padding: spacing.md, paddingTop: 0 },
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
