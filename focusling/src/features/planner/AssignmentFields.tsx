import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { EFFORT_CHOICES } from '@/config/planner';
import { addDays, type AssignmentType } from '@/core';
import { Pressable, colors, radius, spacing, typography } from '@/ui';
import { formatDayKey, TYPE_LABEL, TYPE_ORDER } from './plannerCopy';

/** Small, accessible editors shared by review, manual entry and assignment detail. */

export function Chips<T extends string | number>({ label, options, value, onChange }: { label: string; options: readonly { value: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable key={String(o.value)} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={`${label}: ${o.label}`} style={[styles.chip, selected && styles.chipOn]}>
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function TypeChips({ value, onChange }: { value: AssignmentType; onChange: (t: AssignmentType) => void }) {
  return <Chips label="Type" options={TYPE_ORDER.map((t) => ({ value: t, label: TYPE_LABEL[t] }))} value={value} onChange={onChange} />;
}

/** 30m / 1h / 2h / 4h+ / Custom. Never pre-filled from the title. */
export function EffortField({ value, onChange }: { value: number | null; onChange: (m: number | null) => void }) {
  const preset = EFFORT_CHOICES.some((c) => c.minutes === value);
  const [custom, setCustom] = useState(value !== null && !preset);
  const [text, setText] = useState(value !== null && !preset ? String(value) : '');
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Study effort (your estimate)</Text>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Study effort">
        {EFFORT_CHOICES.map((c) => {
          const selected = !custom && value === c.minutes;
          return (
            <Pressable
              key={c.label}
              onPress={() => {
                setCustom(false);
                onChange(c.minutes);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Effort ${c.label}`}
              style={[styles.chip, selected && styles.chipOn]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{c.label}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setCustom(true)} accessibilityRole="radio" accessibilityState={{ selected: custom }} accessibilityLabel="Effort custom" style={[styles.chip, custom && styles.chipOn]}>
          <Text style={[styles.chipText, custom && styles.chipTextOn]}>Custom</Text>
        </Pressable>
      </View>
      {custom && (
        <View style={styles.inline}>
          <TextInput
            value={text}
            onChangeText={(t) => {
              setText(t.replace(/[^0-9]/g, ''));
              const n = Number(t.replace(/[^0-9]/g, ''));
              onChange(n > 0 ? Math.min(n, 60 * 40) : null);
            }}
            keyboardType="number-pad"
            style={[styles.input, styles.short]}
            accessibilityLabel="Custom effort in minutes"
            placeholder="90"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.help}>minutes</Text>
        </View>
      )}
    </View>
  );
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** Due date: readable value, ±1 day steppers and typed entry (YYYY-MM-DD). */
export function DateField({ value, onChange, label = 'Due date' }: { value: string | null; onChange: (key: string | null) => void; label?: string }) {
  const [text, setText] = useState(value ?? '');
  const set = (k: string | null) => {
    setText(k ?? '');
    onChange(k);
  };
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {value ? ` · ${formatDayKey(value)}` : ''}
      </Text>
      <View style={styles.inline}>
        <Pressable onPress={() => value && set(addDays(value, -1))} disabled={!value} style={styles.step} accessibilityRole="button" accessibilityLabel={`${label}: one day earlier`}>
          <Text style={styles.stepText}>‹</Text>
        </Pressable>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (DATE_RE.test(t)) onChange(t);
            if (!t) onChange(null);
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.dateInput]}
          accessibilityLabel={label}
          autoCapitalize="none"
        />
        <Pressable onPress={() => value && set(addDays(value, 1))} disabled={!value} style={styles.step} accessibilityRole="button" accessibilityLabel={`${label}: one day later`}>
          <Text style={styles.stepText}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Due time: "No time" (date only) or a 24-hour HH:MM entry. */
export function TimeField({ value, onChange }: { value: string | null; onChange: (t: string | null) => void }) {
  const [text, setText] = useState(value ?? '');
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Due time</Text>
      <View style={styles.inline}>
        <Pressable
          onPress={() => {
            setText('');
            onChange(null);
          }}
          accessibilityRole="radio"
          accessibilityState={{ selected: !value }}
          accessibilityLabel="No due time (date only)"
          style={[styles.chip, !value && styles.chipOn]}
        >
          <Text style={[styles.chipText, !value && styles.chipTextOn]}>Date only</Text>
        </Pressable>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (TIME_RE.test(t)) onChange(t.padStart(5, '0'));
          }}
          placeholder="23:59"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.short]}
          accessibilityLabel="Due time, 24-hour"
          autoCapitalize="none"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { ...typography.label, color: colors.text },
  help: { ...typography.label },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 40, minWidth: 44, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontSize: 14, fontWeight: '800', color: colors.text },
  chipTextOn: { color: colors.white },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  input: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: 15, color: colors.text, backgroundColor: colors.surface },
  short: { width: 96 },
  dateInput: { flexGrow: 1, flexBasis: 130 },
  step: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 22, fontWeight: '900', color: colors.primaryDark },
});
