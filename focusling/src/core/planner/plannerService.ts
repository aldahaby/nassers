import { PLAN_TYPE_FOR, PLANNER_RULES } from '@/config/planner';
import type { Assignment, AssignmentType, AvailabilityWindow, Course, Id, PlannerState, SessionPlan, Timestamp } from '../models';
import { logEvent, type IdGen } from './plannerState';
import { normalizeTitle } from './syllabusParser';
import { cancelPlansFor, dueAtFor, fingerprintOf } from './syllabusImport';
import { addDays, atMinute, dayKeyIn, toWallClock } from './time';

/** "HH:MM" at an instant in a zone. */
export function timeOfDay(ts: Timestamp, timezone: string): string {
  const w = toWallClock(ts, timezone);
  return `${String(w.hour).padStart(2, '0')}:${String(w.minute).padStart(2, '0')}`;
}

const MIN = 60_000;

// ── Manual entry ────────────────────────────────────────────────────

export interface CourseInput {
  name: string;
  code?: string;
  term?: string;
  color?: string;
  timezone: string;
}

export function addCourse(state: PlannerState, input: CourseInput, now: Timestamp, ids: IdGen): { state: PlannerState; courseId: Id } {
  const id = ids('course');
  const course: Course = { id, name: input.name.trim() || 'New course', code: input.code?.trim() || undefined, term: input.term?.trim() || undefined, color: input.color, timezone: input.timezone, sourceType: 'manual', active: true, createdAt: now, updatedAt: now };
  return { state: { ...state, courses: { ...state.courses, [id]: course } }, courseId: id };
}

export function updateCourse(state: PlannerState, id: Id, patch: Partial<CourseInput>, now: Timestamp): PlannerState {
  const c = state.courses[id];
  if (!c) return state;
  return { ...state, courses: { ...state.courses, [id]: { ...c, ...patch, updatedAt: now } } };
}

export interface AssignmentInput {
  courseId: Id;
  title: string;
  type: AssignmentType;
  dueDayKey?: string | null;
  dueTime?: string | null;
  estimatedMinutes?: number | null;
}

/** A student-typed assignment: every field is theirs (confirmed, user authority). */
export function addAssignment(state: PlannerState, input: AssignmentInput, now: Timestamp, ids: IdGen): { state: PlannerState; assignmentId: Id } {
  const course = state.courses[input.courseId];
  if (!course) return { state, assignmentId: '' };
  const id = ids('assignment');
  const { dueAt, dueDateOnly } = dueAtFor(input.dueDayKey ?? null, input.dueTime ?? null, course.timezone);
  const a: Assignment = {
    id,
    courseId: course.id,
    title: input.title.trim() || 'Untitled',
    type: input.type,
    dueAt: dueAt ?? undefined,
    dueDateOnly: dueAt ? dueDateOnly : undefined,
    estimatedMinutes: input.estimatedMinutes ?? undefined,
    status: 'open',
    reviewState: 'userEntered',
    fieldConfidence: { title: 'confirmed', type: 'confirmed', due: 'confirmed', ...(input.estimatedMinutes ? { estimate: 'confirmed' as const } : {}) },
    sourceFingerprint: fingerprintOf(normalizeTitle(course.code ?? course.name), normalizeTitle(input.title)),
    sourceAuthority: 'user',
    userOverrides: { title: true, type: true, due: true, estimate: true },
    createdAt: now,
    updatedAt: now,
  };
  return { state: { ...state, assignments: { ...state.assignments, [id]: a } }, assignmentId: id };
}

export interface AssignmentPatch {
  title?: string;
  type?: AssignmentType;
  dueDayKey?: string | null;
  dueTime?: string | null;
  estimatedMinutes?: number | null;
}

/**
 * A student edit. Each touched field becomes a user override (sources won't
 * overwrite it) and is confirmed. Giving a date to an item that needed review
 * makes it reviewed. A moved deadline cancels plans that now fall after it.
 */
