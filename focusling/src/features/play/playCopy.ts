import { PLAY_ECONOMY } from '@/config/play';
import type { GameRoundResult } from '@/core';

export function capReachedLine(petName: string): string {
  return `You've earned today's ${PLAY_ECONOMY.dailyCoinCap} play coins. You can still play with ${petName}.`;
}

export function lockedLine(petName: string): string {
  return `Finish today's mission to play with ${petName}.`;
}

/** The reward line on a round summary. Calm, and honest about the cap. */
export function rewardLine(result: GameRoundResult, petName: string): string {
  if (result.locked) return lockedLine(petName);
  const parts: string[] = [];
  if (result.coins > 0) parts.push(`+${result.coins} ${result.coins === 1 ? 'coin' : 'coins'}`);
  if (result.happiness > 0) parts.push(`+${result.happiness} happiness`);
  if (parts.length > 0) return parts.join('  ');
  return result.capReached ? capReachedLine(petName) : `${petName} had fun.`;
}
