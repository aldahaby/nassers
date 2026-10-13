import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { STATS_CONFIG } from '@/config/stats';
import { addDays, buildStatsSnapshot, dayKeyIn, recentSessions, weekStartOf, weeklyTrend, type Course, type FocusSessionRecord, type PlannerState } from '@/core';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { useNow } from '@/hooks/useNow';
import { useCapabilities, usePlanner, useStudyData } from '@/state';
import { Button, Card, Pressable, Screen, TabIcon, colors, radius, spacing, typography } from '@/ui';
import { CourseTag, SectionTitle } from '../planner/PlannerBits';
import { formatClock, formatDay, formatDayKey, formatMinutes } from '../planner/plannerCopy';
import { JourneyView } from './JourneyView';
import { FOCUS_TIME_NOTE, STATUS_LABEL, plural } from './statsCopy';
import { WeekChart } from './WeekChart';

type Tab = 'overview' | 'journey';

/**
 * Stats & Journey (docs/STATS_AND_JOURNEY.md). Everything shown comes from
 * real records; empty is shown as empty. All of it is Free: only longer-range
 * extras sit behind a capability.
 */
export function StatsScreen() {
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <Screen scroll>
      <View>
        <Text style={typography.title} accessibilityRole="header">
          Stats
        </Text>
        <Text style={styles.subtitle}>Your recorded focus time and finished work.</Text>
      </View>
      <View style={styles.segment} accessibilityRole="tablist">
        {(['overview', 'journey'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.segmentItem, tab === t && styles.segmentOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} sound="nav">
            <Text style={[styles.segmentText, tab === t && styles.segmentTextOn]}>{t === 'overview' ? 'Overview' : 'Journey'}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'overview' ? <Overview /> : <JourneyView />}
    </Screen>
  );
}

