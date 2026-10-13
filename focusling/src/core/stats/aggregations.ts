import { STATS_CONFIG } from '@/config/stats';
import type { CourseStudySummary, DailyStudySummary, DateKey, FocusSessionRecord, Id, LifetimeStats, StudyStatsSnapshot, TaskCompletionRecord, Timestamp, WeekSummary } from '../models';
import { addDays, atMinute, dayKeyIn, weekdayOfKey } from '../planner/time';

/**
 * Pure Stats aggregations. Days are local calendar days in `timeZone`
 * (DST-safe: a day is midnight to the next midnight, 23 or 25 hours on change
 * days). A session that crosses midnight is split between the two days.
 */

/** Focus minutes per local day for one record. The parts always sum to recordedMinutes. */
export function splitByDay(record: FocusSessionRecord, timeZone: string): { date: DateKey; minutes: number }[] {
  if (record.recordedMinutes <= 0) return [];
  const parts: { date: DateKey; ms: number }[] = [];
  let t = record.startedAt;
  const end = record.endedAt;
  while (t < end) {
    const date = dayKeyIn(t, timeZone);
    const nextMidnight = atMinute(addDays(date, 1), 0, timeZone);
    const until = Math.min(end, nextMidnight > t ? nextMidnight : end);
    parts.push({ date, ms: until - t });
    t = until;
  }
  // Largest-remainder rounding so the days add up to exactly recordedMinutes.
  const total = record.recordedMinutes;
  const spanMs = parts.reduce((s, p) => s + p.ms, 0) || 1;
  const raw = parts.map((p) => (p.ms / spanMs) * total);
  const floors = raw.map(Math.floor);
  let left = total - floors.reduce((s, n) => s + n, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]! += 1;
    left -= 1;
  }
  return parts.map((p, i) => ({ date: p.date, minutes: floors[i]! })).filter((p) => p.minutes > 0);
}

const emptyDay = (date: DateKey): DailyStudySummary => ({ date, focusMinutes: 0, sessionsCompleted: 0, sessionsEndedEarly: 0, tasksCompleted: 0 });

/** Daily summaries for every day in [from, to] (inclusive), in order. */
export function dailySummaries(records: readonly FocusSessionRecord[], tasks: readonly TaskCompletionRecord[], timeZone: string, from: DateKey, to: DateKey): DailyStudySummary[] {
  const days = new Map<DateKey, DailyStudySummary>();
  for (let d = from; d <= to; d = addDays(d, 1)) days.set(d, emptyDay(d));
  for (const r of records) {
    for (const part of splitByDay(r, timeZone)) {
      const day = days.get(part.date);
      if (day) day.focusMinutes += part.minutes;
    }
    const endDay = days.get(dayKeyIn(r.endedAt, timeZone));
    if (endDay) {
      if (r.status === 'completed') endDay.sessionsCompleted += 1;
      else endDay.sessionsEndedEarly += 1;
    }
  }
  for (const t of tasks) {
    const day = days.get(dayKeyIn(t.completedAt, timeZone));
    if (day) day.tasksCompleted += 1;
  }
  return [...days.values()];
}

/** The first day of the week containing `date`. */
export function weekStartOf(date: DateKey, weekStartsOn: number = STATS_CONFIG.weekStartsOn): DateKey {
  const back = (weekdayOfKey(date) - weekStartsOn + 7) % 7;
  return addDays(date, -back);
}

export function summarizeWeek(records: readonly FocusSessionRecord[], tasks: readonly TaskCompletionRecord[], timeZone: string, start: DateKey): WeekSummary {
  const days = dailySummaries(records, tasks, timeZone, start, addDays(start, 6));
  return {
    start,
    days,
    focusMinutes: days.reduce((s, d) => s + d.focusMinutes, 0),
    sessionsCompleted: days.reduce((s, d) => s + d.sessionsCompleted, 0),
    sessionsEndedEarly: days.reduce((s, d) => s + d.sessionsEndedEarly, 0),
    tasksCompleted: days.reduce((s, d) => s + d.tasksCompleted, 0),
    daysStudied: days.filter((d) => d.focusMinutes > 0).length,
  };
}

