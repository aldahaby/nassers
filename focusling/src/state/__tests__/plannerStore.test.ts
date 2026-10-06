import { CLEAN_TEXT, REVISED } from '@/core/planner/fixtures/syllabi';
import { fromWallClock } from '@/core/planner/time';
import { adoptPet, createNewSave, migrateSave, setRoomColor, type GameSave } from '@/core';
import { MemorySaveRepository } from '@/services/persistence/MemorySaveRepository';
import { MockProtectionService } from '@/services/protection/MockProtectionService';
import { MockNotificationService } from '@/services/notifications/MockNotificationService';
import { MemoryPlannerRepository } from '@/services/planner/PlannerRepository';
import { MockStudyWidgetBridge } from '@/services/widgets/StudyWidgetBridge';
import type { DocumentService } from '@/services/documents/DocumentService';
import { createGameStore } from '../createGameStore';
import { createPlannerStore } from '../createPlannerStore';

const TZ = 'America/New_York';
const flush = () => new Promise((r) => setTimeout(r, 0));
const docs: DocumentService = { kind: 'web', canReadPdf: false, pick: async () => null, extract: async () => ({ ok: false, error: 'unsupported' }) };

async function setup(opts: { saveRepo?: MemorySaveRepository; plannerRepo?: MemoryPlannerRepository; clock?: { t: number }; notifications?: MockNotificationService; protection?: MockProtectionService } = {}) {
  const clock = opts.clock ?? { t: fromWallClock({ year: 2026, month: 10, day: 12, hour: 9, minute: 0 }, TZ) };
  const saveRepo = opts.saveRepo ?? new MemorySaveRepository();
  const plannerRepo = opts.plannerRepo ?? new MemoryPlannerRepository();
  const protection = opts.protection ?? new MockProtectionService({ now: () => clock.t });
  const notifications = opts.notifications ?? new MockNotificationService();
  const widgets = new MockStudyWidgetBridge();
  const game = createGameStore({ saveRepository: saveRepo, protection, now: () => clock.t });
  await game.getState().hydrate();
  if (!game.getState().save?.pet) game.getState().adoptPet('cloudling', 'Nimbus');
  const planner = createPlannerStore({ repository: plannerRepo, notifications, documents: docs, widgets, game, now: () => clock.t, timezone: () => TZ });
  await planner.getState().hydrate();
  return { clock, game, planner, saveRepo, plannerRepo, protection, notifications, widgets };
}

/** Import the clean syllabus, add an estimate for the reading, plan and accept. */
async function plannedReading(ctx: Awaited<ReturnType<typeof setup>>) {
  const p = ctx.planner.getState();
  p.importText(CLEAN_TEXT.text, 'pdf', { filename: 'chem.pdf' });
  ctx.planner.getState().commitDraft(false);
  const reading = Object.values(ctx.planner.getState().planner!.assignments).find((a) => a.title === 'Read Chapter 7')!;
  ctx.planner.getState().updateAssignment(reading.id, { estimatedMinutes: 45 });
  ctx.planner.getState().proposePlans([reading.id]);
  ctx.planner.getState().acceptAllProposed();
  await flush();
  const plan = Object.values(ctx.planner.getState().planner!.plans).find((x) => x.assignmentId === reading.id && x.status === 'accepted')!;
  return { reading, plan };
}

