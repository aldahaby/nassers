import { defaultPreferences, EVENT_LOG_LIMIT, PLANNER_SCHEMA_VERSION, REMINDER_FADING_POLICY } from '@/config/planner';
import type { Id, PlannerEvent, PlannerEventType, PlannerState, Timestamp } from '../models';

/** Generates ids. The state layer passes a real one; tests pass a counter. */
export type IdGen = (prefix: string) => Id;

export function createPlannerState(now: Timestamp, timezone: string): PlannerState {
  return {
    plannerSchemaVersion: PLANNER_SCHEMA_VERSION,
    courses: {},
    assignments: {},
    syllabi: {},
    plans: {},
    reminderRules: {},
    scheduledReminders: {},
    exposures: {},
    studySessions: {},
    retrievalItems: {},
    events: [],
    progress: {
      supportLevel: 'standard',
      supportChangedAt: now,
      supportReason: 'Starting with Standard reminders.',
      policyVersion: REMINDER_FADING_POLICY.version,
      observedPlanIds: [],
      observations: [],
      recoveryOffer: 'none',
    },
    preferences: defaultPreferences(timezone),
    originals: {},
    pendingRetrieval: null,
  };
}

export function logEvent(state: PlannerState, ids: IdGen, at: Timestamp, type: PlannerEventType, fields: Omit<PlannerEvent, 'id' | 'at' | 'type'> = {}): PlannerState {
  const event: PlannerEvent = { id: ids('evt'), at, type, ...fields };
  const events = [...state.events, event];
  return { ...state, events: events.length > EVENT_LOG_LIMIT ? events.slice(events.length - EVENT_LOG_LIMIT) : events };
}

/**
 * Loads a stored planner document, upgrading older planner schemas. Unknown
 * fields are kept; missing tables are filled so a partial document never crashes.
 */
export function migratePlanner(raw: unknown, now: Timestamp, timezone: string): PlannerState {
  const base = createPlannerState(now, timezone);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<PlannerState>;
  const version = typeof r.plannerSchemaVersion === 'number' ? r.plannerSchemaVersion : 0;
  if (version > PLANNER_SCHEMA_VERSION) throw new Error('planner-from-newer-app');
  return {
    ...base,
    ...r,
    plannerSchemaVersion: PLANNER_SCHEMA_VERSION,
    progress: { ...base.progress, ...(r.progress ?? {}) },
    preferences: { ...base.preferences, ...(r.preferences ?? {}) },
    events: Array.isArray(r.events) ? r.events : [],
    originals: r.originals ?? {},
    pendingRetrieval: r.pendingRetrieval ?? null,
  };
}
