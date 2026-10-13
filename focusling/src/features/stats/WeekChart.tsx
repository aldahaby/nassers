import { StyleSheet, Text, View } from 'react-native';
import type { DailyStudySummary } from '@/core';
import { colors, radius, spacing } from '@/ui';
import { formatDayKey, formatMinutes, weekdayShort } from '../planner/plannerCopy';

const BAR_HEIGHT = 120;

/**
 * Seven dated bars of focus time. Plain Views (no chart library). Each bar is
 * labelled for screen readers; days still to come are marked, not drawn as 0.
 * The scale is this week's own largest day: no targets or comparisons.
 */
export function WeekChart({ days, todayKey }: { days: readonly DailyStudySummary[]; todayKey: string }) {
  const max = Math.max(30, ...days.map((d) => d.focusMinutes));
  return (
    <View style={styles.chart} accessibilityRole="summary" accessibilityLabel="Focus time each day this week">
      {days.map((d) => {
        const future = d.date > todayKey;
        const weekday = weekdayShort(new Date(`${d.date}T12:00:00Z`).getUTCDay());
        const h = d.focusMinutes > 0 ? Math.max(4, Math.round((d.focusMinutes / max) * BAR_HEIGHT)) : 0;
        const label = `${formatDayKey(d.date)}${d.date === todayKey ? ' (today)' : ''}: ${future ? 'still to come' : d.focusMinutes > 0 ? `${formatMinutes(d.focusMinutes)} of focus time` : 'no focus time recorded'}`;
        return (
          <View key={d.date} style={styles.col} accessible accessibilityLabel={label} testID={`bar-${d.date}`}>
            <Text style={styles.value} numberOfLines={1}>
              {future ? '' : d.focusMinutes > 0 ? formatMinutes(d.focusMinutes) : '–'}
            </Text>
            <View style={styles.track}>
              <View style={[styles.bar, { height: h }, d.date === todayKey && styles.today]} />
            </View>
            <Text style={[styles.day, d.date === todayKey && styles.dayToday, future && styles.dayFuture]}>{weekday}</Text>
            <Text style={[styles.date, future && styles.dayFuture]}>{Number(d.date.slice(8))}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  value: { fontSize: 10, fontWeight: '800', color: colors.textMuted, fontVariant: ['tabular-nums'] },
  track: { height: BAR_HEIGHT, width: '70%', maxWidth: 36, justifyContent: 'flex-end', borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  bar: { width: '100%', backgroundColor: colors.primary, borderRadius: radius.sm },
  today: { backgroundColor: colors.primaryDark },
  day: { fontSize: 12, fontWeight: '800', color: colors.text },
  dayToday: { color: colors.primaryDark },
  dayFuture: { color: colors.textMuted, opacity: 0.6 },
  date: { fontSize: 11, fontWeight: '700', color: colors.textMuted, fontVariant: ['tabular-nums'] },
});
