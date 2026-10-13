import type { FocusSession, FocusSessionRecord, GrowthStage, StudyContext } from '../../models';

export const NY = 'America/New_York';

let n = 0;
/** A finished game FocusSession that credited `credited` minutes and ended `elapsed` minutes after it started. */
export function focus(start: number, credited: number, opts: { status?: 'completed' | 'abandoned' | 'active'; elapsed?: number; planned?: number; study?: Partial<StudyContext>; id?: string; stage?: GrowthStage | null } = {}): FocusSession {
  const status = opts.status ?? 'completed';
  const elapsed = opts.elapsed ?? credited;
  return {
    id: opts.id ?? `focus_${++n}`,
    plannedDurationMinutes: opts.planned ?? credited,
    startedAt: start,
    endedAt: status === 'active' ? null : start + elapsed * 60_000,
    status,
    blockedTargets: [],
    protectionMode: 'none',
    reward:
      status === 'active'
        ? null
        : { outcome: status, focusedMinutes: credited, coins: 1, completionBonusCoins: 0, xp: 1, happinessDelta: 0, healthDelta: 0, bonusMultiplier: 1, leveledUpTo: null, stageReached: opts.stage ?? null },
    study: opts.study ? { startSource: 'app', startContext: 'unscheduled', independentStart: true, protectionRequested: false, protectionResult: 'notRequested', ...opts.study } : undefined,
  };
}

export function record(start: number, minutes: number, extra: Partial<FocusSessionRecord> = {}): FocusSessionRecord {
  return {
    id: extra.id ?? `rec_${++n}`,
    startedAt: start,
    endedAt: start + minutes * 60_000,
    recordedMinutes: minutes,
    plannedMinutes: minutes,
    status: 'completed',
    fromPlan: false,
    source: 'focusHistory',
    ...extra,
  };
}
