import { getProgression } from '../progression/progressionService';
import { toDateKey } from '../shared/dates';
import { getEffectiveStreakDays } from '../streaks/streakService';
import type { Celebration, GameSave, Id, MissionCompletion, SessionReward, SessionSummary, Timestamp } from '../models';

/** A session counts as "finished while away" if it was resolved this long after its end time. */
export const AWAY_THRESHOLD_MS = 60_000;

/**
 * Pick the one celebration a session earns. A stage change outranks a plain
 * level-up (the stage screen shows the new level too), and reaching the final
 * stage is an evolution.
 */
export function pickCelebration(reward: SessionReward, xpBefore: number, xpAfter: number): Celebration | null {
  const before = getProgression(xpBefore);
  const after = getProgression(xpAfter);
  if (reward.stageReached) {
    const kind = after.stage === 'evolved' ? 'evolution' : 'growth';
    return { kind, from: before.stage, to: after.stage, level: after.level };
  }
  if (reward.leveledUpTo) return { kind: 'levelUp', level: reward.leveledUpTo };
  return null;
}

/** Level/stage changes across the whole session result, including mission XP. */
function withProgression(reward: SessionReward, xpBefore: number, xpAfter: number): SessionReward {
  const before = getProgression(xpBefore);
  const after = getProgression(xpAfter);
  return {
    ...reward,
    leveledUpTo: after.level > before.level ? after.level : null,
    stageReached: after.stage !== before.stage ? after.stage : null,
  };
}

export function summarizeSession(
  before: GameSave,
  after: GameSave,
  reward: SessionReward,
  endsAt: Timestamp,
  now: Timestamp,
  missionCompletions: MissionCompletion[] = [],
  style: { unlocked: Id[]; completedCollections: string[]; unlockedReactions: string[] } = { unlocked: [], completedCollections: [], unlockedReactions: [] },
): SessionSummary {
  const session = before.focus.active!;
  const xpBefore = before.pet?.lifetimeXp ?? 0;
  const xpAfter = after.pet?.lifetimeXp ?? 0;
  const today = toDateKey(now);
  return {
    sessionId: session.id,
    outcome: reward.outcome,
    plannedMinutes: session.plannedDurationMinutes,
    reward,
    coinsBefore: before.wallet.coins,
    coinsAfter: after.wallet.coins,
    xpBefore,
    xpAfter,
    dayStreakBefore: getEffectiveStreakDays(before.streak, today),
    dayStreakAfter: getEffectiveStreakDays(after.streak, today),
    sessionStreakAfter: after.streak.currentSessionStreak,
    celebration: pickCelebration(withProgression(reward, xpBefore, xpAfter), xpBefore, xpAfter),
    completedWhileAway: reward.outcome === 'completed' && now - endsAt >= AWAY_THRESHOLD_MS,
    missionCompletions,
    unlockedItems: style.unlocked,
    completedCollections: style.completedCollections,
    unlockedReactions: style.unlockedReactions,
  };
}
