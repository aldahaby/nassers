import { TOY_TOSS } from '@/config/play';

export type CatchQuality = 'perfect' | 'good' | 'miss';

/**
 * Marker position for a constant-speed ping-pong across a 0–1 lane.
 * Speed never changes during a round.
 */
export function markerPosition(elapsedMs: number, crossSeconds: number = TOY_TOSS.markerCrossSeconds): number {
  const cross = crossSeconds * 1000;
  const phase = (elapsedMs % (cross * 2)) / cross;
  return phase <= 1 ? phase : 2 - phase;
}

/** The pet sits at the lane centre. */
export function judgeToss(markerX: number, petX = 0.5): CatchQuality {
  const d = Math.abs(markerX - petX);
  if (d <= TOY_TOSS.perfectWithin) return 'perfect';
  if (d <= TOY_TOSS.goodWithin) return 'good';
  return 'miss';
}

export function countCatches(results: readonly CatchQuality[]): number {
  return results.filter((r) => r !== 'miss').length;
}