/** Weekly totals for the `weeks` weeks ending with the current one, oldest first. */
export function weeklyTrend(records: readonly FocusSessionRecord[], tasks: readonly TaskCompletionRecord[], timeZone: string, now: Timestamp, weeks: number): WeekSummary[] {
  const current = weekStartOf(dayKeyIn(now, timeZone));
  const out: WeekSummary[] = [];
  for (let i = weeks - 1; i >= 0; i--) out.push(summarizeWeek(records, tasks, timeZone, addDays(current, -7 * i)));
  return out;
}

/**
 * Focus time and task completions by course over [from, to] (local days).
 * Time not linked to a course is reported as courseId null, never guessed.
 * Sorted by focus minutes (most first), Unassigned last.
 */
export function courseBreakdown(records: readonly FocusSessionRecord[], tasks: readonly TaskCompletionRecord[], timeZone: string, from: DateKey, to: DateKey): CourseStudySummary[] {
  const rows = new Map<Id | null, CourseStudySummary>();
  const row = (courseId: Id | null) => {
    let r = rows.get(courseId);
    if (!r) rows.set(courseId, (r = { courseId, focusMinutes: 0, sessionsCompleted: 0, tasksCompleted: 0 }));
    return r;
  };
  const inRange = (d: DateKey) => d >= from && d <= to;
  for (const r of records) {
    const minutes = splitByDay(r, timeZone).filter((p) => inRange(p.date)).reduce((s, p) => s + p.minutes, 0);
    const ended = inRange(dayKeyIn(r.endedAt, timeZone));
    if (minutes === 0 && !ended) continue;
    const target = row(r.courseId ?? null);
    target.focusMinutes += minutes;
    if (ended && r.status === 'completed') target.sessionsCompleted += 1;
  }
  for (const t of tasks) if (inRange(dayKeyIn(t.completedAt, timeZone))) row(t.courseId).tasksCompleted += 1;
  return [...rows.values()]
    .filter((r) => r.focusMinutes > 0 || r.sessionsCompleted > 0 || r.tasksCompleted > 0)
    .sort((a, b) => (a.courseId === null ? 1 : 0) - (b.courseId === null ? 1 : 0) || b.focusMinutes - a.focusMinutes || b.tasksCompleted - a.tasksCompleted);
}

/** Most recent sessions first. */
export function recentSessions(records: readonly FocusSessionRecord[], limit: number): FocusSessionRecord[] {
  return [...records].sort((a, b) => b.startedAt - a.startedAt || (a.id < b.id ? 1 : -1)).slice(0, limit);
}

/** Everything the Stats overview needs, for the week containing `weekOf` (defaults to now). */
export function buildStatsSnapshot(
  records: readonly FocusSessionRecord[],
  tasks: readonly TaskCompletionRecord[],
  lifetime: Pick<LifetimeStats, 'sessionsCompleted'> | null,
  timeZone: string,
  now: Timestamp,
  weekOf: DateKey = dayKeyIn(now, timeZone),
): StudyStatsSnapshot {
  const todayKey = dayKeyIn(now, timeZone);
  const start = weekStartOf(weekOf);
  const week = summarizeWeek(records, tasks, timeZone, start);
  const window = STATS_CONFIG.consistencyWindowDays;
  const recent = dailySummaries(records, tasks, timeZone, addDays(todayKey, -(window - 1)), todayKey);
  const completed = records.filter((r) => r.status === 'completed').length;
  return {
    timezone: timeZone,
    today: dailySummaries(records, tasks, timeZone, todayKey, todayKey)[0]!,
    week,
    consistency: { daysStudied: recent.filter((d) => d.focusMinutes > 0).length, windowDays: window },
    courses: courseBreakdown(records, tasks, timeZone, start, addDays(start, 6)),
    totals: {
      focusMinutes: records.reduce((s, r) => s + r.recordedMinutes, 0),
      sessionsCompleted: completed,
      sessionsEndedEarly: records.length - completed,
      tasksCompleted: tasks.length,
    },
    recordsSince: records.length ? records[0]!.startedAt : null,
    hasOlderUntrackedHistory: (lifetime?.sessionsCompleted ?? 0) > completed,
  };
}
