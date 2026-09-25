import { PET_CARE } from '@/config/petCare';
import { clamp, round1 } from '../shared/math';
import { HOUR_MS, MINUTE_MS } from '../shared/dates';
import type { FocusOutcome, Pet, PetMood, PetStats, Timestamp } from '../models';

export interface StatDelta {
  health?: number;
  happiness?: number;
}

export function clampStat(value: number): number {
  return round1(clamp(value, PET_CARE.statMin, PET_CARE.statMax));
}

export function applyStatDelta(stats: PetStats, delta: StatDelta): PetStats {
  return {
    health: clampStat(stats.health + (delta.health ?? 0)),
    happiness: clampStat(stats.happiness + (delta.happiness ?? 0)),
  };
}

/** Care-stat change from a finished session. */
export function sessionStatDelta(focusedMinutes: number, outcome: FocusOutcome): Required<StatDelta> {
  if (outcome === 'abandoned') {
    return { health: 0, happiness: PET_CARE.abandon.happinessDelta };
  }
  const c = PET_CARE.completion;
  return {
    happiness: round1(Math.min(c.maxHappiness, focusedMinutes * c.happinessPerMinute)),
    health: round1(Math.min(c.maxHealth, focusedMinutes * c.healthPerMinute)),
  };
}

/**
 * Passive decay since `pet.statsUpdatedAt`. Decay stops at the configured floors
 * and never raises a stat that is already below its floor.
 */
export function applyDecay(pet: Pet, now: Timestamp): Pet {
  const hours = Math.max(0, now - pet.statsUpdatedAt) / HOUR_MS;
  if (hours <= 0) return pet;

  const { decay } = PET_CARE;
  const decayTo = (value: number, perHour: number, floor: number) =>
    value <= floor ? value : clampStat(Math.max(floor, value - perHour * hours));

  return {
    ...pet,
    stats: {
      happiness: decayTo(pet.stats.happiness, decay.happinessPerHour, decay.happinessFloor),
      health: decayTo(pet.stats.health, decay.healthPerHour, decay.healthFloor),
    },
    statsUpdatedAt: now,
  };
}

export function canPet(pet: Pet, now: Timestamp): boolean {
  if (pet.lastPettedAt === null) return true;
  return now - pet.lastPettedAt >= PET_CARE.petting.cooldownMinutes * MINUTE_MS;
}

/** Tapping the pet. Always reacts visually; only grants happiness off cooldown. */
export function petThePet(pet: Pet, now: Timestamp): { pet: Pet; happinessGained: number } {
  if (!canPet(pet, now)) return { pet, happinessGained: 0 };
  const stats = applyStatDelta(pet.stats, { happiness: PET_CARE.petting.happinessDelta });
  return {
    pet: { ...pet, stats, lastPettedAt: now },
    happinessGained: stats.happiness - pet.stats.happiness,
  };
}

export function getMood(stats: PetStats): PetMood {
  const t = PET_CARE.moodThresholds;
  if (stats.happiness >= t.joyful) return 'joyful';
  if (stats.happiness >= t.content) return 'content';
  if (stats.happiness >= t.sleepy) return 'sleepy';
  return 'lonely';
}
