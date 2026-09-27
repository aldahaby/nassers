import type { DateKey, Id, Timestamp } from './common';

/**
 * Mission types. The first three are verified entirely by Focusling sessions.
 * `avoidSurface` needs native app protection and is not available yet: it may be
 * shown as "coming soon" but never counts progress or completes.
 */
export type MissionType = 'focusMinutes' | 'sessionCount' | 'scheduledFocus' | 'avoidSurface';

/** Minutes after local midnight, e.g. 16:00 = 960. */
export interface MissionWindow {
  startMinute: number;
  endMinute: number;
}

export type MissionRecurrence =
  | { kind: 'once' }
  | { kind: 'daily' }
  /** 0 = Sunday … 6 = Saturday. */
  | { kind: 'weekdays'; days: number[] };

export type MissionRewardLevel = 'small' | 'medium' | 'big';

export interface Mission {
  id: Id;
  title: string;
  description?: string;
  type: MissionType;
  /**
   * focusMinutes: minutes of successful focus.
   * sessionCount: number of successful sessions.
   * scheduledFocus: minimum length (minutes) of one session inside the window.
   */
  target: number;
  /** sessionCount: sessions shorter than this don't count. */
  minSessionMinutes?: number;
  /** Required for scheduledFocus. */
  window?: MissionWindow;
  recurrence: MissionRecurrence;
  rewardCoins: number;
  rewardXp: number;
  rewardHappiness: number;
  active: boolean;
  createdAt: Timestamp;
  presetId?: string;
}

/** Progress for one occurrence of a mission ("once", or a specific day). */
export interface MissionProgress {
  missionId: Id;
  /** "once" for one-time missions, otherwise the DateKey of the day. */
  occurrence: 'once' | DateKey;
  progress: number;
  completedAt: Timestamp | null;
  /** Set together with completedAt; guarantees a single reward per occurrence. */
  rewarded: boolean;
}

export interface MissionState {
  items: Mission[];
  /** Keyed by `${missionId}:${occurrence}`. */
  progress: Record<string, MissionProgress>;
}

export interface MissionCompletion {
  missionId: Id;
  title: string;
  coins: number;
  xp: number;
  happiness: number;
}

/** Derived per-mission view for screens. */
export interface MissionView {
  mission: Mission;
  occurrence: 'once' | DateKey;
  progress: number;
  target: number;
  completed: boolean;
  status: 'active' | 'complete' | 'notToday' | 'unavailable' | 'inactive';
}