describe('planner store: Start & Lock through the existing focus session', () => {
  it('starting a plan starts the one focus timer with study context; mock protection is reported as simulated, never "activated"', async () => {
    const ctx = await setup();
    await ctx.protection.requestAuthorization();
    await ctx.protection.selectApps();
    ctx.game.getState().updateProtection({ mode: 'wholeApp' });
    const { plan } = await plannedReading(ctx);
    ctx.clock.t = plan.plannedStartAt;
    const r = await ctx.planner.getState().startPlan(plan.id, 'planner');
    expect(r).toEqual({ ok: true, value: { planId: plan.id, protection: 'simulated', error: null } });
    const active = ctx.game.getState().save!.focus.active!;
    expect(active.plannedDurationMinutes).toBe(plan.plannedMinutes);
    expect(active.study).toMatchObject({ sessionPlanId: plan.id, startSource: 'planner', protectionRequested: true, protectionResult: 'simulated', protectionMode: 'wholeApp' });
    expect(ctx.planner.getState().planner!.events.map((e) => e.type)).toEqual(expect.arrayContaining(['sessionStarted', 'protectionRequested', 'protectionActivated']));
  });

  it('protection failure: the session still starts, unprotected, and says so', async () => {
    const ctx = await setup();
    ctx.game.getState().updateProtection({ mode: 'wholeApp' }); // never authorised
    const { plan } = await plannedReading(ctx);
    ctx.clock.t = plan.plannedStartAt;
    const r = await ctx.planner.getState().startPlan(plan.id, 'notification');
    expect(r.ok && r.value.protection).toBe('failed');
    expect(r.ok && r.value.error).toBe('screen-time-not-authorized');
    const active = ctx.game.getState().save!.focus.active!;
    expect(active.protectionMode).toBe('none');
    expect(active.study).toMatchObject({ protectionRequested: true, protectionResult: 'failed', startSource: 'notification', independentStart: false });
    expect(ctx.planner.getState().startNotice?.protection).toBe('failed');
    // The plain Focus screen keeps its old behaviour: no unprotected start without asking.
    ctx.game.getState().endFocus('abandoned');
    expect((await ctx.game.getState().startFocus(30)).ok).toBe(false);
  });

  it('completing records a StudySession, completes the plan, offers retrieval, and updates assignment history', async () => {
    const ctx = await setup();
    const { plan, reading } = await plannedReading(ctx);
    ctx.clock.t = plan.plannedStartAt - 5 * 60_000;
    await ctx.planner.getState().startPlan(plan.id, 'planner');
    ctx.clock.t += plan.plannedMinutes * 60_000;
    ctx.game.getState().endFocus('completed');
    await flush();
    const s = ctx.planner.getState().planner!;
    const rec = Object.values(s.studySessions)[0]!;
    expect(rec).toMatchObject({ outcome: 'completed', assignmentId: reading.id, independentStart: true, startContext: 'plannerOrApp', retrievalOffered: true, protectionActivated: false });
    expect(s.plans[plan.id]!.status).toBe('completed');
    expect(s.pendingRetrieval?.studySessionId).toBe(rec.id);
    ctx.planner.getState().completeRetrieval({ kind: 'brainDump', notes: 'equilibrium', result: 'got' });
    expect(Object.values(ctx.planner.getState().planner!.retrievalItems)[0]).toMatchObject({ lastResult: 'got', assignmentId: reading.id });
  });

  it('ending early records endedEarly; the Live Activity starts and ends with the session', async () => {
    const ctx = await setup();
    const { plan } = await plannedReading(ctx);
    ctx.clock.t = plan.plannedStartAt;
    await ctx.planner.getState().startPlan(plan.id, 'widget');
    await flush();
    expect(ctx.widgets.activity).toMatchObject({ title: 'Studyling', subtitle: `Study session · ${plan.plannedMinutes} min`, protection: 'off' });
    ctx.clock.t += 10 * 60_000;
    ctx.game.getState().endFocus('abandoned');
    await flush();
    expect(Object.values(ctx.planner.getState().planner!.studySessions)[0]).toMatchObject({ outcome: 'endedEarly', startSource: 'widget' });
    expect(ctx.widgets.activity).toBeNull();
  });
});

describe('planner store: reminders', () => {
  it('permission is requested only when reminders are enabled; denial keeps the planner working', async () => {
    const notifications = new MockNotificationService();
    notifications.nextAnswer = 'denied';
    const ctx = await setup({ notifications });
    expect(notifications.permission).toBe('undetermined');
    const { plan } = await plannedReading(ctx);
    expect(await ctx.planner.getState().enableReminders()).toBe('denied');
    await flush();
    expect(ctx.planner.getState().planner!.preferences).toMatchObject({ remindersEnabled: false, notificationPermission: 'denied' });
    expect(notifications.pending.size).toBe(0);
    expect(ctx.planner.getState().planner!.plans[plan.id]!.status).toBe('accepted');
  });

  it('accepting plans schedules start cues; a reminder never fires during an active session; Start & Lock from the notification', async () => {
    const ctx = await setup();
    await ctx.planner.getState().enableReminders();
    const { plan } = await plannedReading(ctx);
    ctx.clock.t = plan.plannedStartAt - 2 * 3_600_000; // inside the rolling reminder horizon
    await ctx.planner.getState().syncReminders();
    const cue = [...ctx.notifications.pending.values()].find((n) => n.data.planId === plan.id)!;
    expect(cue).toMatchObject({ categoryId: 'studyling.start', title: 'A study block is ready' });
    // Deliver at its time and tap Start & Lock.
    ctx.clock.t = cue.fireAt;
    expect(ctx.notifications.deliver(cue.osId, ctx.clock.t)).toBe(true);
    ctx.notifications.respond(cue.key, 'start');
    await flush();
    await flush();
    expect(ctx.game.getState().save!.focus.active?.study).toMatchObject({ startSource: 'notification', startContext: 'notificationAction', independentStart: false });
    expect(ctx.planner.getState().pendingNavigation).toEqual({ to: 'session' });
    // While studying, nothing new is pending inside the session and foreground banners are hidden.
    await ctx.planner.getState().syncReminders();
    const end = ctx.clock.t + plan.plannedMinutes * 60_000;
    expect([...ctx.notifications.pending.values()].every((n) => n.fireAt > end)).toBe(true);
  });

  it('a revised syllabus cancels the stale reminder and does not duplicate the assignment', async () => {
    const ctx = await setup({ clock: { t: fromWallClock({ year: 2026, month: 10, day: 19, hour: 9, minute: 0 }, TZ) } });
    await ctx.planner.getState().enableReminders();
    ctx.planner.getState().importText(CLEAN_TEXT.text, 'pdf');
    ctx.planner.getState().commitDraft(false);
    const ps3 = Object.values(ctx.planner.getState().planner!.assignments).find((a) => a.title === 'Problem Set 3')!;
    ctx.planner.getState().updateAssignment(ps3.id, { estimatedMinutes: 180 });
    ctx.planner.getState().proposePlans([ps3.id]);
    ctx.planner.getState().acceptAllProposed();
    await ctx.planner.getState().syncReminders();
    const beforeIds = [...ctx.notifications.pending.values()].map((n) => n.data.planId).filter(Boolean);
    expect(beforeIds.length).toBeGreaterThan(0);
    ctx.planner.getState().importText(REVISED.text, 'pdf');
    ctx.planner.getState().commitDraft(false);
    await flush();
    await ctx.planner.getState().syncReminders();
    const s = ctx.planner.getState().planner!;
    expect(Object.values(s.assignments).filter((a) => a.title === 'Problem Set 3' && !a.deletedAt)).toHaveLength(1);
    const cancelled = Object.values(s.plans).filter((p) => p.status === 'cancelled').map((p) => p.id);
    expect(cancelled.length).toBeGreaterThan(0);
    const pendingPlanIds = [...ctx.notifications.pending.values()].map((n) => n.data.planId);
    for (const id of cancelled) expect(pendingPlanIds).not.toContain(id);
    // At least one cancelled plan had a pending reminder, and it is gone.
    expect(cancelled.some((id) => beforeIds.includes(id))).toBe(true);
  });
});

