import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { services } from '@/services';
import { useDebugToolsEnabled, usePlannerStore } from '@/state';
import { Button, Card, Pressable, TabIcon, colors, radius, spacing, typography, type TabIconName } from '@/ui';
import { InfoNote, SectionTitle } from './PlannerBits';

/**
 * ADD A COURSE → Import syllabus (PDF/file, paste from email) or Enter
 * manually. Google Classroom and Canvas are "Coming later" and not tappable:
 * only adapter interfaces exist, and nothing claims a connection.
 */
export function ImportSourceSheet() {
  const status = usePlannerStore((s) => s.importStatus);
  const progress = usePlannerStore((s) => s.importProgress);
  const error = usePlannerStore((s) => s.importError);
  const draft = usePlannerStore((s) => s.draft);
  const debug = useDebugToolsEnabled();
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');
  const store = usePlannerStore.getState();
  const busy = status === 'picking' || status === 'extracting' || status === 'parsing';

  const toReview = () => router.push('/planner/review' as Href);

  const pickFile = async () => {
    await store.pickAndExtract();
    const s = usePlannerStore.getState();
    if (s.draft && s.importStatus === 'idle') toReview();
  };

  const parsePasted = () => {
    const d = store.importText(text, 'emailText');
    if (d && (d.items.length || d.duplicateOfSyllabusId)) {
      setText('');
      setPasting(false);
      toReview();
    }
  };

  return (
    <View style={styles.wrap}>
      <SectionTitle>Import syllabus</SectionTitle>
      <SourceOption icon="book" title="PDF or file" body={services.documents.canReadPdf ? 'Read on this device. Scanned pages use on-device text recognition.' : 'Text files work here. PDF reading runs in the iPhone app; you can paste the text instead.'} onPress={() => void pickFile()} disabled={busy} />
      <SourceOption icon="bell" title="Paste from email" body="Copy the syllabus or schedule from an email and paste it here. No mailbox access." onPress={() => setPasting((v) => !v)} disabled={busy} />

      {busy && (
        <Card>
          <View style={styles.progressRow} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.body}>
              {status === 'picking' ? 'Choose a file…' : status === 'extracting' ? (progress ? `Reading page ${progress.done} of ${progress.total} on this device…` : 'Reading on this device…') : 'Finding dates and assignments…'}
            </Text>
          </View>
        </Card>
      )}

      {error && (
        <InfoNote icon="book">
          {error === 'unsupported'
            ? 'This device can’t read PDFs in the preview. Paste the syllabus text instead, or import it on your iPhone.'
            : error === 'empty'
              ? 'No text was found. If it’s a photo of a page, try a clearer scan, or paste the text.'
              : error === 'noItems'
                ? 'No dates or assignments were found. You can add them yourself in a minute.'
                : 'That file couldn’t be read. Try another file or paste the text.'}
        </InfoNote>
      )}

      {pasting && (
        <Card>
          <Text style={styles.label}>
            Syllabus or schedule text
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder="Paste here…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            accessibilityLabel="Syllabus text"
            textAlignVertical="top"
          />
          <Text style={styles.muted}>Studyling reads it on this device. The pasted text is discarded after you review it, unless you choose to keep the original.</Text>
          <Button label="Find assignments" onPress={parsePasted} disabled={!text.trim()} />
        </Card>
      )}

      {draft && !busy && !pasting && (
        <Button label="Continue reviewing" variant="secondary" onPress={toReview} />
      )}

      <SourceOption icon="planner" title="Google Classroom" body="Coming later" disabled comingLater />
      <SourceOption icon="planner" title="Canvas" body="Coming later" disabled comingLater />

      <SectionTitle>Or</SectionTitle>
      <SourceOption icon="plus" title="Enter manually" body="Add a course and a few deadlines yourself. Always works, no syllabus needed." onPress={() => router.push('/planner/manual' as Href)} />

      {debug && (
        <Button label="🛠 Syllabus Lab (fixtures)" variant="ghost" onPress={() => router.push('/dev/syllabus-lab' as Href)} />
      )}
    </View>
  );
}

function SourceOption({ icon, title, body, onPress, disabled, comingLater }: { icon: TabIconName; title: string; body: string; onPress?: () => void; disabled?: boolean; comingLater?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.option, comingLater && styles.optionLater]}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      accessibilityLabel={`${title}. ${body}`}
    >
      <View style={styles.optionIcon}>
        <TabIcon name={icon} color={comingLater ? colors.textMuted : colors.primaryDark} size={22} />
      </View>
      <View style={styles.optionText}>
        <Text style={[styles.optionTitle, comingLater && { color: colors.textMuted }]}>{title}</Text>
        <Text style={styles.muted}>{body}</Text>
      </View>
      {!comingLater && <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, minHeight: 64 },
  optionLater: { backgroundColor: colors.surfaceMuted },
  optionIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  muted: { ...typography.label, lineHeight: 18 },
  body: { ...typography.body, fontSize: 15, flex: 1 },
  chevron: { fontSize: 22, fontWeight: '900', color: colors.textMuted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { ...typography.label, color: colors.text },
  input: { minHeight: 160, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: 15, color: colors.text, backgroundColor: colors.background },
});
