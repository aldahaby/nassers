import { getMissionPreset, MISSION_PRESETS, MISSION_REWARD_LEVELS } from '@/config/missions';
import { adoptPet, endSession, startSession } from '../game/gameEngine';
import { debugSimulateNextDay } from '../game/debugDay';
import {
  addMission,
  applySessionToMissions,
  debugCompleteMission,
  debugMissionAlmostDone,
  draftFromPreset,
  getMissionViews,
  hasCompletedMissionToday,
  removeMission,
  validateMissionDraft,
  type MissionDraft,
} from '../missions/missionService';
import { migrateSave } from '../save/migrations';
import { createNewSave } from '../save/createNewSave';
import { MINUTE_MS } from '../shared/dates';
import type { GameSave } from '../models';

/** Thursday 25 Sep 2026, 4 PM local. */
const THU_4PM = new Date(2026, 8, 25, 16, 0).getTime();

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

function withMission(draft: MissionDraft, at = THU_4PM): GameSave {
  const save = adoptPet(createNewSave(at), 'cloudling', 'Nimbus', at);
  return unwrap(addMission(save, draft, 'm1', at));
}

/** Run a real focus session through the game engine. */
function session(save: GameSave, minutes: number, startAt: number, outcome: 'completed' | 'abandoned' = 'completed', stopAfter = minutes) {
  const started = unwrap(startSession(save, minutes, [], startAt));
  return unwrap(endSession(started, outcome, startAt + stopAfter * MINUTE_MS));
}

const homework = draftFromPreset(getMissionPreset('homework-buddy')!);

describe('mission progress', () => {
  it('counts focus minutes from completed sessions and completes with one reward', () => {
    let save = withMission(homework);
    const coins0 = save.wallet.coins;
    let r = session(save, 30, THU_4PM);
    expect(getMissionViews(r.save, THU_4PM + 31 * MINUTE_MS)[0]).toMatchObject({ progress: 30, target: 45, completed: false });
    expect(r.summary.missionCompletions).toEqual([]);

    save = r.save;
    r = session(save, 15, THU_4PM + 40 * MINUTE_MS);
    expect(r.summary.missionCompletions).toEqual([{ missionId: 'm1', title: 'Homework Buddy', coins: 10, xp: 25, happiness: 3 }]);
    const sessionCoins = r.summary.reward.coins;
    expect(r.save.wallet.coins).toBe(save.wallet.coins + sessionCoins + 10);
    expect(r.save.wallet.coins).toBeGreaterThan(coins0);

    // Another session the same day: no second reward.
    const again = session(r.save, 15, THU_4PM + 60 * MINUTE_MS);
    expect(again.summary.missionCompletions).toEqual([]);
    expect(again.save.wallet.coins).toBe(r.save.wallet.coins + again.summary.reward.coins);
  });

  it('does not count abandoned sessions', () => {
    const r = session(withMission(homework), 60, THU_4PM, 'abandoned', 40);
    expect(getMissionViews(r.save, THU_4PM + 41 * MINUTE_MS)[0]!.progress).toBe(0);
  });

  it('counts sessions only at or above the minimum length', () => {
    const deep = draftFromPreset(getMissionPreset('deep-focus')!);
    let save = withMission(deep);
    save = session(save, 30, THU_4PM).save;
    expect(getMissionViews(save, THU_4PM + 31 * MINUTE_MS)[0]!.completed).toBe(false);
    const r = session(save, 60, THU_4PM + 40 * MINUTE_MS);
    expect(r.summary.missionCompletions).toHaveLength(1);
  });

  it('scheduled focus needs the whole session inside the window', () => {
    const afterSchool = draftFromPreset(getMissionPreset('after-school-focus')!);
    // Starts 3:45 PM (before 4 PM window): does not count.
    let save = withMission(afterSchool);
    const early = session(save, 30, new Date(2026, 8, 25, 15, 45).getTime());
    expect(early.summary.missionCompletions).toEqual([]);
    // 4:10–4:40 PM: counts.
    const inside = session(early.save, 30, new Date(2026, 8, 25, 16, 10).getTime());
    expect(inside.summary.missionCompletions).toHaveLength(1);
    // Too short a session doesn't count even inside the window.
    save = withMission(afterSchool);
    expect(session(save, 15, new Date(2026, 8, 25, 16, 10).getTime()).summary.missionCompletions).toEqual([]);
  });

  it('a session crossing midnight counts for the day it ended', () => {
    const at = new Date(2026, 8, 25, 23, 50).getTime();
    const save = withMission(homework, at);
    const r = session(save, 45, at); // ends 00:35 on Friday
    expect(r.summary.missionCompletions).toHaveLength(1);
    const friday = new Date(2026, 8, 26, 9, 0).getTime();
    expect(getMissionViews(r.save, friday)[0]).toMatchObject({ occurrence: '2026-09-26', completed: true });
    expect(getMissionViews(r.save, new Date(2026, 8, 25, 23, 55).getTime())[0]!.completed).toBe(false);
  });
});

