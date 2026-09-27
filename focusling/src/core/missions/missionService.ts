import { FOCUS_CONFIG } from '@/config/focus';
import { AVAILABLE_MISSION_TYPES, MISSION_LIMITS, MISSION_REWARD_LEVELS, type MissionPreset } from '@/config/missions';
import { applyStatDelta } from '../pet/petCareService';
import { daysBetween, toDateKey } from '../shared/dates';
import { fail, ok, type Result } from '../shared/result';
import { emptyDailyStats } from '../game/dailyStats';
import type {
  FocusSession,
  GameSave,
  Mission,
  MissionCompletion,
  MissionProgress,
  MissionRecurrence,
  MissionRewardLevel,
  MissionState,
  MissionType,
  MissionView,
  MissionWindow,
  Timestamp,
} from '../models';

export function createMissionState(): MissionState {
  return { items: [], progress: {} };
}

// ── Scheduling ───────────────────────────────────────────────────────────────

export function isScheduledOn(recurrence: MissionRecurrence, at: Timestamp): boolean {
  return recurrence.kind !== 'weekdays' || recurrence.days.includes(new Date(at).getDay());
}

export function occurrenceFor(mission: Mission, at: Timestamp): 'once' | string {
  return mission.recurrence.kind === 'once' ? 'once' : toDateKey(at);
}

export const progressKey = (missionId: string, occurrence: string) => `${missionId}:${occurrence}`;

export function isMissionTypeAvailable(type: MissionType): boolean {
  return AVAILABLE_MISSION_TYPES.includes(type);
}

/** Number the progress bar counts up to. */
export function missionGoal(mission: Mission): number {
  switch (mission.type) {
    case 'focusMinutes':
    case 'sessionCount':
      return mission.target;
    case 'scheduledFocus':
    case 'avoidSurface':
      return 1;
  }
}

const minuteOfDay = (at: Timestamp) => {
  const d = new Date(at);
  return d.getHours() * 60 + d.getMinutes();
};

export function isWithinWindow(window: MissionWindow, startedAt: Timestamp, endedAt: Timestamp): boolean {
  if (toDateKey(startedAt) !== toDateKey(endedAt)) return false;
  return minuteOfDay(startedAt) >= window.startMinute && minuteOfDay(endedAt) <= window.endMinute;
}

/**
 * How much a finished session adds to a mission. Only *completed* sessions count:
 * focus missions reward successful focus. Native-protection missions never count yet.
 */
export function sessionContribution(mission: Mission, session: FocusSession): number {
  if (session.status !== 'completed' || !session.reward || session.endedAt === null) return 0;
  const minutes = session.reward.focusedMinutes;
  switch (mission.type) {
    case 'focusMinutes':
      return minutes;
    case 'sessionCount':
      return minutes >= (mission.minSessionMinutes ?? FOCUS_CONFIG.minCustomMinutes) ? 1 : 0;
    case 'scheduledFocus':
      return mission.window && minutes >= mission.target && isWithinWindow(mission.window, session.startedAt, session.endedAt) ? 1 : 0;
    case 'avoidSurface':
      return 0;
  }
}

// ── Rewards (exactly once per occurrence) ────────────────────────────────────

function grantMissionReward(save: GameSave, mission: Mission, now: Timestamp): GameSave {
  const today = toDateKey(now);
  const day = save.daily[today] ?? emptyDailyStats(today);
  const pet = save.pet
    ? {
        ...save.pet,
        lifetimeXp: save.pet.lifetimeXp + mission.rewardXp,
        stats: applyStatDelta(save.pet.stats, { happiness: mission.rewardHappiness }),
      }
    : save.pet;
  return {
    ...save,
    pet,
    wallet: { coins: save.wallet.coins + mission.rewardCoins },
    stats: { ...save.stats, lifetimeCoinsEarned: save.stats.lifetimeCoinsEarned + mission.rewardCoins },
    daily: {
      ...save.daily,
      [today]: {
        ...day,
        missionsCompleted: day.missionsCompleted + 1,
        missionCoinsEarned: day.missionCoinsEarned + mission.rewardCoins,
        xpEarned: day.xpEarned + mission.rewardXp,
      },
    },
  };
}

/** Set a mission occurrence's progress; completing it grants the reward once. */
function setProgress(
  save: GameSave,
  mission: Mission,
  occurrence: string,
  value: number,
  now: Timestamp,
): { save: GameSave; completion: MissionCompletion | null } {
  const key = progressKey(mission.id, occurrence);
  const existing = save.missions.progress[key];
  if (existing?.rewarded) return { save, completion: null };
  const goal = missionGoal(mission);
  const progress = Math.min(goal, Math.max(0, value));
  const done = progress >= goal;
  const entry: MissionProgress = {
    missionId: mission.id,
    occurrence,
    progress,
    completedAt: done ? now : null,
    rewarded: done,
  };
  let next: GameSave = { ...save, missions: { ...save.missions, progress: { ...save.missions.progress, [key]: entry } } };
  if (!done) return { save: next, completion: null };
  next = grantMissionReward(next, mission, now);
  return {
    save: next,
    completion: {
      missionId: mission.id,
      title: mission.title,
      coins: mission.rewardCoins,
      xp: mission.rewardXp,
      happiness: mission.rewardHappiness,
    },
  };
}

