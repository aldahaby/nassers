import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  AVAILABLE_MISSION_TYPES,
  MISSION_LIMITS,
  MISSION_REWARD_LEVELS,
  MISSION_TYPE_LABELS,
} from '@/config/missions';
import type { MissionDraft, MissionError, MissionRecurrence, MissionRewardLevel, MissionType } from '@/core';
import { Button, Card, colors, radius, spacing, typography } from '@/ui';
import { formatMinuteOfDay } from '@/utils/format';
import { DAY_LETTERS, DAY_NAMES, describeGoal } from './missionCopy';

type EditableType = 'focusMinutes' | 'sessionCount' | 'scheduledFocus';

const ERROR_COPY: Record<MissionError, string> = {
  'title-required': 'Give the mission a name.',
  'unavailable-type': "That mission type isn't available yet.",
  'invalid-target': 'Choose a goal within the allowed range.',
  'invalid-window': 'The time window must be at least as long as the session.',
  'no-days': 'Pick at least one day.',
  'too-many': `You can have up to ${MISSION_LIMITS.maxActiveMissions} active missions.`,
  'not-found': 'That mission no longer exists.',
};

const REWARD_LABEL: Record<MissionRewardLevel, string> = { small: 'Small', medium: 'Medium', big: 'Big' };
const TYPE_UNIT: Record<EditableType, string> = { focusMinutes: 'minutes', sessionCount: 'sessions', scheduledFocus: 'minute session' };

export const EMPTY_DRAFT: MissionDraft = {
  title: '',
  type: 'focusMinutes',
  target: 30,
  recurrence: { kind: 'daily' },
  reward: 'medium',
};

interface Props {
  initial: MissionDraft;
  submitLabel: string;
  onSubmit: (draft: MissionDraft) => MissionError | null;
  onCancel: () => void;
}