describe('recurrence', () => {
  it('daily missions reset the next day; progress from yesterday does not carry over', () => {
    const r = session(withMission(homework), 45, THU_4PM);
    expect(getMissionViews(r.save, THU_4PM + 50 * MINUTE_MS)[0]!.completed).toBe(true);
    const nextDay = THU_4PM + 24 * 60 * MINUTE_MS;
    expect(getMissionViews(r.save, nextDay)[0]).toMatchObject({ completed: false, progress: 0, status: 'active' });
  });

  it('selected weekdays only apply on those days', () => {
    const morning = draftFromPreset(getMissionPreset('morning-start')!); // Mon–Fri
    const save = withMission(morning);
    const saturday = new Date(2026, 8, 27, 7, 0).getTime();
    expect(getMissionViews(save, saturday)[0]!.status).toBe('notToday');
    const sat = session(save, 15, saturday);
    expect(sat.summary.missionCompletions).toEqual([]);
    const monday = new Date(2026, 8, 28, 7, 0).getTime();
    expect(session(sat.save, 15, monday).summary.missionCompletions).toHaveLength(1);
  });

  it('one-time missions stay complete forever', () => {
    const once: MissionDraft = { ...homework, title: 'First Focus', recurrence: { kind: 'once' }, target: 15 };
    const r = session(withMission(once), 15, THU_4PM);
    expect(r.summary.missionCompletions).toHaveLength(1);
    const later = THU_4PM + 10 * 24 * 60 * MINUTE_MS;
    expect(getMissionViews(r.save, later)[0]).toMatchObject({ completed: true, status: 'complete' });
    expect(session(r.save, 15, later).summary.missionCompletions).toEqual([]);
  });

  it('missing a mission takes nothing away', () => {
    const save = withMission(homework);
    const nextWeek = debugSimulateNextDay(debugSimulateNextDay(save));
    expect(nextWeek.wallet).toEqual(save.wallet);
    expect(nextWeek.pet!.stats).toEqual(save.pet!.stats);
    expect(nextWeek.pet!.lifetimeXp).toBe(save.pet!.lifetimeXp);
  });
});

describe('reward safety', () => {
  it('a reloaded save cannot pay the same occurrence twice', () => {
    const r = session(withMission(homework), 45, THU_4PM);
    const reloaded = migrateSave(JSON.parse(JSON.stringify(r.save)));
    const finished = r.save.focus.history[0]!;
    const replay = applySessionToMissions(reloaded, finished, THU_4PM + 46 * MINUTE_MS);
    expect(replay.completions).toEqual([]);
    expect(replay.save.wallet.coins).toBe(r.save.wallet.coins);
  });

  it('developer complete uses the same once-only reward path', () => {
    const save = withMission(homework);
    const first = debugCompleteMission(save, 'm1', THU_4PM);
    expect(first.completion?.coins).toBe(10);
    expect(debugCompleteMission(first.save, 'm1', THU_4PM).completion).toBeNull();
    expect(hasCompletedMissionToday(first.save, THU_4PM)).toBe(true);
  });

  it('"almost done" leaves exactly one step', () => {
    const almost = debugMissionAlmostDone(withMission(homework), 'm1', THU_4PM);
    expect(getMissionViews(almost, THU_4PM)[0]).toMatchObject({ progress: 44, completed: false });
    expect(session(almost, 5, THU_4PM).summary.missionCompletions).toHaveLength(1);
  });

  it('mission XP counts toward level-up celebrations', () => {
    // A 15-min session alone pays 38 XP (level 1); with the 40 XP mission reward the pet reaches level 2 (50 XP).
    const save = withMission({ ...homework, target: 15, reward: 'big' });
    const r = session(save, 15, THU_4PM);
    expect(r.summary.xpAfter).toBe(38 + 40);
    expect(r.summary.celebration).toEqual({ kind: 'levelUp', level: 2 });
  });
});

describe('custom missions and validation', () => {
  it('validates drafts', () => {
    expect(validateMissionDraft({ ...homework, title: '  ' })).toBe('title-required');
    expect(validateMissionDraft({ ...homework, target: 3 })).toBe('invalid-target');
    expect(validateMissionDraft({ ...homework, type: 'avoidSurface' })).toBe('unavailable-type');
    expect(validateMissionDraft({ ...homework, recurrence: { kind: 'weekdays', days: [] } })).toBe('no-days');
    const scheduled = draftFromPreset(getMissionPreset('after-school-focus')!);
    expect(validateMissionDraft({ ...scheduled, window: { startMinute: 960, endMinute: 970 } })).toBe('invalid-window');
  });

  it('creates a custom mission with centrally configured rewards', () => {
    const custom: MissionDraft = { title: 'Reading time', type: 'sessionCount', target: 2, minSessionMinutes: 15, recurrence: { kind: 'daily' }, reward: 'small' };
    const save = withMission(custom);
    expect(save.missions.items[0]).toMatchObject({ title: 'Reading time', rewardCoins: MISSION_REWARD_LEVELS.small.coins, active: true });
    expect(removeMission(save, 'm1').missions.items).toEqual([]);
  });

  it('native-protection presets are clearly unavailable and never complete', () => {
    const windDown = MISSION_PRESETS.find((p) => p.id === 'wind-down')!;
    expect(windDown.available).toBe(false);
    expect(validateMissionDraft(draftFromPreset(windDown))).toBe('unavailable-type');
  });
});
