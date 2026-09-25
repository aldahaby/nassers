/**
 * Game actions that span several services. Every function here is pure:
 * it takes a GameSave (plus `now`) and returns a new GameSave. The state store
 * calls these and persists the result; UI never mutates game state directly.
 */
import { FOCUS_CONFIG } from '@/config/focus';
import { PET_CARE } from '@/config/petCare';
import { calculateCoinXpReward, type RewardContext } from '../economy/economyService';
import {
  createFocusSession,
  getElapsedMinutes,
  getEndsAt,
  getProgressFraction,
  getRemainingMs,
  isSessionDue,
  type FocusError,
} from '../focus/focusSessionService';
import { getEquippedBonuses } from '../inventory/inventoryService';
import { applyDecay, applyStatDelta, petThePet, sessionStatDelta } from '../pet/petCareService';
import { diffProgression } from '../progression/progressionService';
import { toDateKey } from '../shared/dates';
import { createId } from '../shared/ids';
import { fail, ok, type Result } from '../shared/result';
import { getEffectiveStreakDays, recordSessionForStreak } from '../streaks/streakService';
import { emptyDailyStats, pruneDailyStats } from './dailyStats';
import { summarizeSession } from './sessionSummary';
import type {
  AbandonPreview,
  ActiveSessionProgress,
  BlockTarget,
  FocusOutcome,
  GameSave,
  PetSpeciesId,
  ProtectionMode,
  ProtectionSettings,
  RewardEstimate,
  SessionReward,
  SessionSummary,
  Timestamp,
} from '../models';

export function getRewardContext(save: GameSave, now: Timestamp): RewardContext {
  return {
    streakDays: getEffectiveStreakDays(save.streak, toDateKey(now)),
    itemBonus: getEquippedBonuses(save.inventory),
  };
}

/** What a session of `minutes` would pay if completed right now. */
export function estimateReward(save: GameSave, minutes: number, now: Timestamp): RewardEstimate {
  const reward = calculateCoinXpReward(minutes, minutes, 'completed', getRewardContext(save, now));
  const stats = sessionStatDelta(minutes, 'completed');
  return {
    coins: reward.coins,
    completionBonusCoins: reward.completionBonusCoins,
    xp: reward.xp,
    happinessDelta: stats.happiness,
    healthDelta: stats.health,
    bonusMultiplier: reward.bonusMultiplier,
  };
}

export function adoptPet(save: GameSave, speciesId: PetSpeciesId, name: string, now: Timestamp): GameSave {
  return {
    ...save,
    pet: {
      id: createId('pet'),
      name: name.trim(),
      speciesId,
      adoptedAt: now,
      stats: { ...PET_CARE.newPetStats },
      lifetimeXp: 0,
      statsUpdatedAt: now,
      lastPettedAt: null,
    },
    profile: { ...save.profile, onboardingCompletedAt: now },
  };
}

export function petPet(save: GameSave, now: Timestamp): { save: GameSave; happinessGained: number } {
  if (!save.pet) return { save, happinessGained: 0 };
  const result = petThePet(save.pet, now);
  return { save: { ...save, pet: result.pet }, happinessGained: result.happinessGained };
}

export function startSession(
  save: GameSave,
  minutes: number,
  targets: BlockTarget[],
  now: Timestamp,
  options: { protectionMode?: ProtectionMode; sessionId?: string } = {},
): Result<GameSave, FocusError> {
  if (!save.pet) return fail('no-pet');
  if (save.focus.active) return fail('session-already-active');
  const created = createFocusSession(minutes, targets, now, options.protectionMode ?? 'none');
  if (!created.ok) return created;
  const session = options.sessionId ? { ...created.value, id: options.sessionId } : created.value;
  return ok({ ...save, focus: { ...save.focus, active: session } });
}

/**
 * End the active session and pay out. For 'completed', the full planned time is
 * credited (used both when the timer runs out and by the debug "simulate success"
 * control). For 'abandoned', only the minutes actually elapsed count.
 */
