/** `mm:ss`, or `h:mm:ss` past an hour. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
  return h ? `${h}:${mmss}` : mmss;
}

/** `1 coin`, `3 coins`. */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function pickRandom<T>(items: readonly T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Local wall-clock time in 12-hour format, e.g. "10:45 PM", "12:35 AM".
 * Midnight is 12 AM and noon is 12 PM (never "0:xx"). Built from a timestamp,
 * so times past midnight roll over naturally.
 */
export function formatClockTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hours24 = d.getHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const period = hours24 < 12 ? 'AM' : 'PM';
  return `${hours12}:${String(d.getMinutes()).padStart(2, '0')} ${period}`;
}

/** 12-hour label for minutes after local midnight: 960 → "4 PM", 390 → "6:30 AM", 0 → "12 AM". */
export function formatMinuteOfDay(minute: number): string {
  const h24 = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`;
}
