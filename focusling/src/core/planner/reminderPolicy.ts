import { PLANNER_RULES, REMINDER_FADING_POLICY, REMINDER_RULES } from '@/config/planner';
import { sha256Hex } from '../shared/sha256';
import type { Id, PlannerState, ReminderExposure, ReminderPreference, ReminderRule, ScheduledReminder, SessionPlan, SupportLevel, SupportObservation, Timestamp, UserProgress } from '../models';
import { isActivePlan } from './plannerService';
import { logEvent, type IdGen } from './plannerState';
import { atMinute, dayKeyIn, inWindow, minuteOfDay } from './time';

const MIN = 60_000;

/**
 * Local reminder policy. Pure: given planner state and the clock it returns
 * the notifications that SHOULD be pending; the notification service diffs
 * that against what is pending. Rules:
 *  - only accepted plans for reviewed, open work (never raw imports);
 *  - a start cue per plan (Standard/Light), a digest only on busy days (Standard);
 *  - nothing during quiet hours or an active study session;
 *  - a rolling horizon, well under the OS pending limit; no per-assignment spam.
 */

export function effectiveSupport(progress: UserProgress, preference: ReminderPreference): SupportLevel {
  if (preference === 'always') return 'standard';
  if (preference === 'minimal') return 'light';
  return progress.supportLevel;
}

export interface DesiredReminder {
  key: string;
  kind: 'startCue' | 'digest';
  fireAt: Timestamp;
  planIds: Id[];
  title: string;
  body: string;
  /** Notification category with the "Start & Lock" action (start cues only). */
  categoryId?: 'studyling.start';
  sig: string;
}

export interface ReminderContext {
  /** End of the active study session, if one is running. */
  activeSessionUntil: Timestamp | null;
  /** Plans already studied (a session exists for them). */
  startedPlanIds?: ReadonlySet<Id>;
}

const fmtMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);

function courseLabel(state: PlannerState, p: SessionPlan): string {
  const c = state.courses[p.courseId];
  return c ? c.code ?? c.name : 'Study';
}

/** Lock-screen text for a start cue, honouring the privacy setting. */
export function startCueCopy(state: PlannerState, p: SessionPlan): { title: string; body: string } {
  if (state.preferences.lockScreenDetail === 'private') return { title: 'A study block is ready', body: `Study session · ${p.plannedMinutes} min` };
  const a = p.assignmentId ? state.assignments[p.assignmentId] : undefined;
  const c = state.courses[p.courseId];
  return { title: `${c?.name ?? 'Your study block'} is ready.`, body: `${a ? `${a.title} · ` : ''}${p.plannedMinutes} min` };
}

export function desiredReminders(state: PlannerState, now: Timestamp, ctx: ReminderContext): DesiredReminder[] {
  const prefs = state.preferences;
  if (!prefs.remindersEnabled || prefs.notificationPermission !== 'granted') return [];
  const level = effectiveSupport(state.progress, prefs.reminderPreference);
  if (level === 'ambient') return [];
  const tz = prefs.timezone;
  const horizon = now + REMINDER_RULES.horizonHours * 60 * MIN;
  const started = ctx.startedPlanIds ?? new Set(Object.values(state.studySessions).map((s) => s.sessionPlanId).filter(Boolean) as Id[]);
  const blocked = (t: Timestamp) => t <= now || t > horizon || inWindow(minuteOfDay(t, tz), prefs.quietHours) || (ctx.activeSessionUntil !== null && t <= ctx.activeSessionUntil);

  const eligible = Object.values(state.plans).filter((p) => {
    if (!isActivePlan(p) || started.has(p.id)) return false;
    const a = p.assignmentId ? state.assignments[p.assignmentId] : undefined;
    if (p.assignmentId && (!a || a.deletedAt || a.status !== 'open' || a.reviewState === 'needsReview')) return false;
    return p.plannedStartAt > now && p.plannedStartAt <= horizon + 24 * 60 * MIN;
  });

  const out: DesiredReminder[] = [];
  for (const p of eligible) {
    for (const lead of REMINDER_RULES.startCueLeadMinutes) {
      const fireAt = p.plannedStartAt - lead * MIN;
      if (blocked(fireAt)) continue;
      const { title, body } = startCueCopy(state, p);
      out.push({ key: `start:${p.id}:${p.plannedStartAt}:${lead}`, kind: 'startCue', fireAt, planIds: [p.id], title, body, categoryId: 'studyling.start', sig: sha256Hex(title + body).slice(0, 12) });
    }
  }

  if (level === 'standard') {
    const byDay = new Map<string, SessionPlan[]>();
    for (const p of eligible) byDay.set(dayKeyIn(p.plannedStartAt, tz), [...(byDay.get(dayKeyIn(p.plannedStartAt, tz)) ?? []), p]);
    for (const [day, plans] of byDay) {
      if (plans.length < REMINDER_RULES.digestMinPlans) continue;
      plans.sort((a, b) => a.plannedStartAt - b.plannedStartAt);
      const fireAt = Math.max(plans[0]!.plannedStartAt - REMINDER_RULES.digestLeadMinutes * MIN, atMinute(day, REMINDER_RULES.digestEarliestMinute, tz));
      if (blocked(fireAt) || fireAt >= plans[0]!.plannedStartAt) continue;
      const evening = minuteOfDay(plans[0]!.plannedStartAt, tz) >= 17 * 60;
      const title = `${evening ? 'Tonight' : 'Today'} with Studyling`;
      const total = plans.reduce((s, p) => s + p.plannedMinutes, 0);
      const body = prefs.lockScreenDetail === 'private' ? `${plans.length} study blocks · ${fmtMinutes(total)}` : plans.map((p) => `${courseLabel(state, p)} · ${fmtMinutes(p.plannedMinutes)}`).join('\n');
      out.push({ key: `digest:${day}`, kind: 'digest', fireAt, planIds: plans.map((p) => p.id), title, body, sig: sha256Hex(title + body).slice(0, 12) });
    }
  }
  return out.sort((a, b) => a.fireAt - b.fireAt).slice(0, REMINDER_RULES.maxPending);
}

