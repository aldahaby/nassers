import { buildStatsSnapshot, courseBreakdown, dailySummaries, splitByDay, summarizeWeek, weekStartOf, weeklyTrend } from '../../stats/aggregations';
import { fromWallClock } from '../../planner/time';
import { NY, record } from './helpers';

const ny = (y: number, mo: number, d: number, h: number, mi = 0) => fromWallClock({ year: y, month: mo, day: d, hour: h, minute: mi }, NY);

describe('local day boundaries', () => {
  it('splits a session that crosses midnight between the two days', () => {
    expect(splitByDay(record(ny(2026, 10, 13, 23, 30), 60), NY)).toEqual([
      { date: '2026-10-13', minutes: 30 },
      { date: '2026-10-14', minutes: 30 },
    ]);
  });

  it('the day parts always add up to the recorded minutes', () => {
    const parts = splitByDay(record(ny(2026, 10, 13, 23, 20) + 20_000, 47), NY);
    expect(parts.reduce((s, p) => s + p.minutes, 0)).toBe(47);
  });

  it('uses the zone it is given: the same session can be on different days in different zones', () => {
    const r = record(ny(2026, 10, 13, 20), 30);
    expect(splitByDay(r, NY)[0]!.date).toBe('2026-10-13');
    expect(splitByDay(r, 'Asia/Tokyo')[0]!.date).toBe('2026-10-14');
  });

  it('DST fall back: the repeated hour is real time on one day; midnight still splits correctly', () => {
    // 1 Nov 2026: clocks go 01:59 EDT → 01:00 EST in New York (a 25-hour day).
    expect(splitByDay(record(ny(2026, 11, 1, 0, 30), 120), NY)).toEqual([{ date: '2026-11-01', minutes: 120 }]);
    expect(splitByDay(record(ny(2026, 10, 31, 23, 30), 60), NY)).toEqual([
      { date: '2026-10-31', minutes: 30 },
      { date: '2026-11-01', minutes: 30 },
    ]);
  });

  it('DST spring forward: minutes are real elapsed minutes, not wall-clock differences', () => {
    // 14 Mar 2027: 02:00 EST → 03:00 EDT. 01:30–04:30 on the wall is 2 real hours.
    const start = ny(2027, 3, 14, 1, 30);
    const end = ny(2027, 3, 14, 4, 30);
    expect((end - start) / 60_000).toBe(120);
    expect(splitByDay(record(start, 120), NY)).toEqual([{ date: '2027-03-14', minutes: 120 }]);
    expect(splitByDay(record(ny(2027, 3, 13, 23, 0), 120), NY)).toEqual([
      { date: '2027-03-13', minutes: 60 },
      { date: '2027-03-14', minutes: 60 },
    ]);
  });
});

