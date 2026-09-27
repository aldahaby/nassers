import type { GameSave } from '../models';

/** Shift a YYYY-MM-DD key by whole days. */
export function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Developer Tools "simulate next day": moves every day-keyed record back one day,
 * so the app behaves as if today were tomorrow without touching the clock or any
 * rewards already earned.
 */
export function debugSimulateNextDay(save: GameSave): GameSave {
  const back = (k: string) => shiftDateKey(k, -1);
  const progress = Object.fromEntries(
    Object.values(save.missions.progress).map((p) => {
      const occurrence = p.occurrence === 'once' ? 'once' : back(p.occurrence);
      return [`${p.missionId}:${occurrence}`, { ...p, occurrence, completedAt: p.completedAt === null ? null : p.completedAt - 86_400_000 }];
    }),
  );
  const daily = Object.fromEntries(Object.values(save.daily).map((d) => [back(d.date), { ...d, date: back(d.date) }]));
  return {
    ...save,
    missions: { ...save.missions, progress },
    daily,
    play: {
      ...save.play,
      date: save.play.date ? back(save.play.date) : null,
      debugUnlockedDate: save.play.debugUnlockedDate ? back(save.play.debugUnlockedDate) : null,
    },
    streak: { ...save.streak, lastActiveDate: save.streak.lastActiveDate ? back(save.streak.lastActiveDate) : null },
  };
}