export interface ReminderDiff {
  toCancel: ScheduledReminder[];
  toSchedule: DesiredReminder[];
}

/** What to cancel and what to schedule so pending notifications match `desired` (no duplicates). */
export function diffReminders(current: Record<string, ScheduledReminder>, desired: DesiredReminder[]): ReminderDiff {
  const want = new Map(desired.map((d) => [d.key, d]));
  const toCancel = Object.values(current).filter((c) => {
    const d = want.get(c.key);
    return !d || d.fireAt !== c.fireAt || d.sig !== c.sig;
  });
  const keep = new Set(Object.values(current).filter((c) => !toCancel.includes(c)).map((c) => c.key));
  return { toCancel, toSchedule: desired.filter((d) => !keep.has(d.key)) };
}

/** Record the outcome of applying a diff (OS ids come back from the notification service). */
export function applyReminderDiff(state: PlannerState, diff: ReminderDiff, scheduledIds: Record<string, string>, now: Timestamp, ids: IdGen): PlannerState {
  const scheduledReminders = { ...state.scheduledReminders };
  const exposures = { ...state.exposures };
  let next: PlannerState = { ...state, scheduledReminders, exposures };
  for (const c of diff.toCancel) {
    delete scheduledReminders[c.key];
    const e = exposures[c.exposureId];
    if (e && !e.presentedAt && c.fireAt > now) exposures[e.id] = { ...e, cancelledAt: now };
    next = logEvent(next, ids, now, 'reminderCancelled', { planId: c.planId, data: { kind: c.kind } });
  }
  for (const d of diff.toSchedule) {
    const osId = scheduledIds[d.key];
    if (!osId) continue;
    const exposure: ReminderExposure = { id: ids('exposure'), kind: d.kind, planIds: d.planIds, scheduledFor: d.fireAt, scheduledAt: now };
    exposures[exposure.id] = exposure;
    scheduledReminders[d.key] = { key: d.key, kind: d.kind, osId, fireAt: d.fireAt, planId: d.kind === 'startCue' ? d.planIds[0] : undefined, planIds: d.planIds, exposureId: exposure.id, sig: d.sig };
    next = logEvent(next, ids, now, 'reminderScheduled', { planId: d.kind === 'startCue' ? d.planIds[0] : undefined, data: { kind: d.kind, fireAtMs: d.fireAt } });
  }
  // Fired reminders leave the pending table (they're no longer pending at the OS).
  for (const r of Object.values(scheduledReminders)) if (r.fireAt <= now) delete scheduledReminders[r.key];
  return next;
}

