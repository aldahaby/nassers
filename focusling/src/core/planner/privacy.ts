import type { GrowthStage, Id, LockScreenDetail, PetSpeciesId, PlannerState, ProtectionResult, Timestamp } from '../models';
import { nextPlan, plansOnDay } from './plannerService';
import { dayKeyIn } from './time';

/**
 * Privacy classification of planner data (docs/PLANNER_PRIVACY.md). The
 * Planner QA "Privacy inspector" renders this table, and tests check that
 * shared payloads only contain fields classified for sharing.
 */
export type DataClass = 'LOCAL' | 'WIDGET_SHARED' | 'SYNC_ELIGIBLE' | 'SECRET_STORAGE' | 'NEVER_PERSISTED';

export const FIELD_CLASSIFICATION: readonly { field: string; classes: DataClass[]; note: string }[] = [
  { field: 'Raw syllabus text / OCR output', classes: ['NEVER_PERSISTED'], note: 'Memory only during review; discarded on commit unless "Keep original" is on (then LOCAL).' },
  { field: 'Kept original (opt-in)', classes: ['LOCAL'], note: 'Only with an explicit opt-in. Never shared or synced.' },
  { field: 'Review snippets', classes: ['NEVER_PERSISTED'], note: 'Shown during review, never saved.' },
  { field: 'Course name / code', classes: ['LOCAL', 'SYNC_ELIGIBLE', 'WIDGET_SHARED'], note: 'Widget/Live Activity only in Detailed lock-screen mode.' },
  { field: 'Assignment title', classes: ['LOCAL', 'SYNC_ELIGIBLE', 'WIDGET_SHARED'], note: 'Widget/Live Activity only in Detailed mode.' },
  { field: 'Due dates, estimates, plans', classes: ['LOCAL', 'SYNC_ELIGIBLE'], note: 'Plan start time and length are shared with the widget.' },
  { field: 'Study session records', classes: ['LOCAL', 'SYNC_ELIGIBLE'], note: 'Durations and outcomes; no content.' },
  { field: 'Retrieval prompts, answers, brain dumps', classes: ['LOCAL', 'SYNC_ELIGIBLE'], note: 'Never shared with widgets, notifications or logs.' },
  { field: 'Planner event log', classes: ['LOCAL'], note: 'Ids, times and small codes only. Never sent to analytics.' },
  { field: 'Content hash, parser version, page/line provenance', classes: ['LOCAL', 'SYNC_ELIGIBLE'], note: 'No source text.' },
  { field: 'Next plan time + minutes, active session end, protection status', classes: ['WIDGET_SHARED'], note: 'The minimal widget snapshot.' },
  { field: 'Pet species + growth stage', classes: ['WIDGET_SHARED'], note: 'For the restrained pet glyph; no name in Private mode.' },
  { field: 'LMS / OAuth tokens (future)', classes: ['SECRET_STORAGE'], note: 'Keychain only; stripped from every serialised document.' },
  { field: 'Student ID images', classes: ['NEVER_PERSISTED'], note: 'Never collected.' },
];

/** Keys that must never appear in a serialised planner or game document. */
export const SECRET_KEYS: readonly string[] = ['accessToken', 'refreshToken', 'idToken', 'oauthToken', 'apiToken', 'clientSecret', 'password', 'studentIdImage'];

/** JSON for storage: secret-looking keys are dropped wherever they appear. */
export function serializePlannerState(state: PlannerState): string {
  return JSON.stringify(state, (key, value) => (SECRET_KEYS.includes(key) ? undefined : value));
}

// ── Widget / Live Activity snapshot ─────────────────────────────────

/** Everything the widget extension can see. Kept tiny on purpose. */
export interface WidgetSnapshot {
  v: 1;
  generatedAt: Timestamp;
  privacyMode: LockScreenDetail;
  nextPlanId: Id | null;
  courseDisplayName: string | null;
  assignmentDisplayTitle: string | null;
  plannedStart: Timestamp | null;
  plannedMinutes: number | null;
  todayPlanCount: number;
  todayMinutes: number;
  activeSession: { endsAt: Timestamp; protection: 'on' | 'off' | 'simulated' } | null;
  pet: { speciesId: PetSpeciesId; stage: GrowthStage } | null;
}

export const WIDGET_SNAPSHOT_KEYS: readonly (keyof WidgetSnapshot)[] = ['v', 'generatedAt', 'privacyMode', 'nextPlanId', 'courseDisplayName', 'assignmentDisplayTitle', 'plannedStart', 'plannedMinutes', 'todayPlanCount', 'todayMinutes', 'activeSession', 'pet'];

export function protectionBadge(result: ProtectionResult | undefined): 'on' | 'off' | 'simulated' {
  return result === 'activated' ? 'on' : result === 'simulated' ? 'simulated' : 'off';
}

export function buildWidgetSnapshot(
  state: PlannerState,
  now: Timestamp,
  extra: { activeSession: { endsAt: Timestamp; protection: ProtectionResult } | null; pet: { speciesId: PetSpeciesId; stage: GrowthStage } | null },
): WidgetSnapshot {
  const detailed = state.preferences.lockScreenDetail === 'detailed';
  const next = nextPlan(state, now);
  const course = next ? state.courses[next.courseId] : undefined;
  const assignment = next?.assignmentId ? state.assignments[next.assignmentId] : undefined;
  const today = plansOnDay(state, dayKeyIn(now, state.preferences.timezone), state.preferences.timezone).filter((p) => p.status === 'accepted' || p.status === 'rescheduled');
  return {
    v: 1,
    generatedAt: now,
    privacyMode: state.preferences.lockScreenDetail,
    nextPlanId: next?.id ?? null,
    courseDisplayName: detailed && course ? course.code ?? course.name : null,
    assignmentDisplayTitle: detailed && assignment ? assignment.title : null,
    plannedStart: next?.plannedStartAt ?? null,
    plannedMinutes: next?.plannedMinutes ?? null,
    todayPlanCount: today.length,
    todayMinutes: today.reduce((s, p) => s + p.plannedMinutes, 0),
    activeSession: extra.activeSession ? { endsAt: extra.activeSession.endsAt, protection: protectionBadge(extra.activeSession.protection) } : null,
    pet: extra.pet,
  };
}

/** Live Activity text. Private mode never shows course or assignment. */
export interface LiveActivityContent {
  title: string;
  subtitle: string;
  endsAt: Timestamp;
  protection: 'on' | 'off' | 'simulated';
}

export function liveActivityContent(state: PlannerState, session: { endsAt: Timestamp; plannedMinutes: number; courseId?: Id; assignmentId?: Id; protection: ProtectionResult }): LiveActivityContent {
  const detailed = state.preferences.lockScreenDetail === 'detailed';
  const course = session.courseId ? state.courses[session.courseId] : undefined;
  const assignment = session.assignmentId ? state.assignments[session.assignmentId] : undefined;
  if (!detailed || !course) return { title: 'Studyling', subtitle: `Study session · ${session.plannedMinutes} min`, endsAt: session.endsAt, protection: protectionBadge(session.protection) };
  return { title: 'Studyling', subtitle: [course.code ?? course.name, assignment?.title].filter(Boolean).join(' · '), endsAt: session.endsAt, protection: protectionBadge(session.protection) };
}