export function endSession(
  save: GameSave,
  outcome: FocusOutcome,
  now: Timestamp,
): Result<{ save: GameSave; reward: SessionReward; summary: SessionSummary }, FocusError> {
  const session = save.focus.active;
  if (!session) return fail('no-active-session');
  if (!save.pet) return fail('no-pet');

  const focusedMinutes =
    outcome === 'completed' ? session.plannedDurationMinutes : getElapsedMinutes(session, now);
  const today = toDateKey(now);

  const coinXp = calculateCoinXpReward(
    focusedMinutes,
    session.plannedDurationMinutes,
    outcome,
    getRewardContext(save, now),
  );
  const statDelta = sessionStatDelta(focusedMinutes, outcome);
  const beforeXp = save.pet.lifetimeXp;
  const afterXp = beforeXp + coinXp.xp;
  const progressionChange = diffProgression(beforeXp, afterXp);

  const decayedPet = applyDecay(save.pet, now);
  const newStats = applyStatDelta(decayedPet.stats, statDelta);

  const reward: SessionReward = {
    outcome,
    focusedMinutes,
    coins: coinXp.coins,
    completionBonusCoins: coinXp.completionBonusCoins,
    xp: coinXp.xp,
    happinessDelta: newStats.happiness - decayedPet.stats.happiness,
    healthDelta: newStats.health - decayedPet.stats.health,
    bonusMultiplier: coinXp.bonusMultiplier,
    leveledUpTo: progressionChange.leveledUpTo,
    stageReached: progressionChange.stageReached,
  };

  const finished = { ...session, status: outcome, endedAt: now, reward };
  const completed = outcome === 'completed';
  const day = save.daily[today] ?? emptyDailyStats(today);

  const next: GameSave = {
    ...save,
    pet: { ...decayedPet, stats: newStats, lifetimeXp: afterXp },
    wallet: { coins: save.wallet.coins + reward.coins },
    focus: {
      active: null,
      history: [finished, ...save.focus.history].slice(0, FOCUS_CONFIG.historyLimit),
    },
    stats: {
      ...save.stats,
      sessionsCompleted: save.stats.sessionsCompleted + (completed ? 1 : 0),
      sessionsAbandoned: save.stats.sessionsAbandoned + (completed ? 0 : 1),
      totalFocusMinutes: save.stats.totalFocusMinutes + focusedMinutes,
      lifetimeCoinsEarned: save.stats.lifetimeCoinsEarned + reward.coins,
      longestSessionMinutes: completed
        ? Math.max(save.stats.longestSessionMinutes, focusedMinutes)
        : save.stats.longestSessionMinutes,
    },
    streak: recordSessionForStreak(save.streak, outcome, today),
    daily: pruneDailyStats(
      {
        ...save.daily,
        [today]: {
          ...day,
          focusMinutes: day.focusMinutes + focusedMinutes,
          sessionsCompleted: day.sessionsCompleted + (completed ? 1 : 0),
          sessionsAbandoned: day.sessionsAbandoned + (completed ? 0 : 1),
          coinsEarned: day.coinsEarned + reward.coins,
          xpEarned: day.xpEarned + reward.xp,
        },
      },
      today,
    ),
  };

  return ok({ save: next, reward, summary: summarizeSession(save, next, reward, getEndsAt(session), now) });
}

/** Live timer + projected rewards for the running session. */
export function getActiveSessionProgress(save: GameSave, now: Timestamp): ActiveSessionProgress | null {
  const session = save.focus.active;
  if (!session) return null;
  return {
    remainingMs: getRemainingMs(session, now),
    elapsedMinutes: getElapsedMinutes(session, now),
    progress: getProgressFraction(session, now),
    endsAt: getEndsAt(session),
    projected: estimateReward(save, session.plannedDurationMinutes, now),
  };
}

/** What the user keeps if they end the active session now (shown in the confirmation). */
export function previewAbandon(save: GameSave, now: Timestamp): AbandonPreview | null {
  const session = save.focus.active;
  if (!session) return null;
  const focusedMinutes = getElapsedMinutes(session, now);
  const reward = calculateCoinXpReward(
    focusedMinutes,
    session.plannedDurationMinutes,
    'abandoned',
    getRewardContext(save, now),
  );
  return { focusedMinutes, coins: reward.coins, xp: reward.xp };
}

/**
 * Bring a save up to date when the app opens or returns to the foreground:
 * apply passive decay and complete any session whose timer ran out meanwhile.
 */
export function refreshSave(
  save: GameSave,
  now: Timestamp,
): { save: GameSave; completedSummary: SessionSummary | null } {
  let current = save;
  let completedSummary: SessionSummary | null = null;

  if (current.focus.active && isSessionDue(current.focus.active, now)) {
    const result = endSession(current, 'completed', now);
    if (result.ok) {
      current = result.value.save;
      completedSummary = result.value.summary;
    }
  }
  if (current.pet) current = { ...current, pet: applyDecay(current.pet, now) };
  return { save: current, completedSummary };
}

/** Session length used for "about N more sessions" hints in the shop. */
export const AFFORD_HINT_SESSION_MINUTES = 30;

/**
 * Rough number of typical focus sessions still needed to afford an item
 * (0 when already affordable). Uses the same reward formula as a real session.
 */
export function estimateSessionsToAfford(save: GameSave, price: number, now: Timestamp): number {
  const short = price - save.wallet.coins;
  if (short <= 0) return 0;
  const perSession = estimateReward(save, AFFORD_HINT_SESSION_MINUTES, now).coins;
  return Math.ceil(short / Math.max(1, perSession));
}

export function updateProtectionSettings(save: GameSave, patch: Partial<ProtectionSettings>): GameSave {
  return { ...save, protection: { ...save.protection, ...patch } };
}