export function updateAssignment(state: PlannerState, id: Id, patch: AssignmentPatch, now: Timestamp): { state: PlannerState; cancelledPlanIds: Id[] } {
  const a = state.assignments[id];
  if (!a) return { state, cancelledPlanIds: [] };
  const course = state.courses[a.courseId];
  const next: Assignment = { ...a, userOverrides: { ...a.userOverrides }, fieldConfidence: { ...a.fieldConfidence }, updatedAt: now };
  if (patch.title !== undefined) {
    next.title = patch.title.trim() || a.title;
    next.userOverrides.title = true;
    next.fieldConfidence.title = 'confirmed';
  }
  if (patch.type !== undefined) {
    next.type = patch.type;
    next.userOverrides.type = true;
    next.fieldConfidence.type = 'confirmed';
  }
  let dueChanged = false;
  if (patch.dueDayKey !== undefined || patch.dueTime !== undefined) {
    const currentDay = a.dueAt ? dayKeyIn(a.dueAt, course?.timezone ?? 'UTC') : null;
    const currentTime = a.dueAt && !a.dueDateOnly ? timeOfDay(a.dueAt, course?.timezone ?? 'UTC') : null;
    const day = patch.dueDayKey !== undefined ? patch.dueDayKey : currentDay;
    const time = patch.dueTime !== undefined ? patch.dueTime : currentTime;
    const { dueAt, dueDateOnly } = dueAtFor(day, time, course?.timezone ?? 'UTC');
    dueChanged = (dueAt ?? undefined) !== a.dueAt;
    next.dueAt = dueAt ?? undefined;
    next.dueDateOnly = dueAt ? dueDateOnly : undefined;
    next.userOverrides.due = true;
    next.fieldConfidence.due = dueAt ? 'confirmed' : 'needsReview';
    next.reviewReasons = undefined;
  }
  if (patch.estimatedMinutes !== undefined) {
    next.estimatedMinutes = patch.estimatedMinutes ?? undefined;
    next.userOverrides.estimate = true;
    next.fieldConfidence.estimate = 'confirmed';
  }
  if (next.reviewState === 'needsReview' && next.dueAt && next.fieldConfidence.due === 'confirmed') next.reviewState = 'reviewed';
  const plans = { ...state.plans };
  const s1: PlannerState = { ...state, plans, assignments: { ...state.assignments, [id]: next } };
  const cancelled = dueChanged ? cancelPlansFor(s1, id, next.dueAt ?? null, now) : [];
  return { state: s1, cancelledPlanIds: cancelled };
}

/** "Looks right" on a needs-review assignment that already has a date. */
export function confirmAssignment(state: PlannerState, id: Id, now: Timestamp): PlannerState {
  const a = state.assignments[id];
  if (!a || !a.dueAt) return state;
  const fieldConfidence = { ...a.fieldConfidence, title: 'confirmed' as const, type: 'confirmed' as const, due: 'confirmed' as const };
  return { ...state, assignments: { ...state.assignments, [id]: { ...a, fieldConfidence, reviewState: a.reviewState === 'needsReview' ? 'reviewed' : a.reviewState, reviewReasons: undefined, updatedAt: now } } };
}

export function completeAssignment(state: PlannerState, id: Id, now: Timestamp, ids: IdGen): PlannerState {
  const a = state.assignments[id];
  if (!a || a.status === 'completed') return state;
  let next: PlannerState = { ...state, plans: { ...state.plans }, assignments: { ...state.assignments, [id]: { ...a, status: 'completed', completedAt: now, updatedAt: now } } };
  for (const p of Object.values(next.plans)) {
    if (p.assignmentId === id && p.plannedStartAt > now && (p.status === 'accepted' || p.status === 'proposed' || p.status === 'rescheduled')) next.plans[p.id] = { ...p, status: 'cancelled', updatedAt: now };
  }
  next = logEvent(next, ids, now, 'assignmentCompleted', { courseId: a.courseId, assignmentId: id });
  return next;
}

export function reopenAssignment(state: PlannerState, id: Id, now: Timestamp): PlannerState {
  const a = state.assignments[id];
  if (!a) return state;
  return { ...state, assignments: { ...state.assignments, [id]: { ...a, status: 'open', completedAt: undefined, updatedAt: now } } };
}

export function deleteAssignment(state: PlannerState, id: Id, now: Timestamp): PlannerState {
  const a = state.assignments[id];
  if (!a) return state;
  const s1: PlannerState = { ...state, plans: { ...state.plans }, assignments: { ...state.assignments, [id]: { ...a, deletedAt: now, updatedAt: now } } };
  cancelPlansFor(s1, id, null, now);
  return s1;
}

// ── Queries ─────────────────────────────────────────────────────────

const ACTIVE_PLAN: ReadonlySet<SessionPlan['status']> = new Set(['accepted', 'rescheduled']);
export const isActivePlan = (p: SessionPlan) => ACTIVE_PLAN.has(p.status);

