import { StyleSheet, Text, View } from 'react-native';
import { Toggle } from './Toggle';
import { REMINDER_FADING_POLICY, SESSION_LENGTH_CHOICES, SUPPORT_LEVEL_COPY } from '@/config/planner';
import { effectiveSupport, type AvailabilityWindow, type ReminderPreference, type SupportLevel } from '@/core';
import { services } from '@/services';
import { usePlannerStore } from '@/state';
import { Button, Card, Pressable, colors, radius, spacing, typography } from '@/ui';
import { Chips } from './AssignmentFields';
import { InfoNote, SectionTitle } from './PlannerBits';
import { minuteLabel, weekdayLong } from './plannerCopy';

const PREFS: readonly { value: ReminderPreference; title: string; body: string }[] = [
  { value: 'always', title: 'Always remind me', body: 'A cue for every planned block, plus a short plan on busy days.' },
  { value: 'adaptive', title: 'Let Studyling adapt', body: 'Fewer reminders as you start more blocks on your own. More help is always one tap away.' },
  { value: 'minimal', title: 'Keep reminders minimal', body: 'Just a cue when a block is ready. No daily plan.' },
];

const LEVELS: readonly SupportLevel[] = ['standard', 'light', 'ambient'];
const DAYS = [1, 2, 3, 4, 5, 6, 0];

