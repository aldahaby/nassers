import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { RetrievalResult } from '@/core';
import { playSound } from '@/services/audio';
import { useEquipped, usePetView, usePlannerStore } from '@/state';
import { AnimatedPet, Button, Card, colors, radius, spacing, typography } from '@/ui';

type Step = 'offer' | 'dump' | 'check' | 'question' | 'saved';

const RESULTS: readonly { value: RetrievalResult; label: string }[] = [
  { value: 'got', label: 'Got it' },
  { value: 'partly', label: 'Partly' },
  { value: 'missed', label: 'Missed it' },
];

/**
 * A brief chance to retrieve, right after an eligible session. Student-made
 * only (no generated questions). The words stay on this device.
 */
export function RetrievalPrompt({ onDone }: { onDone: () => void }) {
  const planner = usePlannerStore((s) => s.planner);
  const view = usePetView();
  const equipped = useEquipped();
  const [step, setStep] = useState<Step>('offer');
  const [notes, setNotes] = useState('');
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const store = usePlannerStore.getState();
  const pending = planner?.pendingRetrieval;
  const session = pending ? planner?.studySessions[pending.studySessionId] : undefined;
  const assignment = session?.assignmentId ? planner?.assignments[session.assignmentId] : undefined;
  const topic = assignment?.title ?? 'what you just studied';

  const finish = (outcome: Parameters<typeof store.completeRetrieval>[0]) => {
    store.completeRetrieval(outcome);
    if (outcome.kind === 'skip') return onDone();
    playSound('confirm');
    setStep('saved');
  };

  return (
    <View style={styles.wrap}>
      {view && (
        <View style={styles.pet} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <AnimatedPet speciesId={view.pet.speciesId} stage={view.progression.stage} mood="content" equipped={equipped} size={110} calm expression={step === 'saved' ? 'proud' : 'focused'} />
        </View>
      )}

      {step === 'offer' && (
        <Card>
          <Text style={typography.heading} accessibilityRole="header">
            Before you check your notes…
          </Text>
          <Text style={styles.body}>Take a minute to pull back what you remember about {topic}, without looking.</Text>
          <Button label="Brain dump" onPress={() => setStep('dump')} />
          <Button label="Make a recall question" variant="secondary" onPress={() => setStep('question')} />
          <Button label="Not now" variant="ghost" onPress={() => finish({ kind: 'skip' })} />
        </Card>
      )}

      {step === 'dump' && (
        <Card>
          <Text style={typography.heading}>What do you remember?</Text>
          <Text style={styles.body}>Write it down, or just think it through. Notes closed.</Text>
          <TextInput value={notes} onChangeText={setNotes} multiline placeholder="Key ideas, steps, terms…" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="What you remember (optional)" textAlignVertical="top" />
          <Button label="Done remembering" onPress={() => setStep('check')} />
        </Card>
      )}

      {step === 'check' && (
        <Card>
          <Text style={typography.heading}>Check your notes.</Text>
          <Text style={styles.body}>How much did you remember?</Text>
          <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="How much did you remember?">
            {RESULTS.map((r) => (
              <Button key={r.value} label={r.label} variant="secondary" sound={null} onPress={() => finish({ kind: 'brainDump', notes: notes.trim() || undefined, result: r.value })} style={styles.flex} />
            ))}
          </View>
        </Card>
      )}

      {step === 'question' && (
        <Card>
          <Text style={typography.heading}>Make a recall question</Text>
          <Text style={styles.body}>Something you’d want to answer later without looking.</Text>
          <TextInput value={prompt} onChangeText={setPrompt} placeholder="Question" placeholderTextColor={colors.textMuted} style={styles.inputLine} accessibilityLabel="Question" />
          <TextInput value={answer} onChangeText={setAnswer} multiline placeholder="Answer (optional)" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Answer (optional)" textAlignVertical="top" />
          <Button label="Save question" sound={null} onPress={() => finish({ kind: 'question', prompt: prompt.trim(), answer: answer.trim() || undefined })} disabled={!prompt.trim()} />
          <Button label="Back" variant="ghost" onPress={() => setStep('offer')} />
        </Card>
      )}

      {step === 'saved' && (
        <Card>
          <Text style={typography.heading} accessibilityLiveRegion="polite">
            Saved.
          </Text>
          <Text style={styles.body}>It’s in your recall list for {topic}. Studyling will bring it back in a few days.</Text>
          <Button label="Done" onPress={onDone} />
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  pet: { alignSelf: 'center', width: 140, height: 140, borderRadius: radius.lg, backgroundColor: colors.stage, alignItems: 'center', justifyContent: 'center' },
  body: { ...typography.body, fontSize: 15, color: colors.textMuted, lineHeight: 21 },
  input: { minHeight: 140, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: 15, color: colors.text, backgroundColor: colors.background },
  inputLine: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: 15, color: colors.text, backgroundColor: colors.background },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  flex: { flexGrow: 1, flexBasis: 90 },
});