export function isMissed(p: SessionPlan, now: Timestamp): boolean {
  return isActivePlan(p) && now > p.plannedStartAt + PLANNER_RULES.missedAfterMinutes * MIN;
}

export function liveAssignments(state: PlannerState): Assignment[] {
  return Object.values(state.assignments).filter((a) => !a.deletedAt && state.courses[a.courseId]?.active !== false);
}

/** Can the planner schedule this assignment? (Reviewed date, open, not in conflict over its date.) */
export function isSchedulable(a: Assignment): boolean {
  return a.status === 'open' && !a.deletedAt && Boolean(a.dueAt) && a.reviewState !== 'needsReview' && !a.conflicts?.due;
}

export function assignmentProgress(state: PlannerState, id: Id, now: Timestamp) {
  const a = state.assignments[id];
  const sessions = Object.values(state.studySessions).filter((s) => s.assignmentId === id);
  const studiedMinutes = sessions.reduce((sum, s) => sum + s.actualFocusedMinutes, 0);
  const plans = Object.values(state.plans).filter((p) => p.assignmentId === id);
  const upcoming = plans.filter((p) => isActivePlan(p) && p.plannedStartAt + p.plannedMinutes * MIN > now).sort((x, y) => x.plannedStartAt - y.plannedStartAt);
  const plannedMinutes = upcoming.reduce((sum, p) => sum + p.plannedMinutes, 0);
  const remainingMinutes = a?.estimatedMinutes !== undefined ? Math.max(0, a.estimatedMinutes - studiedMinutes) : null;
  return {
    studiedMinutes,
    plannedMinutes,
    remainingMinutes,
    unplannedMinutes: remainingMinutes === null ? null : Math.max(0, remainingMinutes - plannedMinutes),
    upcomingPlans: upcoming,
    proposedPlans: plans.filter((p) => p.status === 'proposed').sort((x, y) => x.plannedStartAt - y.plannedStartAt),
    sessions: sessions.sort((x, y) => y.actualStartAt - x.actualStartAt),
  };
}

/** The next accepted plan that hasn't been studied and isn't long past. */
export function nextPlan(state: PlannerState, now: Timestamp): SessionPlan | null {
  return (
    Object.values(state.plans)
      .filter((p) => isActivePlan(p) && !isMissed(p, now) && p.plannedStartAt + p.plannedMinutes * MIN > now)
      .sort((a, b) => a.plannedStartAt - b.plannedStartAt)[0] ?? null
  );
}

export function plansOnDay(state: PlannerState, dayKey: string, timezone: string): SessionPlan[] {
  return Object.values(state.plans)
    .filter((p) => (isActivePlan(p) || p.status === 'completed' || p.status === 'proposed') && dayKeyIn(p.plannedStartAt, timezone) === dayKey)
    .sort((a, b) => a.plannedStartAt - b.plannedStartAt);
}

export function upcomingAssignments(state: PlannerState, now: Timestamp, days = 14): Assignment[] {
  const until = now + days * 24 * 60 * MIN;
  return liveAssignments(state)
    .filter((a) => a.status === 'open' && (!a.dueAt || (a.dueAt >= now - 12 * 60 * MIN && a.dueAt <= until)))
    .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
}

// ── Plan generation ─────────────────────────────────────────────────

interface Interval {
  start: Timestamp;
  end: Timestamp;
}

export interface CapacityWarning {
  assignmentId: Id;
  neededMinutes: number;
  fitsMinutes: number;
  dueAt: Timestamp;
}

export type SkipReason = 'noDueDate' | 'noEstimate' | 'needsReview' | 'pastDue' | 'nothingLeft' | 'completed';

export interface ProposeResult {
  state: PlannerState;
  proposedPlanIds: Id[];
  warnings: CapacityWarning[];
  skipped: { assignmentId: Id; reason: SkipReason }[];
}

function roundUp(ts: Timestamp, minutes: number): Timestamp {
  const step = minutes * MIN;
  return Math.ceil(ts / step) * step;
}

function subtract(free: Interval[], busy: Interval[]): Interval[] {
  let out = free;
  for (const b of busy) {
    out = out.flatMap((f) => {
      if (b.end <= f.start || b.start >= f.end) return [f];
      const parts: Interval[] = [];
      if (b.start > f.start) parts.push({ start: f.start, end: b.start });
      if (b.end < f.end) parts.push({ start: b.end, end: f.end });
      return parts;
    });
  }
  return out;
}

