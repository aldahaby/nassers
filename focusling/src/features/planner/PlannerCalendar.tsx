import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { addDays, dayKeyIn, isActivePlan, liveAssignments, plansOnDay, type PlannerState } from '@/core';
import { useNow } from '@/hooks/useNow';
import { usePlannerStore } from '@/state';
import { Button, Card, Pressable, colors, radius, spacing, typography } from '@/ui';
import { PlanRow } from './PlanCard';
import { CourseTag } from './PlannerBits';
import { formatDayKey, formatMinutes, weekdayShort } from './plannerCopy';

/**
 * The week, Studyling-style: a day strip, then that day's blocks and what's
 * due. No tiny calendar cells: on phones it's one day at a time; wide screens
 * show the whole week as columns of readable rows.
 */
export function PlannerCalendar({ initialDay }: { initialDay?: string }) {
  const planner = usePlannerStore((s) => s.planner);
  const now = useNow(60_000);
  const { width } = useWindowDimensions();
  const tz = planner?.preferences.timezone ?? 'UTC';
  const today = dayKeyIn(now, tz);
  const [weekStart, setWeekStart] = useState(() => addDays(today, -new Date(`${today}T12:00:00Z`).getUTCDay()));
  const [selected, setSelected] = useState(initialDay ?? today);
  if (!planner) return null;
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const wide = width >= 900;

  return (
    <View style={styles.wrap}>
      <View style={styles.nav}>
        <Button label="‹ Previous week" variant="ghost" onPress={() => setWeekStart(addDays(weekStart, -7))} />
        <Text style={styles.range} accessibilityRole="header">
          {formatDayKey(days[0]!)} – {formatDayKey(days[6]!)}
        </Text>
        <Button label="Next week ›" variant="ghost" onPress={() => setWeekStart(addDays(weekStart, 7))} />
      </View>

      {wide ? (
        <View style={styles.columns}>
          {days.map((d) => (
            <View key={d} style={styles.column}>
              <DayHeader planner={planner} day={d} today={today} selected={false} />
              <DayBody planner={planner} day={d} now={now} compact />
            </View>
          ))}
        </View>
      ) : (
        <>
          <View style={styles.strip} accessibilityRole="tablist">
            {days.map((d) => (
              <Pressable key={d} onPress={() => setSelected(d)} accessibilityRole="tab" accessibilityState={{ selected: d === selected }} accessibilityLabel={`${formatDayKey(d)}${d === today ? ', today' : ''}`} style={styles.stripCell}>
                <DayHeader planner={planner} day={d} today={today} selected={d === selected} />
              </Pressable>
            ))}
          </View>
          <Text style={typography.heading}>{selected === today ? 'Today' : formatDayKey(selected)}</Text>
          <DayBody planner={planner} day={selected} now={now} />
        </>
      )}
    </View>
  );
}

function DayHeader({ planner, day, today, selected }: { planner: PlannerState; day: string; today: string; selected: boolean }) {
  const plans = plansOnDay(planner, day, planner.preferences.timezone).filter((p) => isActivePlan(p) || p.status === 'completed');
  const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
  return (
    <View style={[styles.dayHead, selected && styles.dayHeadOn, day === today && styles.dayToday]}>
      <Text style={[styles.dayName, selected && styles.on]}>{weekdayShort(wd)}</Text>
      <Text style={[styles.dayNum, selected && styles.on]}>{Number(day.slice(8))}</Text>
      <Text style={[styles.dayMeta, selected && styles.on]}>{plans.length ? `${plans.length} · ${formatMinutes(plans.reduce((s, p) => s + p.plannedMinutes, 0))}` : '—'}</Text>
    </View>
  );
}

function DayBody({ planner, day, now, compact = false }: { planner: PlannerState; day: string; now: number; compact?: boolean }) {
  const tz = planner.preferences.timezone;
  const plans = plansOnDay(planner, day, tz).filter((p) => isActivePlan(p) || p.status === 'completed' || p.status === 'proposed');
  const due = liveAssignments(planner).filter((a) => a.dueAt && dayKeyIn(a.dueAt, planner.courses[a.courseId]?.timezone ?? tz) === day);
  return (
    <Card style={compact ? styles.compactCard : undefined}>
      {plans.length === 0 && due.length === 0 && <Text style={styles.muted}>Nothing planned.</Text>}
      {plans.map((p) => (
        <PlanRow key={p.id} planner={planner} plan={p} now={now} onPress={p.assignmentId ? () => router.push(`/planner/assignment/${p.assignmentId}` as Href) : undefined} />
      ))}
      {due.length > 0 && (
        <View style={styles.dueBlock}>
          <Text style={styles.dueTitle}>Due</Text>
          {due.map((a) => (
            <Pressable key={a.id} onPress={() => router.push(`/planner/assignment/${a.id}` as Href)} style={styles.dueRow} accessibilityRole="button" accessibilityLabel={`Due: ${a.title}`}>
              <CourseTag course={planner.courses[a.courseId]} />
              <Text style={styles.dueText} numberOfLines={2}>
                {a.title}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  range: { ...typography.label, color: colors.text, fontSize: 14 },
  strip: { flexDirection: 'row', gap: 4 },
  stripCell: { flex: 1 },
  dayHead: { alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, minHeight: 72, justifyContent: 'center', gap: 1 },
  dayHeadOn: { backgroundColor: colors.ink },
  dayToday: { borderWidth: 2, borderColor: colors.primary },
  dayName: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  dayNum: { fontSize: 18, fontWeight: '900', color: colors.text },
  dayMeta: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textAlign: 'center' },
  on: { color: colors.white },
  columns: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  column: { flex: 1, gap: spacing.sm, minWidth: 0 },
  compactCard: { padding: spacing.sm, gap: 4 },
  muted: { ...typography.label },
  dueBlock: { gap: 4, borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.sm },
  dueTitle: { ...typography.label, textTransform: 'uppercase', letterSpacing: 0.8 },
  dueRow: { gap: 2, minHeight: 44, justifyContent: 'center' },
  dueText: { fontSize: 14, fontWeight: '700', color: colors.text },
});