/** The OS presented a notification (foreground delivery or the student tapped it). */
export function markPresented(state: PlannerState, key: string, now: Timestamp, ids: IdGen): PlannerState {
  const exposure = Object.values(state.exposures).find((e) => e.id === state.scheduledReminders[key]?.exposureId) ?? findExposureByKey(state, key);
  if (!exposure || exposure.presentedAt) return state;
  const next: PlannerState = { ...state, exposures: { ...state.exposures, [exposure.id]: { ...exposure, presentedAt: now } } };
  return logEvent(next, ids, now, 'reminderPresented', { planId: exposure.planIds[0], data: { kind: exposure.kind } });
}

function findExposureByKey(state: PlannerState, key: string): ReminderExposure | undefined {
  const planId = key.startsWith('start:') ? key.split(':')[1] : undefined;
  return Object.values(state.exposures)
    .filter((e) => e.kind === 'startCue' && planId && e.planIds.includes(planId) && !e.cancelledAt)
    .sort((a, b) => b.scheduledFor - a.scheduledFor)[0];
}

/** The start cue exposure for a plan that was (or is assumed to have been) delivered before `at`. */
export function deliveredStartCue(state: PlannerState, planId: Id, at: Timestamp): ReminderExposure | null {
  return (
    Object.values(state.exposures)
      .filter((e) => e.kind === 'startCue' && e.planIds.includes(planId) && !e.cancelledAt && (e.presentedAt ?? e.scheduledFor) <= at)
      .sort((a, b) => b.scheduledFor - a.scheduledFor)[0] ?? null
  );
}

/** Keeps one ReminderRule per active plan in step with the current policy (bookkeeping for later analysis). */
export function syncReminderRules(state: PlannerState, now: Timestamp, ids: IdGen): PlannerState {
  const level = effectiveSupport(state.progress, state.preferences.reminderPreference);
  const rules = { ...state.reminderRules };
  const plans = { ...state.plans };
  let changed = false;
  for (const p of Object.values(plans)) {
    if (!isActivePlan(p) || p.plannedStartAt < now) continue;
    const existing = p.reminderRuleId ? rules[p.reminderRuleId] : undefined;
    const rule: ReminderRule = {
      id: existing?.id ?? ids('rule'),
      targetType: 'sessionPlan',
      targetId: p.id,
      enabled: state.preferences.remindersEnabled && level !== 'ambient',
      supportLevel: level,
      leadTimes: [...REMINDER_RULES.startCueLeadMinutes],
      digestEligible: level === 'standard',
      quietWindow: state.preferences.quietHours,
      batchGroup: dayKeyIn(p.plannedStartAt, state.preferences.timezone),
      lastTriggeredAt: existing?.lastTriggeredAt,
      successCount: existing?.successCount ?? 0,
      missCount: existing?.missCount ?? 0,
      policyVersion: REMINDER_FADING_POLICY.version,
    };
    if (!existing || JSON.stringify(existing) !== JSON.stringify(rule)) {
      rules[rule.id] = rule;
      if (!existing) plans[p.id] = { ...p, reminderRuleId: rule.id };
      changed = true;
    }
  }
  return changed ? { ...state, reminderRules: rules, plans } : state;
}

// ── Reminder fading (EXPERIMENTAL) ──────────────────────────────────

/**
 * Turn plans whose outcome is now known into observations (each once):
 * a plan with a session is observed when the session starts; one without is
 * observed after the missed window. Skipped/cancelled plans aren't counted.
 */
export function collectObservations(state: PlannerState, now: Timestamp): PlannerState {
  const seen = new Set(state.progress.observedPlanIds);
  const sessionsByPlan = new Map(Object.values(state.studySessions).filter((s) => s.sessionPlanId).map((s) => [s.sessionPlanId!, s]));
  const fresh: SupportObservation[] = [];
  const rules = { ...state.reminderRules };
  for (const p of Object.values(state.plans).sort((a, b) => a.plannedStartAt - b.plannedStartAt)) {
    if (seen.has(p.id) || p.status === 'proposed' || p.status === 'cancelled' || p.status === 'skipped') continue;
    const s = sessionsByPlan.get(p.id);
    if (s) {
      fresh.push({ planId: p.id, plannedStartAt: p.plannedStartAt, started: true, onTime: s.actualStartAt <= p.plannedStartAt + REMINDER_FADING_POLICY.onTimeWindowMinutes * MIN, independent: s.independentStart });
    } else if (now > p.plannedStartAt + PLANNER_RULES.missedAfterMinutes * MIN && isActivePlan(p)) {
      fresh.push({ planId: p.id, plannedStartAt: p.plannedStartAt, started: false, onTime: false, independent: false });
    } else continue;
    const rule = p.reminderRuleId ? rules[p.reminderRuleId] : undefined;
    if (rule) rules[rule.id] = { ...rule, successCount: rule.successCount + (s ? 1 : 0), missCount: rule.missCount + (s ? 0 : 1) };
  }
  if (!fresh.length) return state;
  return {
    ...state,
    reminderRules: rules,
    progress: { ...state.progress, observedPlanIds: [...state.progress.observedPlanIds, ...fresh.map((f) => f.planId)].slice(-400), observations: [...state.progress.observations, ...fresh].slice(-60) },
  };
}

