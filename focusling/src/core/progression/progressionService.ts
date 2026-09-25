import { GROWTH_STAGES, LEVEL_CURVE, type GrowthStageDefinition } from '@/config/progression';
import type { GrowthStage, ProgressionState } from '../models';

/** XP needed to advance from `level` to `level + 1`. */
export function xpToAdvanceFrom(level: number): number {
  return LEVEL_CURVE.baseXp + LEVEL_CURVE.stepXp * (level - 1);
}

/** Total lifetime XP at which `level` is reached. Level 1 = 0. */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l += 1) total += xpToAdvanceFrom(l);
  return total;
}

export function getLevel(lifetimeXp: number): number {
  let level = 1;
  let threshold = xpToAdvanceFrom(1);
  let remaining = Math.max(0, lifetimeXp);
  while (level < LEVEL_CURVE.maxLevel && remaining >= threshold) {
    remaining -= threshold;
    level += 1;
    threshold = xpToAdvanceFrom(level);
  }
  return level;
}

export function getStageDefinition(lifetimeXp: number): GrowthStageDefinition {
  let current = GROWTH_STAGES[0]!;
  for (const def of GROWTH_STAGES) {
    if (lifetimeXp >= def.minXp) current = def;
  }
  return current;
}

export function getStageDefinitionById(stage: GrowthStage): GrowthStageDefinition {
  return GROWTH_STAGES.find((def) => def.stage === stage) ?? GROWTH_STAGES[0]!;
}

export function getProgression(lifetimeXp: number): ProgressionState {
  const xp = Math.max(0, Math.floor(lifetimeXp));
  const level = getLevel(xp);
  const atMax = level >= LEVEL_CURVE.maxLevel;
  const stageDef = getStageDefinition(xp);
  const stageIndex = GROWTH_STAGES.indexOf(stageDef);
  const nextStage = GROWTH_STAGES[stageIndex + 1];

  return {
    lifetimeXp: xp,
    level,
    xpIntoLevel: xp - totalXpForLevel(level),
    xpForNextLevel: atMax ? null : xpToAdvanceFrom(level),
    stage: stageDef.stage,
    nextStageAtXp: nextStage ? nextStage.minXp : null,
    stageProgress: nextStage ? (xp - stageDef.minXp) / (nextStage.minXp - stageDef.minXp) : 1,
  };
}

/** What changed when a pet went from `beforeXp` to `afterXp`. */
export function diffProgression(beforeXp: number, afterXp: number) {
  const before = getProgression(beforeXp);
  const after = getProgression(afterXp);
  return {
    leveledUpTo: after.level > before.level ? after.level : null,
    stageReached: after.stage !== before.stage ? after.stage : null,
  };
}