/** Custom mission form: type, goal, time window, repeat days and reward size. */
export function MissionEditor({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [draft, setDraft] = useState<MissionDraft>(initial);
  const [error, setError] = useState<MissionError | null>(null);
  const type = draft.type as EditableType;
  const limits = MISSION_LIMITS[type];
  const window = draft.window ?? { startMinute: 16 * 60, endMinute: 19 * 60 };

  // Changing what counts makes a template's description stale, so drop it.
  const change = (patch: Partial<MissionDraft>) => setDraft((d) => ({ ...d, ...patch, description: undefined }));

  const setType = (next: MissionType) => {
    const l = MISSION_LIMITS[next as EditableType];
    const target = Math.min(l.max, Math.max(l.min, next === 'sessionCount' ? 1 : draft.type === 'sessionCount' ? 30 : draft.target));
    change({ type: next, target, window: next === 'scheduledFocus' ? window : undefined, minSessionMinutes: undefined });
  };

  const setWindowHour = (edge: 'startMinute' | 'endMinute', delta: number) => {
    const next = { ...window, [edge]: Math.min(24 * 60, Math.max(0, window[edge] + delta * 60)) };
    if (next.endMinute <= next.startMinute) return;
    change({ window: next });
  };

  const setRecurrence = (recurrence: MissionRecurrence) => setDraft((d) => ({ ...d, recurrence }));
  const days = draft.recurrence.kind === 'weekdays' ? draft.recurrence.days : [];
  const toggleDay = (day: number) =>
    setRecurrence({ kind: 'weekdays', days: days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort() });

  const submit = () => {
    const result = onSubmit(draft);
    setError(result);
  };

  return (
    <Card>
      <Text style={typography.heading}>{initial.title ? 'Edit mission' : 'New mission'}</Text>

      <Field label="Name">
        <TextInput
          value={draft.title}
          onChangeText={(title) => setDraft((d) => ({ ...d, title }))}
          placeholder="e.g. Reading time"
          placeholderTextColor={colors.textMuted}
          maxLength={MISSION_LIMITS.titleMaxLength}
          style={styles.input}
          accessibilityLabel="Mission name"
        />
      </Field>

      <Field label="What counts">
        <View style={styles.chips}>
          {AVAILABLE_MISSION_TYPES.map((t) => (
            <Chip key={t} label={MISSION_TYPE_LABELS[t]} selected={draft.type === t} onPress={() => setType(t)} />
          ))}
          <Chip label={`${MISSION_TYPE_LABELS.avoidSurface} (coming later)`} selected={false} disabled onPress={() => {}} />
        </View>
      </Field>

      <Field label="Goal">
        <Stepper
          value={`${draft.target} ${TYPE_UNIT[type]}`}
          onMinus={() => change({ target: Math.max(limits.min, draft.target - limits.step) })}
          onPlus={() => change({ target: Math.min(limits.max, draft.target + limits.step) })}
          label="Goal"
        />
      </Field>

      {draft.type === 'scheduledFocus' && (
        <Field label="Between">
          <View style={styles.windowRow}>
            <Stepper value={formatMinuteOfDay(window.startMinute)} onMinus={() => setWindowHour('startMinute', -1)} onPlus={() => setWindowHour('startMinute', 1)} label="Window start" />
            <Text style={styles.and}>and</Text>
            <Stepper value={formatMinuteOfDay(window.endMinute)} onMinus={() => setWindowHour('endMinute', -1)} onPlus={() => setWindowHour('endMinute', 1)} label="Window end" />
          </View>
        </Field>
      )}

      <Field label="Repeat">
        <View style={styles.chips}>
          <Chip label="Every day" selected={draft.recurrence.kind === 'daily'} onPress={() => setRecurrence({ kind: 'daily' })} />
          <Chip
            label="Selected days"
            selected={draft.recurrence.kind === 'weekdays'}
            onPress={() => setRecurrence({ kind: 'weekdays', days: days.length ? days : [1, 2, 3, 4, 5] })}
          />
          <Chip label="One time" selected={draft.recurrence.kind === 'once'} onPress={() => setRecurrence({ kind: 'once' })} />
        </View>
        {draft.recurrence.kind === 'weekdays' && (
          <View style={styles.days}>
            {DAY_LETTERS.map((letter, day) => (
              <Pressable
                key={day}
                onPress={() => toggleDay(day)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: days.includes(day) }}
                accessibilityLabel={DAY_NAMES[day]}
                style={[styles.day, days.includes(day) && styles.dayOn]}
              >
                <Text style={[styles.dayText, days.includes(day) && styles.dayTextOn]}>{letter}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Field>

      <Field label="Reward">
        <View style={styles.chips}>
          {(Object.keys(MISSION_REWARD_LEVELS) as MissionRewardLevel[]).map((level) => (
            <Chip
              key={level}
              label={`${REWARD_LABEL[level]} · ${MISSION_REWARD_LEVELS[level].coins} coins`}
              selected={draft.reward === level}
              onPress={() => setDraft((d) => ({ ...d, reward: level }))}
            />
          ))}
        </View>
      </Field>

      <Text style={styles.summary}>Goal: {describeGoal({ ...draft, id: '', rewardCoins: 0, rewardXp: 0, rewardHappiness: 0, active: true, createdAt: 0 })}</Text>
      {error && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {ERROR_COPY[error]}
        </Text>
      )}
      <View style={styles.actions}>
        <Button variant="ghost" label="Cancel" onPress={onCancel} style={styles.action} />
        <Button label={submitLabel} onPress={submit} style={styles.action} />
      </View>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Chip({ label, selected, onPress, disabled = false }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={[styles.chip, selected && styles.chipOn, disabled && styles.chipDisabled]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Stepper({ value, onMinus, onPlus, label }: { value: string; onMinus: () => void; onPlus: () => void; label: string }) {
  return (
    <View style={styles.stepper} accessibilityLabel={`${label}: ${value}`}>
      <Pressable onPress={onMinus} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`Decrease ${label.toLowerCase()}`}>
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable onPress={onPlus} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`Increase ${label.toLowerCase()}`}>
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { ...typography.label, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    minHeight: 48,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, borderWidth: 2, borderColor: 'transparent' },
  chipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipDisabled: { opacity: 0.55 },
  chipText: { fontWeight: '700', color: colors.text, fontSize: 14 },
  chipTextOn: { color: colors.primaryDark },
  windowRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  and: { ...typography.label },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  dayOn: { backgroundColor: colors.primary },
  dayText: { fontWeight: '800', color: colors.text },
  dayTextOn: { color: colors.white },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start' },
  stepBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 22, fontWeight: '900', color: colors.primaryDark },
  stepValue: { ...typography.number, minWidth: 110, textAlign: 'center' },
  summary: { ...typography.body, fontSize: 14, color: colors.textMuted },
  error: { ...typography.label, color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
});