export interface SupportDecision {
  progress: UserProgress;
  changed: boolean;
}

/**
 * Deterministic fading rules (config REMINDER_FADING_POLICY):
 *  Standard → Light when, of the last 4 observed plans since the last change,
 *  ≥3 were started on time and ≥2 were started independently of the reminder.
 *  Light → Ambient after another 4 with ≥3 on time and ≥3 independent.
 *  Misses never escalate automatically: when ≥2 of the last 3 plans were
 *  missed on a lighter level, Studyling offers more help and waits for an answer.
 *  The student's preference overrides all of this.
 */
export function evaluateSupport(progress: UserProgress, preference: ReminderPreference, now: Timestamp): SupportDecision {
  const policy = REMINDER_FADING_POLICY;
  let p = progress;
  if (p.policyVersion !== policy.version) {
    // New rules: keep the level, start a fresh observation window under the new version.
    p = { ...p, policyVersion: policy.version, supportChangedAt: now, supportReason: `Reminder rules updated (${policy.version}).` };
  }
  if (preference !== 'adaptive') return { progress: p, changed: p !== progress };
  const since = p.observations.filter((o) => o.plannedStartAt >= p.supportChangedAt);

  const tryMove = (from: SupportLevel, to: SupportLevel, rule: { window: number; minOnTime: number; minIndependent: number }) => {
    if (p.supportLevel !== from || since.length < rule.window) return false;
    const recent = since.slice(-rule.window);
    const onTime = recent.filter((o) => o.started && o.onTime).length;
    const independent = recent.filter((o) => o.started && o.independent).length;
    if (onTime < rule.minOnTime || independent < rule.minIndependent) return false;
    p = {
      ...p,
      supportLevel: to,
      supportChangedAt: now,
      supportReason: `You started ${onTime} of your last ${rule.window} planned blocks on time, ${independent} before any reminder, so Studyling switched to ${to === 'light' ? 'Light' : 'Ambient'}.`,
      recoveryOffer: 'none',
    };
    return true;
  };
  if (!tryMove('standard', 'light', policy.toLight)) tryMove('light', 'ambient', policy.toAmbient);

  const lastFew = p.observations.slice(-policy.missWindow);
  const misses = lastFew.filter((o) => !o.started).length;
  const quiet = p.recoveryDismissedAt !== undefined && now - p.recoveryDismissedAt < policy.recoveryQuietDays * 24 * 60 * MIN;
  if (p.supportLevel !== 'standard' && lastFew.length >= policy.missWindow && misses >= policy.missesForRecoveryOffer && p.recoveryOffer === 'none' && !quiet) {
    p = { ...p, recoveryOffer: 'pending' };
  }
  return { progress: p, changed: p !== progress };
}

/** "Restore reminders" (more help) or "Keep it calm". */
export function answerRecoveryOffer(progress: UserProgress, answer: 'restore' | 'calm', now: Timestamp): UserProgress {
  if (answer === 'restore') return { ...progress, supportLevel: 'standard', supportChangedAt: now, supportReason: 'You asked for a little more help, so Standard reminders are back.', recoveryOffer: 'none' };
  return { ...progress, recoveryOffer: 'none', recoveryDismissedAt: now };
}

/** Observations + evaluation in one step, with a logged event on change. */
export function updateSupport(state: PlannerState, now: Timestamp, ids: IdGen): PlannerState {
  const observed = collectObservations(state, now);
  const decision = evaluateSupport(observed.progress, observed.preferences.reminderPreference, now);
  if (!decision.changed) return observed;
  const next: PlannerState = { ...observed, progress: decision.progress };
  return decision.progress.supportLevel !== observed.progress.supportLevel ? logEvent(next, ids, now, 'supportLevelChanged', { data: { from: observed.progress.supportLevel, to: decision.progress.supportLevel, policy: decision.progress.policyVersion } }) : next;
}