export function ReminderSettings({ section }: { section?: string }) {
  const planner = usePlannerStore((s) => s.planner);
  if (!planner) return null;
  const store = usePlannerStore.getState();
  const prefs = planner.preferences;
  const level = effectiveSupport(planner.progress, prefs.reminderPreference);
  const denied = prefs.notificationPermission === 'denied';

  const windowFor = (weekday: number) => prefs.availability.find((w) => w.weekday === weekday);
  const setWindow = (weekday: number, w: AvailabilityWindow | null) =>
    store.updatePreferences({ availability: [...prefs.availability.filter((x) => x.weekday !== weekday), ...(w ? [w] : [])].sort((a, b) => a.weekday - b.weekday) });

  return (
    <View style={styles.wrap}>
      {section !== 'availability' && (
        <>
          <SectionTitle>Reminders</SectionTitle>
          <Card>
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={styles.title}>Planner reminders</Text>
                <Text style={styles.muted}>Studyling can remind you when a study block you planned is ready.</Text>
              </View>
              <Toggle
                value={prefs.remindersEnabled}
                onValueChange={(on) => (on ? void store.enableReminders() : store.disableReminders())}
                disabled={denied}
                accessibilityLabel="Planner reminders"
              />
            </View>
            {denied && (
              <>
                <InfoNote icon="bell">Notifications are off for Studyling in your device settings. Your planner works the same without them; you can change this any time.</InfoNote>
                <Button label="Open device settings" variant="ghost" onPress={() => void services.notifications.openSettings()} />
              </>
            )}
            <Text style={styles.muted}>Reminder sounds follow your phone’s notification settings, separate from Studyling’s Sound Effects. Nothing is sent during a study session or quiet hours.</Text>
          </Card>

          <SectionTitle>Reminder support</SectionTitle>
          <Card>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {PREFS.map((p) => {
                const selected = prefs.reminderPreference === p.value;
                return (
                  <Pressable key={p.value} onPress={() => store.setReminderPreference(p.value)} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={`${p.title}. ${p.body}`} style={[styles.option, selected && styles.optionOn]}>
                    <View style={[styles.radio, selected && styles.radioOn]} />
                    <View style={styles.flex}>
                      <Text style={styles.title}>{p.title}</Text>
                      <Text style={styles.muted}>{p.body}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.levelBox} accessible accessibilityLabel={`Current support: ${SUPPORT_LEVEL_COPY[level].title}. ${SUPPORT_LEVEL_COPY[level].body}`}>
              <Text style={styles.kicker}>Right now</Text>
              <Text style={styles.title}>{SUPPORT_LEVEL_COPY[level].title}</Text>
              <Text style={styles.muted}>{SUPPORT_LEVEL_COPY[level].body}</Text>
              {prefs.reminderPreference === 'adaptive' && <Text style={styles.why}>{planner.progress.supportReason}</Text>}
            </View>
            {LEVELS.map((l) => (
              <View key={l} style={styles.levelRow}>
                <Text style={[styles.levelName, l === level && styles.levelNameOn]}>
                  {l === level ? '● ' : '○ '}
                  {SUPPORT_LEVEL_COPY[l].title}
                </Text>
                <Text style={styles.muted}>{SUPPORT_LEVEL_COPY[l].body}</Text>
              </View>
            ))}
            <Text style={styles.footnote}>
              Adapting is an experiment ({REMINDER_FADING_POLICY.version}): after you start 3 of 4 planned blocks on time, 2 of them before any reminder, Studyling tries Light; after another 4 like that, Ambient. If plans start slipping it asks before adding reminders back.
            </Text>
          </Card>

          <SectionTitle>Quiet hours</SectionTitle>
          <Card>
            <MinuteStepper label="From" value={prefs.quietHours.startMinute} onChange={(m) => store.updatePreferences({ quietHours: { ...prefs.quietHours, startMinute: m } })} />
            <MinuteStepper label="Until" value={prefs.quietHours.endMinute} onChange={(m) => store.updatePreferences({ quietHours: { ...prefs.quietHours, endMinute: m } })} />
          </Card>

          <SectionTitle>Lock Screen</SectionTitle>
          <Card>
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={styles.title}>Show study details on Lock Screen</Text>
                <Text style={styles.muted}>{prefs.lockScreenDetail === 'detailed' ? 'Shown as: “CHEM 101 · Problem Set 4”' : 'Shown as: “Study session · 45 min”'}</Text>
              </View>
              <Toggle value={prefs.lockScreenDetail === 'detailed'} onValueChange={(on) => store.updatePreferences({ lockScreenDetail: on ? 'detailed' : 'private' })} accessibilityLabel="Show study details on Lock Screen" />
            </View>
            <Text style={styles.muted}>Applies to reminders, the widget and the Live Activity.</Text>
          </Card>
        </>
      )}

      <SectionTitle>Study time</SectionTitle>
      <Card>
        <Text style={styles.muted}>Studyling plans blocks only inside these windows. It doesn’t read your calendar.</Text>
        {DAYS.map((d) => {
          const w = windowFor(d);
          return (
            <View key={d} style={styles.dayRow}>
              <View style={styles.switchRow}>
                <Text style={[styles.title, styles.flex]}>{weekdayLong(d)}</Text>
                <Toggle value={Boolean(w)} onValueChange={(on) => setWindow(d, on ? { weekday: d, startMinute: 18 * 60, endMinute: 21 * 60 } : null)} accessibilityLabel={`Study on ${weekdayLong(d)}`} />
              </View>
              {w && (
                <View style={styles.inline}>
                  <MinuteStepper label="From" value={w.startMinute} onChange={(m) => setWindow(d, { ...w, startMinute: Math.min(m, w.endMinute - 30) })} />
                  <MinuteStepper label="To" value={w.endMinute} onChange={(m) => setWindow(d, { ...w, endMinute: Math.max(m, w.startMinute + 30) })} />
                </View>
              )}
            </View>
          );
        })}
        <Chips label="Preferred block length" options={SESSION_LENGTH_CHOICES.map((m) => ({ value: m, label: `${m} min` }))} value={prefs.preferredSessionMinutes} onChange={(m) => store.updatePreferences({ preferredSessionMinutes: m })} />
        <Text style={styles.muted}>Time zone: {prefs.timezone.replace(/_/g, ' ')}</Text>
      </Card>
    </View>
  );
}

function MinuteStepper({ label, value, onChange }: { label: string; value: number; onChange: (m: number) => void }) {
  const step = (d: number) => onChange((value + d + 24 * 60) % (24 * 60));
  return (
    <View style={styles.stepper} accessible accessibilityRole="adjustable" accessibilityLabel={`${label} ${minuteLabel(value)}`} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 30 : -30)}>
      <Text style={styles.stepLabel}>{label}</Text>
      <Pressable onPress={() => step(-30)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`${label}: 30 minutes earlier`}>
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{minuteLabel(value)}</Text>
      <Pressable onPress={() => step(30)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`${label}: 30 minutes later`}>
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  muted: { ...typography.label, lineHeight: 18 },
  kicker: { ...typography.label, textTransform: 'uppercase', letterSpacing: 0.8 },
  why: { fontSize: 14, color: colors.text, lineHeight: 20 },
  options: { gap: spacing.sm },
  option: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, minHeight: 56 },
  optionOn: { backgroundColor: colors.primarySoft },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.textMuted },
  radioOn: { borderColor: colors.primaryDark, borderWidth: 6 },
  levelBox: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 2 },
  levelRow: { gap: 1 },
  levelName: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
  levelNameOn: { color: colors.primaryDark },
  footnote: { ...typography.label, fontWeight: '600', lineHeight: 18 },
  dayRow: { gap: 6, borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.sm },
  inline: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepLabel: { ...typography.label, width: 40 },
  stepBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 20, fontWeight: '900', color: colors.primaryDark },
  stepValue: { minWidth: 76, textAlign: 'center', fontSize: 15, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
});