/** Apply a finished session to every active mission scheduled for the day it ended. */
export function applySessionToMissions(
  save: GameSave,
  session: FocusSession,
  now: Timestamp,
): { save: GameSave; completions: MissionCompletion[] } {
  let current = save;
  const completions: MissionCompletion[] = [];
  for (const mission of save.missions.items) {
    if (!mission.active || !isMissionTypeAvailable(mission.type) || !isScheduledOn(mission.recurrence, now)) continue;
    const add = sessionContribution(mission, session);
    if (add <= 0) continue;
    const occurrence = occurrenceFor(mission, now);
    const before = current.missions.progress[progressKey(mission.id, occurrence)]?.progress ?? 0;
    const result = setProgress(current, mission, occurrence, before + add, now);
    current = result.save;
    if (result.completion) completions.push(result.completion);
  }
  return { save: current, completions };
}

// ── Views ────────────────────────────────────────────────────────────────────

export function getMissionView(save: GameSave, mission: Mission, now: Timestamp): MissionView {
  const occurrence = occurrenceFor(mission, now);
  const entry = save.missions.progress[progressKey(mission.id, occurrence)];
  const target = missionGoal(mission);
  const progress = entry?.progress ?? 0;
  const completed = Boolean(entry?.rewarded);
  let status: MissionView['status'];
  if (!isMissionTypeAvailable(mission.type)) status = 'unavailable';
  else if (completed) status = 'complete';
  else if (!mission.active) status = 'inactive';
  else if (!isScheduledOn(mission.recurrence, now)) status = 'notToday';
  else status = 'active';
  return { mission, occurrence, progress, target, completed, status };
}

/** Missions for today: in progress first, then complete, then the rest. */
export function getMissionViews(save: GameSave, now: Timestamp): MissionView[] {
  const order: Record<MissionView['status'], number> = { active: 0, complete: 1, notToday: 2, inactive: 3, unavailable: 4 };
  return save.missions.items
    .map((m) => getMissionView(save, m, now))
    .sort((a, b) => order[a.status] - order[b.status]);
}

/** The mission to feature on the pet screen / dashboard. */
export function getCurrentMission(save: GameSave, now: Timestamp): MissionView | null {
  return getMissionViews(save, now).find((v) => v.status === 'active' || v.status === 'complete') ?? null;
}

/** True if any mission occurrence was completed today (unlocks mission-gated Play). */
export function hasCompletedMissionToday(save: GameSave, now: Timestamp): boolean {
  const today = toDateKey(now);
  return Object.values(save.missions.progress).some((p) => p.rewarded && p.completedAt !== null && toDateKey(p.completedAt) === today);
}

// ── Creating and editing ─────────────────────────────────────────────────────

export interface MissionDraft {
  title: string;
  description?: string;
  type: MissionType;
  target: number;
  minSessionMinutes?: number;
  window?: MissionWindow;
  recurrence: MissionRecurrence;
  reward: MissionRewardLevel;
  presetId?: string;
}

export type MissionError = 'title-required' | 'unavailable-type' | 'invalid-target' | 'invalid-window' | 'no-days' | 'too-many' | 'not-found';

export function validateMissionDraft(draft: MissionDraft): MissionError | null {
  if (!draft.title.trim()) return 'title-required';
  if (!isMissionTypeAvailable(draft.type)) return 'unavailable-type';
  const limits = MISSION_LIMITS[draft.type as 'focusMinutes' | 'sessionCount' | 'scheduledFocus'];
  if (!Number.isInteger(draft.target) || draft.target < limits.min || draft.target > limits.max) return 'invalid-target';
  if (draft.type === 'scheduledFocus') {
    const w = draft.window;
    if (!w || w.startMinute < 0 || w.endMinute > 24 * 60 || w.endMinute - w.startMinute < draft.target) return 'invalid-window';
  }
  if (draft.recurrence.kind === 'weekdays' && draft.recurrence.days.length === 0) return 'no-days';
  return null;
}