function busyIntervals(state: PlannerState, extra: SessionPlan[], excludeAssignment?: Id): Interval[] {
  const gap = PLANNER_RULES.gapBetweenPlansMinutes * MIN;
  return [...Object.values(state.plans).filter((p) => isActivePlan(p) || (p.status === 'proposed' && p.assignmentId !== excludeAssignment)), ...extra].map((p) => ({ start: p.plannedStartAt - gap, end: p.plannedStartAt + p.plannedMinutes * MIN + gap }));
}

/** Free study time per local day between `from` and `until`, from the weekly availability. */
export function freeTimeByDay(availability: readonly AvailabilityWindow[], timezone: string, from: Timestamp, until: Timestamp, busy: Interval[]): { day: string; free: Interval[] }[] {
  const days: { day: string; free: Interval[] }[] = [];
  let day = dayKeyIn(from, timezone);
  const last = dayKeyIn(until, timezone);
  let guard = 0;
  while (day <= last && guard++ < PLANNER_RULES.horizonDays + 2) {
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    const windows = availability
      .filter((w) => w.weekday === weekday && w.endMinute > w.startMinute)
      .map((w) => ({ start: Math.max(atMinute(day, w.startMinute, timezone), from), end: Math.min(atMinute(day, w.endMinute, timezone), until) }))
      .filter((w) => w.end > w.start);
    days.push({ day, free: subtract(windows, busy) });
    day = addDays(day, 1);
  }
  return days;
}

export const freeMinutes = (intervals: Interval[]) => intervals.reduce((s, i) => s + Math.max(0, i.end - i.start), 0) / MIN;

function sessionLengths(remaining: number, preferred: number): number[] {
  const n = Math.max(1, Math.ceil(remaining / preferred));
  const base = Math.max(PLANNER_RULES.minSessionMinutes, Math.round(remaining / n / 5) * 5);
  const lengths = Array.from({ length: n }, () => base);
  const diff = remaining - base * n;
  lengths[n - 1] = Math.max(PLANNER_RULES.minSessionMinutes, lengths[n - 1]! + diff);
  return lengths;
}

function placeIn(free: Interval[], minutes: number): Interval | null {
  const g = PLANNER_RULES.slotGranularityMinutes;
  for (const f of free) {
    const start = roundUp(f.start, g);
    if (start + minutes * MIN <= f.end) return { start, end: start + minutes * MIN };
  }
  return null;
}

/**
 * Propose study blocks for schedulable assignments, earliest deadline first.
 * Replaces each assignment's previous (unaccepted) proposals. Accepted plans
 * and other proposals are treated as busy. Placement: blocks are spread
 * evenly across the days before the deadline (inside a lead window that grows
 * with the number of blocks), at the earliest free time on each chosen day.
 * When there isn't room, it proposes what fits and returns a capacity warning.
 */
