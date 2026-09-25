import type { DateKey, Timestamp } from '../models';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Local calendar day for a timestamp, as `YYYY-MM-DD`. */
export function toDateKey(timestamp: Timestamp): DateKey {
  const d = new Date(timestamp);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function dateKeyToUtcMidnight(key: DateKey): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Whole calendar days from `from` to `to` (positive when `to` is later). DST-safe. */
export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round((dateKeyToUtcMidnight(to) - dateKeyToUtcMidnight(from)) / MS_PER_DAY);
}

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
