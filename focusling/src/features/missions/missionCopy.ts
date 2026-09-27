import { MISSION_TYPE_LABELS } from '@/config/missions';
import type { Mission, MissionRecurrence, MissionView, MissionWindow } from '@/core';
import { formatMinuteOfDay, plural } from '@/utils/format';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function formatWindow(window: MissionWindow): string {
  return `${formatMinuteOfDay(window.startMinute)}–${formatMinuteOfDay(window.endMinute)}`;
}

export function formatRecurrence(recurrence: MissionRecurrence): string {
  if (recurrence.kind === 'once') return 'One time';
  if (recurrence.kind === 'daily') return 'Every day';
  const days = [...recurrence.days].sort();
  if (days.join() === '1,2,3,4,5') return 'Weekdays';
  if (days.join() === '0,6') return 'Weekends';
  return days.map((d) => DAY_SHORT[d]).join(', ');
}

/** What the mission asks for, in plain words. */
export function describeGoal(mission: Mission): string {
  switch (mission.type) {
    case 'focusMinutes':
      return `${mission.target} focus minutes`;
    case 'sessionCount': {
      const sessions = plural(mission.target, 'focus session');
      return mission.minSessionMinutes ? `${sessions} of ${mission.minSessionMinutes}+ min` : sessions;
    }
    case 'scheduledFocus':
      return `A ${mission.target}-minute session${mission.window ? `, ${formatWindow(mission.window)}` : ''}`;
    case 'avoidSurface':
      return MISSION_TYPE_LABELS.avoidSurface;
  }
}

/** Progress line; always words, never colour alone. */
export function describeProgress(view: MissionView): string {
  const { mission, progress, target } = view;
  switch (view.status) {
    case 'complete':
      return 'Complete';
    case 'unavailable':
      return 'Needs app protection (coming later)';
    case 'inactive':
      return 'Paused';
    case 'notToday':
      return `Not scheduled today · ${formatRecurrence(mission.recurrence)}`;
    case 'active':
      if (mission.type === 'focusMinutes') return `${Math.min(progress, target)} of ${target} minutes`;
      if (mission.type === 'sessionCount') return `${Math.min(progress, target)} of ${plural(target, 'session')}`;
      return 'Not done yet';
  }
}

export function describeReward(mission: Mission): string {
  return `+${mission.rewardCoins} coins · +${mission.rewardXp} XP`;
}