export function proposePlans(state: PlannerState, now: Timestamp, ids: IdGen, assignmentIds?: Id[]): ProposeResult {
  const prefs = state.preferences;
  const tz = prefs.timezone;
  const plans = { ...state.plans };
  // Drop old proposals for the assignments being re-planned.
  const targets = (assignmentIds ?? liveAssignments(state).map((a) => a.id)).map((id) => state.assignments[id]).filter((a): a is Assignment => Boolean(a));
  const targetIds = new Set(targets.map((a) => a.id));
  for (const p of Object.values(plans)) if (p.status === 'proposed' && p.assignmentId && targetIds.has(p.assignmentId)) delete plans[p.id];
  let next: PlannerState = { ...state, plans };

  const result: Omit<ProposeResult, 'state'> = { proposedPlanIds: [], warnings: [], skipped: [] };
  const made: SessionPlan[] = [];
  const start = roundUp(now, PLANNER_RULES.slotGranularityMinutes);

  for (const a of [...targets].sort((x, y) => (x.dueAt ?? Infinity) - (y.dueAt ?? Infinity))) {
    if (a.status === 'completed') {
      result.skipped.push({ assignmentId: a.id, reason: 'completed' });
      continue;
    }
    if (!a.dueAt) {
      result.skipped.push({ assignmentId: a.id, reason: 'noDueDate' });
      continue;
    }
    if (!isSchedulable(a)) {
      result.skipped.push({ assignmentId: a.id, reason: 'needsReview' });
      continue;
    }
    if (!a.estimatedMinutes) {
      result.skipped.push({ assignmentId: a.id, reason: 'noEstimate' });
      continue;
    }
    const progress = assignmentProgress(next, a.id, now);
    const remaining = Math.max(0, (progress.remainingMinutes ?? 0) - progress.plannedMinutes);
    if (remaining <= 0) {
      result.skipped.push({ assignmentId: a.id, reason: 'nothingLeft' });
      continue;
    }
    const deadline = Math.min(a.dueAt - PLANNER_RULES.deadlineBufferMinutes * MIN, now + PLANNER_RULES.horizonDays * 24 * 60 * MIN);
    if (deadline <= start) {
      result.skipped.push({ assignmentId: a.id, reason: 'pastDue' });
      result.warnings.push({ assignmentId: a.id, neededMinutes: remaining, fitsMinutes: 0, dueAt: a.dueAt });
      continue;
    }
    const lengths = sessionLengths(remaining, prefs.preferredSessionMinutes);
    const busy = busyIntervals(next, made, a.id);
    const days = freeTimeByDay(prefs.availability, tz, start, deadline, busy);
    const placed = placeSessions(days, lengths, busy);
    const fits = placed.reduce((s, p) => s + (p.end - p.start) / MIN, 0);
    placed.forEach((iv, i) => {
      const id = ids('plan');
      const plan: SessionPlan = {
        id,
        courseId: a.courseId,
        assignmentId: a.id,
        plannedStartAt: iv.start,
        plannedMinutes: Math.round((iv.end - iv.start) / MIN),
        planType: PLAN_TYPE_FOR[a.type],
        protectionProfileId: 'default',
        status: 'proposed',
        createdBy: 'planner',
        sequenceIndex: i + 1,
        sequenceCount: placed.length,
        createdAt: now,
        updatedAt: now,
      };
      made.push(plan);
      next.plans[id] = plan;
      result.proposedPlanIds.push(id);
    });
    if (fits < remaining) result.warnings.push({ assignmentId: a.id, neededMinutes: remaining, fitsMinutes: Math.round(fits), dueAt: a.dueAt });
  }
  for (const id of result.proposedPlanIds) next = logEvent(next, ids, now, 'planCreated', { planId: id, assignmentId: next.plans[id]!.assignmentId, courseId: next.plans[id]!.courseId });
  return { state: next, ...result };
}

function placeSessions(days: { day: string; free: Interval[] }[], lengths: number[], busy: Interval[]): Interval[] {
  const gap = PLANNER_RULES.gapBetweenPlansMinutes * MIN;
  const n = lengths.length;
  const usable = days.filter((d) => d.free.some((f) => f.end - f.start >= PLANNER_RULES.minSessionMinutes * MIN));
  const leadDays = Math.max(PLANNER_RULES.minLeadDays, n * PLANNER_RULES.leadDaysPerSession);
  // Prefer the lead window just before the deadline; widen to earlier days only when it lacks room.
  const window = usable.slice(Math.max(0, usable.length - leadDays));
  const placed: Interval[] = [];
  const taken = [...busy];
  const free = (d: { free: Interval[] }) => subtract(d.free, taken);
  const put = (iv: Interval) => {
    placed.push(iv);
    taken.push({ start: iv.start - gap, end: iv.end + gap });
  };

  const queue = [...lengths];
  if (PLANNER_RULES.spreadAcrossDays && window.length >= n) {
    const chosen = n === 1 ? [window[Math.floor((window.length - 1) / 2)]!] : Array.from({ length: n }, (_, i) => window[Math.round((i * (window.length - 1)) / (n - 1))]!);
    chosen.forEach((d, i) => {
      const iv = placeIn(free(d), lengths[i]!);
      if (iv) {
        put(iv);
        queue[i] = 0;
      }
    });
  }
  // Anything left: round-robin over the days (window first, then earlier days), one block
  // per day per pass, so a tight deadline gets balanced evenings instead of one marathon.
  const order = [...window, ...usable.slice(0, Math.max(0, usable.length - leadDays)).reverse()];
  let progress = true;
  while (queue.some(Boolean) && progress) {
    progress = false;
    for (const d of order) {
      const i = queue.findIndex(Boolean);
      if (i < 0) break;
      const iv = placeIn(free(d), queue[i]!);
      if (iv) {
        put(iv);
        queue[i] = 0;
        progress = true;
      }
    }
  }
  return placed.sort((a, b) => a.start - b.start);
}

// ── Plan actions ────────────────────────────────────────────────────

export function acceptPlan(state: PlannerState, planId: Id, now: Timestamp, ids: IdGen): PlannerState {
  const p = state.plans[planId];
  if (!p || p.status !== 'proposed') return state;
  const next: PlannerState = { ...state, plans: { ...state.plans, [planId]: { ...p, status: 'accepted', updatedAt: now } } };
  return logEvent(next, ids, now, 'planAccepted', { planId, assignmentId: p.assignmentId, courseId: p.courseId });
}

