import type { MissionRecurrence, MissionRewardLevel, MissionType, MissionWindow } from '@/core/models';

/**
 * Mission rewards are fixed tiers so every mission stays a *supplement* to
 * focus rewards (a 30-minute session pays ~10 coins / 75 XP). Balance tests
 * keep the biggest tier below one hour of focus.
 */
export const MISSION_REWARD_LEVELS: Record<MissionRewardLevel, { coins: number; xp: number; happiness: number }> = {
  small: { coins: 5, xp: 15, happiness: 2 },
  medium: { coins: 10, xp: 25, happiness: 3 },
  big: { coins: 15, xp: 40, happiness: 4 },
};

export const MISSION_LIMITS = {
  maxActiveMissions: 6,
  titleMaxLength: 32,
  descriptionMaxLength: 80,
  focusMinutes: { min: 5, max: 240, step: 5 },
  sessionCount: { min: 1, max: 6, step: 1 },
  scheduledFocus: { min: 5, max: 120, step: 5 },
  /** Days of mission progress kept (older occurrences are simply dropped). */
  progressRetentionDays: 14,
} as const;

/** Mission types Focusling can verify today. `avoidSurface` waits for native protection. */
export const AVAILABLE_MISSION_TYPES: readonly MissionType[] = ['focusMinutes', 'sessionCount', 'scheduledFocus'];

export const MISSION_TYPE_LABELS: Record<MissionType, string> = {
  focusMinutes: 'Focus minutes',
  sessionCount: 'Focus sessions',
  scheduledFocus: 'Focus at a set time',
  avoidSurface: 'Avoid a distraction',
};

const hour = (h: number) => h * 60;
const WEEKDAYS: MissionRecurrence = { kind: 'weekdays', days: [1, 2, 3, 4, 5] };

export interface MissionPreset {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  target: number;
  minSessionMinutes?: number;
  window?: MissionWindow;
  recurrence: MissionRecurrence;
  reward: MissionRewardLevel;
  /** False for presets that need native app protection, which isn't available yet. */
  available: boolean;
}

export const MISSION_PRESETS: readonly MissionPreset[] = [
  {
    id: 'homework-buddy',
    title: 'Homework Buddy',
    description: 'Complete 45 focus minutes today.',
    type: 'focusMinutes',
    target: 45,
    recurrence: { kind: 'daily' },
    reward: 'medium',
    available: true,
  },
  {
    id: 'morning-start',
    title: 'Morning Start',
    description: 'A 15-minute focus session between 6 and 9 AM.',
    type: 'scheduledFocus',
    target: 15,
    window: { startMinute: hour(6), endMinute: hour(9) },
    recurrence: WEEKDAYS,
    reward: 'small',
    available: true,
  },
  {
    id: 'after-school-focus',
    title: 'After-School Focus',
    description: 'A 30-minute focus session between 4 and 7 PM.',
    type: 'scheduledFocus',
    target: 30,
    window: { startMinute: hour(16), endMinute: hour(19) },
    recurrence: WEEKDAYS,
    reward: 'medium',
    available: true,
  },
  {
    id: 'dinner-time',
    title: 'Dinner Time',
    description: 'Phones down for dinner: a 30-minute session between 6 and 8 PM.',
    type: 'scheduledFocus',
    target: 30,
    window: { startMinute: hour(18), endMinute: hour(20) },
    recurrence: { kind: 'daily' },
    reward: 'small',
    available: true,
  },
  {
    id: 'deep-focus',
    title: 'Deep Focus',
    description: 'Complete one 60-minute focus session.',
    type: 'sessionCount',
    target: 1,
    minSessionMinutes: 60,
    recurrence: { kind: 'daily' },
    reward: 'big',
    available: true,
  },
  {
    id: 'wind-down',
    title: 'Wind Down',
    description: 'No short videos after 9 PM. Needs app protection, which is coming later.',
    type: 'avoidSurface',
    target: 1,
    window: { startMinute: hour(21), endMinute: hour(23) },
    recurrence: { kind: 'daily' },
    reward: 'small',
    available: false,
  },
];

export function getMissionPreset(id: string): MissionPreset | undefined {
  return MISSION_PRESETS.find((p) => p.id === id);
}