describe('planner persistence and the existing save', () => {
  it('planner records and reminder state survive a reload; no duplicates are scheduled', async () => {
    const ctx = await setup();
    await ctx.planner.getState().enableReminders();
    await plannedReading(ctx);
    await ctx.planner.getState().syncReminders();
    await flush();
    const pendingBefore = ctx.notifications.pending.size;
    const again = await setup({ saveRepo: ctx.saveRepo, plannerRepo: ctx.plannerRepo, clock: ctx.clock, notifications: ctx.notifications });
    await again.planner.getState().syncReminders();
    const s = again.planner.getState().planner!;
    expect(Object.values(s.assignments).length).toBe(9);
    expect(Object.values(s.plans).some((p) => p.status === 'accepted')).toBe(true);
    expect(Object.keys(s.scheduledReminders).length).toBe(pendingBefore);
    expect(ctx.notifications.pending.size).toBe(pendingBefore);
  });

  it('installing the planner leaves an existing save untouched (pet, XP, coins, cosmetics, room, sound, history, protection, Family data)', async () => {
    const T0 = fromWallClock({ year: 2026, month: 9, day: 1, hour: 9, minute: 0 }, TZ);
    let base: GameSave = adoptPet(createNewSave(T0), 'emberling', 'Pip', T0);
    base = setRoomColor(base, '#1E2447');
    base = {
      ...base,
      wallet: { coins: 321 },
      pet: { ...base.pet!, lifetimeXp: 777 },
      profile: { ...base.profile, settings: { ...base.profile.settings, soundEnabled: false } },
      protection: { ...base.protection, mode: 'wholeApp' },
      inventory: { items: { 'acc-cap': { itemId: 'acc-cap', quantity: 1, acquiredAt: T0, lastUsedAt: null } }, equipped: { head: 'acc-cap' } },
      focus: { active: null, history: [{ id: 'old-1', plannedDurationMinutes: 25, startedAt: T0, endedAt: T0 + 1_500_000, status: 'completed', blockedTargets: [], protectionMode: 'none', reward: null }] },
      mode: 'family',
      family: { child: { nickname: 'Sunny' } } as unknown as GameSave['family'],
    };
    const v7 = JSON.parse(JSON.stringify({ ...base, schemaVersion: 7 }));
    delete v7.room.theme;
    // Like the AsyncStorage repository, migrate on load.
    const saveRepo = new (class extends MemorySaveRepository {
      async load() {
        const raw = await super.load();
        return raw && migrateSave(JSON.parse(JSON.stringify(raw)));
      }
    })();
    await saveRepo.save(v7);
    const ctx = await setup({ saveRepo });
    const save = ctx.game.getState().save!;
    expect(save.schemaVersion).toBe(8);
    expect(save.pet).toMatchObject({ name: 'Pip', speciesId: 'emberling', lifetimeXp: 777 });
    expect(save.wallet.coins).toBe(321);
    expect(save.inventory.equipped).toEqual({ head: 'acc-cap' });
    expect(save.room).toEqual({ color: '#1E2447', theme: null });
    expect(save.profile.settings.soundEnabled).toBe(false);
    expect(save.focus.history[0]!.id).toBe('old-1');
    expect(save.protection.mode).toBe('wholeApp');
    expect(save.mode).toBe('family');
    expect(save.family).toMatchObject({ child: { nickname: 'Sunny' } });
    // The planner starts empty and old sessions are not back-filled or rewritten.
    const p = ctx.planner.getState().planner!;
    expect(Object.keys(p.courses)).toHaveLength(0);
    expect(Object.keys(p.studySessions)).toHaveLength(0);
    expect(JSON.stringify(save)).not.toMatch(/plannerSchemaVersion|assignments/);
  });
});