export function acceptAllProposed(state: PlannerState, now: Timestamp, ids: IdGen, assignmentId?: Id): PlannerState {
  return Object.values(state.plans)
    .filter((p) => p.status === 'proposed' && (!assignmentId || p.assignmentId === assignmentId))
    .reduce((s, p) => acceptPlan(s, p.id, now, ids), state);
}

export function discardProposals(state: PlannerState, assignmentId?: Id): PlannerState {
  const plans = { ...state.plans };
  for (const p of Object.values(plans)) if (p.status === 'proposed' && (!assignmentId || p.assignmentId === assignmentId)) delete plans[p.id];
  return { ...state, plans };
}

export function reschedulePlan(state: PlannerState, planId: Id, newStart: Timestamp, now: Timestamp, ids: IdGen, minutes?: number): PlannerState {
  const p = state.plans[planId];
  if (!p || !(isActivePlan(p) || p.status === 'proposed')) return state;
  const moved: SessionPlan = {
    ...p,
    plannedStartAt: newStart,
    plannedMinutes: minutes ?? p.plannedMinutes,
    status: p.status === 'proposed' ? 'proposed' : 'rescheduled',
    rescheduledFrom: p.rescheduledFrom ?? p.plannedStartAt,
    updatedAt: now,
  };
  const next: PlannerState = { ...state, plans: { ...state.plans, [planId]: moved } };
  return p.status === 'proposed' ? next : logEvent(next, ids, now, 'planRescheduled', { planId, assignmentId: p.assignmentId, data: { fromMs: p.plannedStartAt, toMs: newStart } });
}

export function skipPlan(state: PlannerState, planId: Id, now: Timestamp, ids: IdGen): PlannerState {
  const p = state.plans[planId];
  if (!p || !isActivePlan(p)) return state;
  const next: PlannerState = { ...state, plans: { ...state.plans, [planId]: { ...p, status: 'skipped', updatedAt: now } } };
  return logEvent(next, ids, now, 'planSkipped', { planId, assignmentId: p.assignmentId });
}

export function cancelPlan(state: PlannerState, planId: Id, now: Timestamp, ids: IdGen): PlannerState {
  const p = state.plans[planId];
  if (!p || p.status === 'completed' || p.status === 'cancelled') return state;
  const next: PlannerState = { ...state, plans: { ...state.plans, [planId]: { ...p, status: 'cancelled', updatedAt: now } } };
  return logEvent(next, ids, now, 'planCancelled', { planId, assignmentId: p.assignmentId });
}

/** "I'll handle it": hide the capacity note for this deadline. */
export function dismissCapacityNote(state: PlannerState, assignmentId: Id): PlannerState {
  const a = state.assignments[assignmentId];
  if (!a || !a.dueAt) return state;
  return { ...state, assignments: { ...state.assignments, [assignmentId]: { ...a, capacityNoteDismissedFor: a.dueAt } } };
}

/** Capacity check without proposing (Planner home / assignment detail). */
export function capacityFor(state: PlannerState, assignmentId: Id, now: Timestamp): CapacityWarning | null {
  const a = state.assignments[assignmentId];
  if (!a || !isSchedulable(a) || !a.estimatedMinutes || !a.dueAt) return null;
  if (a.capacityNoteDismissedFor === a.dueAt) return null;
  const progress = assignmentProgress(state, assignmentId, now);
  const unplanned = progress.unplannedMinutes ?? 0;
  if (unplanned <= 0) return null;
  const deadline = a.dueAt - PLANNER_RULES.deadlineBufferMinutes * MIN;
  const start = roundUp(now, PLANNER_RULES.slotGranularityMinutes);
  if (deadline <= start) return { assignmentId, neededMinutes: progress.remainingMinutes ?? 0, fitsMinutes: progress.plannedMinutes, dueAt: a.dueAt };
  const days = freeTimeByDay(state.preferences.availability, state.preferences.timezone, start, deadline, busyIntervals(state, [], assignmentId));
  const fitsFree = days.reduce((s, d) => s + freeMinutes(d.free), 0);
  if (fitsFree >= unplanned) return null;
  return { assignmentId, neededMinutes: progress.remainingMinutes ?? 0, fitsMinutes: Math.round(progress.plannedMinutes + fitsFree), dueAt: a.dueAt };
}