function Overview() {
  const now = useNow(60_000);
  const planner = usePlanner();
  const { records, tasks, journeyInputs } = useStudyData();
  const caps = useCapabilities();
  const routes = useAppRoutes();
  const tz = planner?.preferences.timezone ?? 'UTC';
  const todayKey = dayKeyIn(now, tz);
  const currentWeek = weekStartOf(todayKey);
  const [weekStart, setWeekStart] = useState(currentWeek);
  const [historyCount, setHistoryCount] = useState<number>(STATS_CONFIG.historyPageSize);
  const [longRange, setLongRange] = useState(false);

  // Tiles and totals are always "now"; the week card and course rows follow the week being viewed.
  const snap = useMemo(() => buildStatsSnapshot(records, tasks, journeyInputs.lifetime, tz, now), [records, tasks, journeyInputs.lifetime, tz, now]);
  const viewed = useMemo(() => buildStatsSnapshot(records, tasks, null, tz, now, weekStart), [records, tasks, tz, now, weekStart]);
  const earliest = Math.min(records[0]?.startedAt ?? Infinity, tasks[0]?.completedAt ?? Infinity);
  const firstWeek = Number.isFinite(earliest) ? weekStartOf(dayKeyIn(earliest, tz)) : currentWeek;
  const trendWeeks = caps.canUseExtendedStats && longRange ? STATS_CONFIG.extendedTrendWeeks : STATS_CONFIG.trendWeeks;
  const trend = useMemo(() => weeklyTrend(records, tasks, tz, now, trendWeeks), [records, tasks, tz, now, trendWeeks]);
  const history = useMemo(() => recentSessions(records, historyCount), [records, historyCount]);
  const isCurrent = weekStart === currentWeek;
  const courses = planner?.courses ?? {};

  if (records.length === 0 && tasks.length === 0) {
    return (
      <Card>
        <Text style={typography.heading}>Nothing recorded yet</Text>
        <Text style={styles.body}>Finish a focus session or complete a task in the Planner, then come back. Studyling only shows what really happened.</Text>
        <Button label="Start a focus session" onPress={() => router.navigate(routes.focus as Href)} />
        <Text style={styles.note}>{FOCUS_TIME_NOTE}</Text>
      </Card>
    );
  }

  return (
    <>
      <View style={styles.tiles}>
        <Tile label="Today" value={formatMinutes(snap.today.focusMinutes)} hint="focus time" />
        <Tile label="This week" value={formatMinutes(snap.week.focusMinutes)} hint="focus time" />
        <Tile label="Sessions" value={String(snap.week.sessionsCompleted)} hint="completed this week" />
        <Tile label="Tasks" value={String(snap.week.tasksCompleted)} hint="done this week" />
      </View>
      <Card>
        <Text style={styles.consistency} accessibilityRole="text">
          You studied on {plural(snap.consistency.daysStudied, 'day')} of the last {snap.consistency.windowDays}.
        </Text>
        <Text style={styles.small}>Rest days are part of studying. Nothing resets if you take a break.</Text>
      </Card>

      <Card>
        <View style={styles.weekHeader}>
          <Pressable onPress={() => setWeekStart(addDays(weekStart, -7))} disabled={weekStart <= firstWeek} style={[styles.pager, weekStart <= firstWeek && styles.pagerOff]} accessibilityRole="button" accessibilityLabel="Previous week" sound="nav">
            <Text style={styles.pagerText}>‹</Text>
          </Pressable>
          <View style={styles.weekTitle}>
            <Text style={typography.heading}>{isCurrent ? 'This week' : `Week of ${formatDayKey(weekStart)}`}</Text>
            <Text style={styles.small}>
              {formatMinutes(viewed.week.focusMinutes)} · {plural(viewed.week.sessionsCompleted, 'session')}
              {viewed.week.sessionsEndedEarly ? ` (+${viewed.week.sessionsEndedEarly} ended early)` : ''} · {plural(viewed.week.tasksCompleted, 'task')} done
            </Text>
          </View>
          <Pressable onPress={() => setWeekStart(addDays(weekStart, 7))} disabled={isCurrent} style={[styles.pager, isCurrent && styles.pagerOff]} accessibilityRole="button" accessibilityLabel="Next week" sound="nav">
            <Text style={styles.pagerText}>›</Text>
          </Pressable>
        </View>
        <WeekChart days={viewed.week.days} todayKey={todayKey} />
        {viewed.week.focusMinutes === 0 && <Text style={styles.small}>{isCurrent ? 'No focus time recorded this week yet.' : 'No focus time recorded this week.'}</Text>}
      </Card>

      <Card>
        <SectionTitle>{isCurrent ? 'By course this week' : 'By course'}</SectionTitle>
        {viewed.courses.length === 0 ? (
          <Text style={styles.small}>Nothing recorded for this week.</Text>
        ) : (
          <CourseRows rows={viewed.courses} courses={courses} />
        )}
        <Text style={styles.small}>Sessions started from Focus without choosing a course are shown as “Not linked to a course”.</Text>
      </Card>

      <Card>
        <SectionTitle
          action={
            caps.canUseExtendedStats ? (
              <Pressable onPress={() => setLongRange(!longRange)} accessibilityRole="button" style={styles.linkBtn}>
                <Text style={styles.link}>{longRange ? `${STATS_CONFIG.trendWeeks} weeks` : `${STATS_CONFIG.extendedTrendWeeks} weeks`}</Text>
              </Pressable>
            ) : undefined
          }
        >
          Progress over time
        </SectionTitle>
        <Text style={styles.body}>
          {snap.totals.focusMinutes > 0 ? `${formatMinutes(snap.totals.focusMinutes)} of focus time` : 'No focus time yet'} and {plural(snap.totals.tasksCompleted, 'task')} done
          {snap.recordsSince ? ` since ${formatDay(snap.recordsSince, tz)}` : ''}.
        </Text>
        <TrendRows trend={trend} currentWeek={currentWeek} />
        <TaskProgress planner={planner} />
      </Card>

      <Card>
        <SectionTitle>Recent sessions</SectionTitle>
        {history.map((r) => (
          <HistoryRow key={r.id} record={r} course={r.courseId ? courses[r.courseId] : undefined} tz={tz} now={now} />
        ))}
        {records.length > history.length && <Button variant="ghost" label="Show more" onPress={() => setHistoryCount(historyCount + STATS_CONFIG.historyPageSize)} />}
      </Card>

      <View style={styles.notes}>
        <Text style={styles.note}>{FOCUS_TIME_NOTE}</Text>
        {snap.hasOlderUntrackedHistory && (
          <Text style={styles.note}>
            Your pet remembers {plural((journeyInputs.lifetime?.sessionsCompleted ?? 0) - snap.totals.sessionsCompleted, 'earlier session')} from before detailed records were kept. They count toward Journey but aren’t charted here.
          </Text>
        )}
        <Text style={styles.note}>Stats stay on this device. Nothing is sent anywhere.</Text>
      </View>
    </>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value} ${hint}`}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileHint}>{hint}</Text>
    </View>
  );
}

function CourseRows({ rows, courses }: { rows: ReturnType<typeof buildStatsSnapshot>['courses']; courses: Record<string, Course> }) {
  const max = Math.max(1, ...rows.map((r) => r.focusMinutes));
  const ids = Object.keys(courses);
  return (
    <View style={styles.rows}>
      {rows.map((r) => {
        const course = r.courseId ? courses[r.courseId] : undefined;
        const name = r.courseId ? (course ? course.code ?? course.name : 'Removed course') : 'Not linked to a course';
        return (
          <View key={r.courseId ?? 'none'} style={styles.courseRow} accessible accessibilityLabel={`${name}: ${formatMinutes(r.focusMinutes)} of focus time, ${plural(r.tasksCompleted, 'task')} done`}>
            <View style={styles.courseTop}>
              {r.courseId && course ? <CourseTag course={course} index={ids.indexOf(r.courseId)} /> : <Text style={styles.courseNone}>{name}</Text>}
              <Text style={styles.courseMinutes}>{formatMinutes(r.focusMinutes)}</Text>
            </View>
            <View style={styles.hTrack}>
              <View style={[styles.hBar, { width: `${Math.round((r.focusMinutes / max) * 100)}%` }, !r.courseId && styles.hBarNone]} />
            </View>
            {r.tasksCompleted > 0 && <Text style={styles.small}>{plural(r.tasksCompleted, 'task')} done</Text>}
          </View>
        );
      })}
    </View>
  );
}

function TrendRows({ trend, currentWeek }: { trend: ReturnType<typeof weeklyTrend>; currentWeek: string }) {
  const max = Math.max(1, ...trend.map((w) => w.focusMinutes));
  return (
    <View style={styles.rows}>
      {trend.map((w) => (
        <View key={w.start} style={styles.trendRow} accessible accessibilityLabel={`Week of ${formatDayKey(w.start)}: ${formatMinutes(w.focusMinutes)}, ${plural(w.tasksCompleted, 'task')} done`}>
          <Text style={styles.trendLabel}>{w.start === currentWeek ? 'This week' : formatDayKey(w.start).slice(4)}</Text>
          <View style={styles.hTrackFlex}>
            <View style={[styles.hBar, { width: `${Math.round((w.focusMinutes / max) * 100)}%` }]} />
          </View>
          <Text style={styles.trendValue}>{w.focusMinutes ? formatMinutes(w.focusMinutes) : '–'}</Text>
        </View>
      ))}
    </View>
  );
}

function TaskProgress({ planner }: { planner: PlannerState | null }) {
  if (!planner) return null;
  const live = Object.values(planner.assignments).filter((a) => !a.deletedAt);
  if (live.length === 0) return null;
  const done = live.filter((a) => a.status === 'completed').length;
  return (
    <View style={styles.taskProgress} accessible accessibilityLabel={`${done} of ${live.length} Planner tasks done`}>
      <TabIcon name="check" color={colors.success} size={18} />
      <Text style={styles.body}>
        {done} of {live.length} Planner tasks done{done > 0 ? '. Nice work.' : '.'}
      </Text>
    </View>
  );
}

function HistoryRow({ record, course, tz, now }: { record: FocusSessionRecord; course: Course | undefined; tz: string; now: number }) {
  const minutes = record.recordedMinutes > 0 ? formatMinutes(record.recordedMinutes) : 'under 1 min';
  const where = record.courseId ? (course ? course.code ?? course.name : 'Removed course') : 'No course';
  const label = `${formatDay(record.startedAt, tz, now)} at ${formatClock(record.startedAt, tz)}, ${minutes}, ${where}, ${STATUS_LABEL[record.status]}`;
  return (
    <View style={styles.historyRow} accessible accessibilityLabel={label}>
      <View style={styles.historyWhen}>
        <Text style={styles.historyDay}>{formatDay(record.startedAt, tz, now)}</Text>
        <Text style={styles.small}>{formatClock(record.startedAt, tz)}</Text>
      </View>
      <View style={styles.historyMid}>
        <Text style={styles.historyMinutes}>{minutes}</Text>
        <Text style={styles.small} numberOfLines={1}>
          {where}
        </Text>
      </View>
      <View style={[styles.status, record.status === 'completed' ? styles.statusDone : styles.statusEarly]}>
        {record.status === 'completed' && <TabIcon name="check" color={colors.success} size={12} />}
        <Text style={[styles.statusText, record.status === 'completed' && { color: colors.success }]}>{STATUS_LABEL[record.status]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { ...typography.label, marginTop: 2 },
  body: { ...typography.body, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '600', color: colors.textMuted, lineHeight: 18 },
  note: { fontSize: 13, fontWeight: '600', color: colors.textMuted, lineHeight: 18 },
  notes: { gap: spacing.sm, paddingHorizontal: spacing.xs },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.surface },
  segmentText: { fontSize: 15, fontWeight: '800', color: colors.textMuted },
  segmentTextOn: { color: colors.primaryDark },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: 2, borderWidth: 1, borderColor: colors.border },
  tileLabel: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  tileValue: { fontSize: 24, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'] },
  tileHint: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  consistency: { ...typography.body, fontWeight: '800' },
  weekHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weekTitle: { flex: 1, alignItems: 'center', gap: 2 },
  pager: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  pagerOff: { opacity: 0.35 },
  pagerText: { fontSize: 24, fontWeight: '900', color: colors.primaryDark, marginTop: -2 },
  rows: { gap: spacing.md },
  courseRow: { gap: 6 },
  courseTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  courseNone: { fontSize: 14, fontWeight: '800', color: colors.textMuted, fontStyle: 'italic' },
  courseMinutes: { fontSize: 14, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'] },
  hTrack: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  hTrackFlex: { flex: 1, height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  hBar: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
  hBarNone: { backgroundColor: colors.textMuted },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  trendLabel: { width: 72, fontSize: 13, fontWeight: '800', color: colors.text },
  trendValue: { width: 64, textAlign: 'right', fontSize: 13, fontWeight: '800', color: colors.textMuted, fontVariant: ['tabular-nums'] },
  taskProgress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xs },
  linkBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  link: { fontSize: 14, fontWeight: '800', color: colors.primaryDark },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border, minHeight: 52 },
  historyWhen: { width: 92 },
  historyDay: { fontSize: 14, fontWeight: '800', color: colors.text },
  historyMid: { flex: 1, gap: 2 },
  historyMinutes: { fontSize: 15, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'] },
  status: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  statusDone: { backgroundColor: colors.successSoft },
  statusEarly: { backgroundColor: colors.surfaceMuted },
  statusText: { fontSize: 11, fontWeight: '800', color: colors.textMuted },
});
