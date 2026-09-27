import { GAME_REWARDS, MEMORY_GARDEN, PLAY_ECONOMY, TOY_TOSS } from '@/config/play';
import { hasCompletedMissionToday } from '../missions/missionService';
import { applyStatDelta } from '../pet/petCareService';
import { toDateKey } from '../shared/dates';
import type { GameId, GameRoundResult, GameSave, PlayStats, Timestamp } from '../models';

export function createPlayStats(): PlayStats {
  return { date: null, coinsEarned: 0, happinessEarned: 0, completions: {}, rewardedRounds: [], debugUnlockedDate: null };
}

/** Today's play stats; a new calendar day starts from zero (round IDs are kept for duplicate protection). */
export function playStatsFor(stats: PlayStats, now: Timestamp): PlayStats {
  const today = toDateKey(now);
  if (stats.date === today) return stats;
  return { ...createPlayStats(), date: today, rewardedRounds: stats.rewardedRounds, debugUnlockedDate: stats.debugUnlockedDate };
}

export function playCoinsRemaining(save: GameSave, now: Timestamp): number {
  return Math.max(0, PLAY_ECONOMY.dailyCoinCap - playStatsFor(save.play, now).coinsEarned);
}

/** Coins a finished round is worth before the daily cap. Finish-based, never speed-based. */
export function baseRoundCoins(gameId: GameId, score: number): number {
  if (gameId === 'memoryGarden') return MEMORY_GARDEN.coins;
  const catches = Math.max(0, Math.min(TOY_TOSS.tosses, Math.floor(score)));
  return TOY_TOSS.coinsByCatches[catches] ?? 0;
}

/**
 * Reward one *completed* round. Idempotent per `roundId`: a round can pay only once,
 * however many times this is called (double taps, reloads, view switches).
 * Games stay playable after the cap; they just stop paying coins.
 */
export function completeGameRound(
  save: GameSave,
  round: { gameId: GameId; roundId: string; score: number },
  now: Timestamp,
): { save: GameSave; result: GameRoundResult } {
  const today = playStatsFor(save.play, now);
  if (today.rewardedRounds.includes(round.roundId)) {
    return {
      save,
      result: { coins: 0, happiness: 0, capReached: today.coinsEarned >= PLAY_ECONOMY.dailyCoinCap, duplicate: true, locked: false },
    };
  }
  if (!getPlayAccess(save, now).open) {
    return {
      save,
      result: { coins: 0, happiness: 0, capReached: today.coinsEarned >= PLAY_ECONOMY.dailyCoinCap, duplicate: false, locked: true },
    };
  }
  const coins = Math.min(baseRoundCoins(round.gameId, round.score), Math.max(0, PLAY_ECONOMY.dailyCoinCap - today.coinsEarned));
  const happinessAllowance = Math.max(0, PLAY_ECONOMY.dailyHappinessCap - today.happinessEarned);
  const wantedHappiness = Math.min(GAME_REWARDS[round.gameId].happiness, happinessAllowance);

  let pet = save.pet;
  let happiness = 0;
  if (pet && wantedHappiness > 0) {
    const stats = applyStatDelta(pet.stats, { happiness: wantedHappiness });
    happiness = stats.happiness - pet.stats.happiness;
    pet = { ...pet, stats };
  }
  const play: PlayStats = {
    ...today,
    coinsEarned: today.coinsEarned + coins,
    happinessEarned: today.happinessEarned + wantedHappiness,
    completions: { ...today.completions, [round.gameId]: (today.completions[round.gameId] ?? 0) + 1 },
    rewardedRounds: [...today.rewardedRounds, round.roundId].slice(-PLAY_ECONOMY.rememberedRounds),
  };
  return {
    save: {
      ...save,
      pet,
      play,
      wallet: { coins: save.wallet.coins + coins },
      stats: { ...save.stats, lifetimeCoinsEarned: save.stats.lifetimeCoinsEarned + coins },
    },
    result: { coins, happiness, capReached: play.coinsEarned >= PLAY_ECONOMY.dailyCoinCap, duplicate: false, locked: false },
  };
}

export type PlayAccessState = { open: true } | { open: false; reason: 'finish-mission' };

/** Self mode: always open. Family mode: the parent's play setting decides. */
export function getPlayAccess(save: GameSave, now: Timestamp): PlayAccessState {
  if (save.mode !== 'family' || !save.family) return { open: true };
  if (save.family.play.access === 'always') return { open: true };
  if (hasCompletedMissionToday(save, now)) return { open: true };
  if (save.play.debugUnlockedDate === toDateKey(now)) return { open: true };
  return { open: false, reason: 'finish-mission' };
}

// ── Developer helpers ────────────────────────────────────────────────────────

/** Add coins as if earned from play today (counts toward the cap). */
export function debugGrantPlayCoins(save: GameSave, coins: number, now: Timestamp): GameSave {
  const today = playStatsFor(save.play, now);
  const granted = Math.min(coins, Math.max(0, PLAY_ECONOMY.dailyCoinCap - today.coinsEarned));
  return { ...save, wallet: { coins: save.wallet.coins + granted }, play: { ...today, coinsEarned: today.coinsEarned + granted } };
}

/** Leave exactly one play coin before today's cap (no coins are added to the wallet). */
export function debugPlayCapOneLeft(save: GameSave, now: Timestamp): GameSave {
  return { ...save, play: { ...playStatsFor(save.play, now), coinsEarned: PLAY_ECONOMY.dailyCoinCap - 1 } };
}

export function debugResetDailyPlay(save: GameSave, now: Timestamp): GameSave {
  const today = playStatsFor(save.play, now);
  return { ...save, play: { ...today, coinsEarned: 0, happinessEarned: 0, completions: {} } };
}

export function debugUnlockPlay(save: GameSave, now: Timestamp): GameSave {
  return { ...save, play: { ...save.play, debugUnlockedDate: toDateKey(now) } };
}
