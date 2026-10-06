import type { Timestamp } from '../models';

/**
 * Wall-clock ↔ instant conversion in an IANA time zone, using Intl only (no
 * Date.now). Handles DST: a wall time that doesn't exist (spring forward)
 * moves forward by the gap; an ambiguous one (fall back) takes the earlier.
 */
export interface WallClock {
  year: number;
  /** 1–12. */
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The wall clock (and weekday) at an instant in a zone. */
export function toWallClock(ts: Timestamp, timeZone: string): WallClock & { weekday: number } {
  const parts = formatter(timeZone).formatToParts(new Date(ts));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    weekday: WEEKDAYS[get('weekday')] ?? 0,
  };
}

function offsetAt(ts: Timestamp, timeZone: string): number {
  const w = toWallClock(ts, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  const truncated = ts - (((ts % 60_000) + 60_000) % 60_000);
  return asUtc - truncated;
}

/** The instant a wall clock time happens in a zone. */
export function fromWallClock(w: WallClock, timeZone: string): Timestamp {
  const guess = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  const first = guess - offsetAt(guess, timeZone);
  const second = guess - offsetAt(first, timeZone);
  if (first === second) return first;
  // DST edge: pick the candidate whose wall clock matches; otherwise (a gap) the later one.
  const matches = [first, second].filter((t) => {
    const c = toWallClock(t, timeZone);
    return c.hour === w.hour && c.minute === w.minute && c.day === w.day;
  });
  return matches.length ? Math.min(...matches) : Math.max(first, second);
}

/** `YYYY-MM-DD` for an instant in a zone. */
export function dayKeyIn(ts: Timestamp, timeZone: string): string {
  const w = toWallClock(ts, timeZone);
  return `${w.year}-${String(w.month).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`;
}

export function parseDayKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split('-').map(Number);
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 };
}

/** Calendar arithmetic on day keys (zone independent). */
export function addDays(key: string, days: number): string {
  const { year, month, day } = parseDayKey(key);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function weekdayOfKey(key: string): number {
  const { year, month, day } = parseDayKey(key);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Instant for minutes-after-midnight on a local day. */
export function atMinute(key: string, minuteOfDay: number, timeZone: string): Timestamp {
  const { year, month, day } = parseDayKey(key);
  return fromWallClock({ year, month, day, hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60 }, timeZone);
}

export function minuteOfDay(ts: Timestamp, timeZone: string): number {
  const w = toWallClock(ts, timeZone);
  return w.hour * 60 + w.minute;
}

/** True when minute-of-day `m` is inside a window that may wrap midnight. */
export function inWindow(m: number, window: { startMinute: number; endMinute: number }): boolean {
  const { startMinute: s, endMinute: e } = window;
  if (s === e) return false;
  return s < e ? m >= s && m < e : m >= s || m < e;
}
