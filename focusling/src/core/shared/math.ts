export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Round to one decimal place: keeps stats tidy without losing small gains. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