describe('daily and weekly summaries', () => {
  it('counts completed and ended-early sessions separately on the day they ended', () => {
    const days = dailySummaries([record(ny(2026, 10, 13, 9), 25), record(ny(2026, 10, 13, 11), 10, { status: 'endedEarly' })], [], NY, '2026-10-13', '2026-10-13');
    expect(days[0]).toEqual({ date: '2026-10-13', focusMinutes: 35, sessionsCompleted: 1, sessionsEndedEarly: 1, tasksCompleted: 0 });
  });

  it('weeks start on Monday by default (configurable)', () => {
    expect(weekStartOf('2026-10-18')).toBe('2026-10-12'); // Sunday → previous Monday
    expect(weekStartOf('2026-10-12')).toBe('2026-10-12');
    expect(weekStartOf('2026-10-18', 0)).toBe('2026-10-18');
  });

  it('a Sunday-night session that runs past midnight is split across the two weeks', () => {
    const r = record(ny(2026, 10, 18, 23, 50), 20);
    expect(summarizeWeek([r], [], NY, '2026-10-12').focusMinutes).toBe(10);
    expect(summarizeWeek([r], [], NY, '2026-10-19').focusMinutes).toBe(10);
  });

  it('the week always has seven dated days, empty ones included (no gaps, no invented values)', () => {
    const w = summarizeWeek([record(ny(2026, 10, 14, 9), 30)], [], NY, '2026-10-12');
    expect(w.days.map((d) => d.date)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
    expect(w.days.map((d) => d.focusMinutes)).toEqual([0, 0, 30, 0, 0, 0, 0]);
    expect(w.daysStudied).toBe(1);
  });

  it('the trend lists whole weeks oldest first, ending with the current week', () => {
    const t = weeklyTrend([record(ny(2026, 10, 1, 9), 40), record(ny(2026, 10, 13, 9), 20)], [], NY, ny(2026, 10, 13, 12), 3);
    expect(t.map((w) => [w.start, w.focusMinutes])).toEqual([
      ['2026-09-28', 40],
      ['2026-10-05', 0],
      ['2026-10-12', 20],
    ]);
  });
});

describe('course breakdown', () => {
  it('splits focus time by course, keeps unassigned time separate and last, and counts course tasks', () => {
    const recs = [record(ny(2026, 10, 13, 9), 30, { courseId: 'chem' }), record(ny(2026, 10, 13, 11), 50, { courseId: 'hist' }), record(ny(2026, 10, 13, 14), 90)];
    const tasks = [{ assignmentId: 'a1', courseId: 'chem', completedAt: ny(2026, 10, 13, 16) }];
    expect(courseBreakdown(recs, tasks, NY, '2026-10-12', '2026-10-18')).toEqual([
      { courseId: 'hist', focusMinutes: 50, sessionsCompleted: 1, tasksCompleted: 0 },
      { courseId: 'chem', focusMinutes: 30, sessionsCompleted: 1, tasksCompleted: 1 },
      { courseId: null, focusMinutes: 90, sessionsCompleted: 1, tasksCompleted: 0 },
    ]);
  });

  it('only counts time inside the range', () => {
    const rows = courseBreakdown([record(ny(2026, 10, 11, 23, 30), 60, { courseId: 'chem' })], [], NY, '2026-10-12', '2026-10-18');
    expect(rows).toEqual([{ courseId: 'chem', focusMinutes: 30, sessionsCompleted: 1, tasksCompleted: 0 }]);
  });
});

describe('stats snapshot', () => {
  const now = ny(2026, 10, 15, 20);

  it('summarises today, this week and consistency from records only', () => {
    const recs = [record(ny(2026, 10, 15, 9), 25), record(ny(2026, 10, 13, 9), 40), record(ny(2026, 10, 9, 9), 30), record(ny(2026, 10, 15, 10), 5, { status: 'endedEarly' })];
    const s = buildStatsSnapshot(recs, [], { sessionsCompleted: 3 }, NY, now);
    expect(s.today).toMatchObject({ focusMinutes: 30, sessionsCompleted: 1, sessionsEndedEarly: 1 });
    expect(s.week).toMatchObject({ start: '2026-10-12', focusMinutes: 70, sessionsCompleted: 2, daysStudied: 2 });
    expect(s.consistency).toEqual({ daysStudied: 3, windowDays: 7 });
    expect(s.totals).toEqual({ focusMinutes: 100, sessionsCompleted: 3, sessionsEndedEarly: 1, tasksCompleted: 0 });
    expect(s.hasOlderUntrackedHistory).toBe(false);
  });

  it('missed days only lower "days studied"; nothing resets or goes negative', () => {
    const s = buildStatsSnapshot([record(ny(2026, 10, 1, 9), 30)], [], null, NY, now);
    expect(s.consistency.daysStudied).toBe(0);
    expect(s.totals.focusMinutes).toBe(30);
  });

  it('flags older history that the game counted but did not keep in detail', () => {
    expect(buildStatsSnapshot([record(ny(2026, 10, 13, 9), 25)], [], { sessionsCompleted: 60 }, NY, now).hasOlderUntrackedHistory).toBe(true);
  });

  it('is empty, not invented, with no records', () => {
    const s = buildStatsSnapshot([], [], null, NY, now);
    expect(s.week.focusMinutes).toBe(0);
    expect(s.courses).toEqual([]);
    expect(s.recordsSince).toBeNull();
  });
});