export function buildMission(draft: MissionDraft, id: string, now: Timestamp): Mission {
  const reward = MISSION_REWARD_LEVELS[draft.reward];
  return {
    id,
    title: draft.title.trim().slice(0, MISSION_LIMITS.titleMaxLength),
    description: draft.description?.trim().slice(0, MISSION_LIMITS.descriptionMaxLength) || undefined,
    type: draft.type,
    target: draft.target,
    minSessionMinutes: draft.type === 'sessionCount' ? draft.minSessionMinutes : undefined,
    window: draft.type === 'scheduledFocus' || draft.type === 'avoidSurface' ? draft.window : undefined,
    recurrence: draft.recurrence,
    rewardCoins: reward.coins,
    rewardXp: reward.xp,
    rewardHappiness: reward.happiness,
    active: true,
    createdAt: now,
    presetId: draft.presetId,
  };
}

export function draftFromPreset(preset: MissionPreset): MissionDraft {
  return {
    title: preset.title,
    description: preset.description,
    type: preset.type,
    target: preset.target,
    minSessionMinutes: preset.minSessionMinutes,
    window: preset.window,
    recurrence: preset.recurrence,
    reward: preset.reward,
    presetId: preset.id,
  };
}

/** Editable draft of an existing mission. */
export function draftFromMission(mission: Mission): MissionDraft {
  return {
    title: mission.title,
    description: mission.description,
    type: mission.type,
    target: mission.target,
    minSessionMinutes: mission.minSessionMinutes,
    window: mission.window,
    recurrence: mission.recurrence,
    reward: rewardLevelOf(mission),
    presetId: mission.presetId,
  };
}

export function rewardLevelOf(mission: Mission): MissionRewardLevel {
  const entry = (Object.entries(MISSION_REWARD_LEVELS) as [MissionRewardLevel, { coins: number }][]).find(
    ([, r]) => r.coins === mission.rewardCoins,
  );
  return entry?.[0] ?? 'medium';
}

export function addMission(save: GameSave, draft: MissionDraft, id: string, now: Timestamp): Result<GameSave, MissionError> {
  const error = validateMissionDraft(draft);
  if (error) return fail(error);
  if (save.missions.items.filter((m) => m.active).length >= MISSION_LIMITS.maxActiveMissions) return fail('too-many');
  return ok({ ...save, missions: { ...save.missions, items: [...save.missions.items, buildMission(draft, id, now)] } });
}

/**
 * Edit a mission. Progress already made today is kept; a completed occurrence
 * stays completed (its reward was already paid) even if the target changes.
 */
export function updateMission(save: GameSave, id: string, draft: MissionDraft): Result<GameSave, MissionError> {
  const existing = save.missions.items.find((m) => m.id === id);
  if (!existing) return fail('not-found');
  const error = validateMissionDraft(draft);
  if (error) return fail(error);
  const rebuilt = { ...buildMission(draft, id, existing.createdAt), active: existing.active };
  return ok({ ...save, missions: { ...save.missions, items: save.missions.items.map((m) => (m.id === id ? rebuilt : m)) } });
}

export function setMissionActive(save: GameSave, id: string, active: boolean): GameSave {
  return { ...save, missions: { ...save.missions, items: save.missions.items.map((m) => (m.id === id ? { ...m, active } : m)) } };
}

export function removeMission(save: GameSave, id: string): GameSave {
  const progress = Object.fromEntries(Object.entries(save.missions.progress).filter(([, p]) => p.missionId !== id));
  return { ...save, missions: { items: save.missions.items.filter((m) => m.id !== id), progress } };
}

/** Drop old daily occurrences. Missed missions simply expire: nothing is taken away. */
export function pruneMissionProgress(state: MissionState, now: Timestamp): MissionState {
  const today = toDateKey(now);
  const progress = Object.fromEntries(
    Object.entries(state.progress).filter(
      ([, p]) => p.occurrence === 'once' || daysBetween(p.occurrence, today) < MISSION_LIMITS.progressRetentionDays,
    ),
  );
  return { ...state, progress };
}

// ── Developer helpers ────────────────────────────────────────────────────────

/** Complete a mission's current occurrence through the normal reward path. */
export function debugCompleteMission(save: GameSave, id: string, now: Timestamp) {
  const mission = save.missions.items.find((m) => m.id === id);
  if (!mission) return { save, completion: null };
  return setProgress(save, mission, occurrenceFor(mission, now), missionGoal(mission), now);
}

/** Leave a mission one step from done (one minute / one session / zero for scheduled). */
export function debugMissionAlmostDone(save: GameSave, id: string, now: Timestamp): GameSave {
  const mission = save.missions.items.find((m) => m.id === id);
  if (!mission) return save;
  const goal = missionGoal(mission);
  return setProgress(save, mission, occurrenceFor(mission, now), Math.max(0, goal - 1), now).save;
}

/** Forget today's (dated) mission progress so it can be re-tested. */
export function debugResetTodaysMissions(save: GameSave, now: Timestamp): GameSave {
  const today = toDateKey(now);
  const progress = Object.fromEntries(Object.entries(save.missions.progress).filter(([, p]) => p.occurrence !== today));
  return { ...save, missions: { ...save.missions, progress } };
}
