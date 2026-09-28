import type { SoundId } from '@/config/sounds';
import type { SessionSummary } from '@/core';

export interface FocusSnapshot {
  activeId: string | null;
  summary: SessionSummary | null;
}

/**
 * Which focus cue a state change deserves (pure, tested): Focus Start when a
 * session begins, Focus Complete when a completed summary appears. An early
 * stop gets nothing.
 */
export function focusCue(prev: FocusSnapshot, next: FocusSnapshot): SoundId | null {
  if (next.activeId !== null && prev.activeId === null) return 'focus-start';
  if (next.summary && next.summary !== prev.summary && next.summary.outcome === 'completed') return 'focus-complete';
  return null;
}
