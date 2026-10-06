import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PARSER_VERSIONS, type ParserVersion } from '@/config/planner';
import { commitImport, createImportDraft, createPlannerState, describeReason, draftCounts, parseSyllabus, type SyllabusSourceType } from '@/core';
import { compareWithGolden, GOLDEN_FIXTURES, REVISED, CLEAN_TEXT, type SyllabusFixture } from '@/core/planner/fixtures/syllabi';
import { Chips } from '@/features/planner/AssignmentFields';
import { SectionTitle, TrustBadge } from '@/features/planner/PlannerBits';
import { PlannerScreen } from '@/features/planner/PlannerScreen';
import { appClock } from '@/services';
import { useDebugToolsEnabled, usePlannerStore } from '@/state';
import { Button, Card, colors, radius, spacing, typography } from '@/ui';

const ZONES = ['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'];
const SOURCES: readonly SyllabusSourceType[] = ['pdf', 'emailText', 'manual'];

/** Simulations applied to the text before parsing (all local, nothing logged). */
const damage = (t: string) => t.replace(/\bOct\b/g, '0ct').replace(/(\b(?:Sep|Oct|Nov|Dec)[a-z]*\.? )1(\d)/g, '$1l$2').replace(/(\d)0\b/g, '$1O');
const stripYears = (t: string) => t.replace(/\b(Fall|Spring|Summer|Winter|Autumn)\s+\d{4}/gi, '$1').replace(/,?\s+20\d\d\b/g, '');
const ambiguous = (t: string) => t.replace(/\bdue (?=(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b)/, 'due week of ');

/**
 * Developer Syllabus Lab: run the on-device parser over synthetic fixtures or
 * pasted text, compare with golden output, and rehearse revised/duplicate
 * imports in an isolated scratch planner. Developer tools only.
 */
export default function SyllabusLab() {
  const debug = useDebugToolsEnabled();
  const [fixture, setFixture] = useState<SyllabusFixture>(CLEAN_TEXT);
  const [text, setText] = useState(CLEAN_TEXT.text);
  const [source, setSource] = useState<SyllabusSourceType>('pdf');
  const [zone, setZone] = useState(CLEAN_TEXT.timezone);
  const [version, setVersion] = useState<ParserVersion>(PARSER_VERSIONS[0]);
  const [sim, setSim] = useState<string | null>(null);

  const result = useMemo(() => parseSyllabus({ text, timezone: zone, referenceAt: fixture.referenceAt, parserVersion: version }), [text, zone, version, fixture]);
  const golden = text === fixture.text && version === PARSER_VERSIONS[0] ? compareWithGolden(fixture.id, result.candidates) : null;

  if (!debug) {
    return (
      <PlannerScreen title="Syllabus Lab">
        <Card>
          <Text style={styles.body}>Turn on Developer tools in Settings to use the Syllabus Lab.</Text>
        </Card>
      </PlannerScreen>
    );
  }

  const load = (f: SyllabusFixture) => {
    setFixture(f);
    setText(f.text);
    setZone(f.timezone);
    setSim(null);
  };

  const simulateRevision = () => {
    const ids = labIds();
    const s0 = createPlannerState(appClock.now(), zone);
    const first = commitImport(s0, createImportDraft(s0, { text: CLEAN_TEXT.text, sourceType: source, timezone: zone, now: CLEAN_TEXT.referenceAt }), { now: CLEAN_TEXT.referenceAt, ids, keepOriginal: false });
    const revised = createImportDraft(first.state, { text: REVISED.text, sourceType: source, timezone: zone, now: REVISED.referenceAt });
    const c = draftCounts(revised);
    setSim(`Revised import vs. clean import: ${c.changed} changed, ${c.removed} no longer listed, ${revised.items.filter((i) => i.change === 'new').length} new, ${revised.items.filter((i) => i.change === 'unchanged').length} unchanged. Revision of syllabus: ${revised.revisionOfSyllabusId ? 'yes' : 'no'}.`);
  };

  const simulateDuplicate = () => {
    const ids = labIds();
    const s0 = createPlannerState(appClock.now(), zone);
    const first = commitImport(s0, createImportDraft(s0, { text, sourceType: source, timezone: zone, now: fixture.referenceAt }), { now: fixture.referenceAt, ids, keepOriginal: false });
    const again = createImportDraft(first.state, { text, sourceType: source, timezone: zone, now: fixture.referenceAt + 1000 });
    const res = commitImport(first.state, again, { now: fixture.referenceAt + 1000, ids, keepOriginal: false });
    setSim(`Duplicate import: detected ${again.duplicateOfSyllabusId ? 'yes' : 'no'}; assignments before ${Object.keys(first.state.assignments).length}, after ${Object.keys(res.state.assignments).length}.`);
  };

  return (
    <PlannerScreen title="Syllabus Lab" subtitle="Developer · synthetic fixtures · on-device parser">
      <Card>
        <Chips label="Fixture" options={GOLDEN_FIXTURES.map((f) => ({ value: f.id, label: f.id }))} value={fixture.id} onChange={(id) => load(GOLDEN_FIXTURES.find((f) => f.id === id)!)} />
        <Text style={styles.muted}>{fixture.label} · covers: {fixture.covers.join(', ')}</Text>
        <TextInput value={text} onChangeText={setText} multiline style={styles.input} accessibilityLabel="Syllabus text" textAlignVertical="top" />
        <Chips label="Source type" options={SOURCES.map((s) => ({ value: s, label: s }))} value={source} onChange={setSource} />
        <Chips label="Time zone" options={ZONES.map((z) => ({ value: z, label: z.split('/')[1]!.replace('_', ' ') }))} value={zone} onChange={setZone} />
        <Chips label="Parser version" options={PARSER_VERSIONS.map((v) => ({ value: v, label: v }))} value={version} onChange={setVersion} />
        <View style={styles.row}>
          <Button label="OCR damage" variant="secondary" onPress={() => setText(damage(text))} style={styles.flex} />
          <Button label="Missing year" variant="secondary" onPress={() => setText(stripYears(text))} style={styles.flex} />
          <Button label="Ambiguous date" variant="secondary" onPress={() => setText(ambiguous(text))} style={styles.flex} />
          <Button label="Revised syllabus" variant="secondary" onPress={simulateRevision} style={styles.flex} />
          <Button label="Duplicate import" variant="secondary" onPress={simulateDuplicate} style={styles.flex} />
          <Button label="Reset text" variant="ghost" onPress={() => load(fixture)} style={styles.flex} />
        </View>
        {sim && <Text style={styles.sim}>{sim}</Text>}
      </Card>

      <SectionTitle>Result</SectionTitle>
      <Card>
        <Text style={styles.mono}>parser {result.parserVersion}</Text>
        <Text style={styles.mono} selectable>
          hash {result.contentHash.slice(0, 16)}…
        </Text>
        <Text style={styles.mono}>
          {result.pageCount} page(s) · {result.lineCount} lines · year from {result.yearAnchor}
          {result.dateRange ? ` · ${result.dateRange.first} → ${result.dateRange.last}` : ''}
        </Text>
        {result.courses.map((c, i) => (
          <Text key={i} style={styles.course}>
            Course {i + 1}: {c.code ?? '—'} · {c.name ?? '(no name)'} · {c.term ?? 'no term'}
          </Text>
        ))}
        {golden && (
          <View style={[styles.golden, golden.length ? styles.goldenBad : styles.goldenOk]} accessible accessibilityLabel={golden.length ? `Differs from golden output: ${golden.join('. ')}` : 'Matches golden output'}>
            <Text style={styles.goldenText}>{golden.length ? `✗ ${golden.length} difference(s) from golden` : '✓ Matches golden output'}</Text>
            {golden.map((d) => (
              <Text key={d} style={styles.muted}>
                {d}
              </Text>
            ))}
          </View>
        )}
      </Card>
      {result.candidates.map((c) => (
        <Card key={c.key}>
          <View style={styles.rowBetween}>
            <TrustBadge level={c.overall} />
            <Text style={styles.mono}>
              {c.provenance.map((p) => `p${p.page}:L${p.line}${p.section ? ` (${p.section})` : ''}`).join(', ')}
            </Text>
          </View>
          <Text style={styles.title}>{c.title}</Text>
          <Text style={styles.mono}>
            {c.type} ({c.typeConfidence}) · {c.dueDayKey ?? 'no date'} {c.dueTime ?? ''} ({c.dateConfidence}){c.dueOptions ? ` · options ${c.dueOptions.join(' / ')}` : ''}
            {c.recurrence ? ` · weekly on day ${c.recurrence.weekday}` : ''}
          </Text>
          {c.reasons.map((r) => (
            <Text key={r} style={styles.reason}>
              {r}: {describeReason(r)}
            </Text>
          ))}
        </Card>
      ))}
      <Button
        label="Review this in the real importer"
        onPress={() => {
          usePlannerStore.getState().importText(text, source, { parserVersion: version, filename: `${fixture.id}.txt` });
          router.push('/planner/review' as Href);
        }}
      />
    </PlannerScreen>
  );
}

function labIds() {
  let n = 0;
  return (p: string) => `lab_${p}_${++n}`;
}

const styles = StyleSheet.create({
  body: { ...typography.body },
  muted: { ...typography.label, lineHeight: 18 },
  input: { minHeight: 180, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: 13, color: colors.text, fontFamily: 'monospace' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  flex: { flexGrow: 1, flexBasis: 140 },
  sim: { fontSize: 14, color: colors.primaryDark, fontWeight: '700' },
  mono: { fontSize: 12, fontFamily: 'monospace', color: colors.textMuted },
  course: { fontSize: 14, fontWeight: '800', color: colors.text },
  golden: { borderRadius: radius.md, padding: spacing.sm, gap: 2 },
  goldenOk: { backgroundColor: colors.successSoft },
  goldenBad: { backgroundColor: '#FFF4E0' },
  goldenText: { fontSize: 14, fontWeight: '900', color: colors.text },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  reason: { fontSize: 12, color: '#8A4B00' },
});
