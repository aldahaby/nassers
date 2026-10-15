import { JOURNEY_CONFIG } from '@/config/journey';
import { GROWTH_STAGES } from '@/config/progression';
import type { FocusSessionRecord, GrowthStage, JourneyMilestone, JourneyState, LifetimeStats, PlannerState, TaskCompletionRecord, Timestamp } from '../models';

/**
 * Journey: one-time milestones from real records (docs/STATS_AND_JOURNEY.md).
 *
 * - A milestone is stored the first time it is reached and never removed or
 *   awarded again (even if a task is later reopened or old history ages out).
 * - `achievedAt` comes from the record that crossed the line. When the game's
 *   lifetime counters show it happened before detailed records existed, the
 *   date is null ("Before Journey began"), never estimated.
 * - No streaks, missed-day penalties or long-session milestones.
 */

export interface JourneyInputs {
  records: readonly FocusSessionRecord[];
  tasks: readonly TaskCompletionRecord[];
  planner: PlannerState | null;
  lifetime: Pick<LifetimeStats, 'sessionsCompleted' | 'totalFocusMinutes'> | null;
  /** Minutes the records credited before capping (to compare with lifetime.totalFocusMinutes). */
  creditedMinutes: number;
  petXp: number | null;
}

export type JourneyCandidate = Omit<JourneyMilestone, 'recordedAt'>;

export function createJourneyState(now: Timestamp): JourneyState {
  return { startedAt: now, milestones: {}, petXpSeen: null };
}

const stageMinXp = (stage: GrowthStage) => GROWTH_STAGES.find((s) => s.stage === stage)?.minXp ?? Infinity;
const byEnd = (a: FocusSessionRecord, b: FocusSessionRecord) => a.endedAt - b.endedAt || (a.id < b.id ? -1 : 1);

/** Every milestone the records support right now (the reducer keeps only new ones). */
export function journeyCandidates(inputs: JourneyInputs, previousPetXp: number | null, now: Timestamp): JourneyCandidate[] {
  const out: JourneyCandidate[] = [];
  const { records, tasks, planner } = inputs;

  // Completed sessions: count older, un-detailed sessions from the lifetime counter.
  const completed = records.filter((r) => r.status === 'completed').sort(byEnd);
  const sessionOffset = Math.max(0, (inputs.lifetime?.sessionsCompleted ?? 0) - completed.length);
  const sessionTotal = sessionOffset + completed.length;
  for (const n of [1, ...JOURNEY_CONFIG.sessionThresholds]) {
    if (sessionTotal < n) continue;
    const idx = n - sessionOffset - 1;
    const achievedAt = idx >= 0 ? completed[idx]!.endedAt : null;
    out.push(n === 1 ? { id: 'firstSession', kind: 'firstSession', achievedAt } : { id: `sessions:${n}`, kind: 'sessions', achievedAt, threshold: n });
  }

  // Focus hours: recorded (capped) minutes, plus older minutes the lifetime counter has and records don't.
  const minuteOffset = Math.max(0, (inputs.lifetime?.totalFocusMinutes ?? 0) - inputs.creditedMinutes);
  const chronological = [...records].sort(byEnd);
  for (const hours of JOURNEY_CONFIG.focusHourThresholds) {
    const target = hours * 60;
    if (minuteOffset >= target) {
      out.push({ id: `focusHours:${hours}`, kind: 'focusHours', achievedAt: null, threshold: hours });
      continue;
    }
    let running = minuteOffset;
    for (const r of chronological) {
      running += r.recordedMinutes;
      if (running >= target) {
        out.push({ id: `focusHours:${hours}`, kind: 'focusHours', achievedAt: r.endedAt, threshold: hours });
        break;
      }
    }
  }

  // Tasks (planner assignments).
  for (const n of [1, ...JOURNEY_CONFIG.taskThresholds]) {
    const t = tasks[n - 1];
    if (!t) continue;
    out.push(n === 1 ? { id: 'firstTask', kind: 'firstTask', achievedAt: t.completedAt, courseId: t.courseId } : { id: `tasks:${n}`, kind: 'tasks', achievedAt: t.completedAt, threshold: n });
  }

  if (planner) {
    const firstCourse = Object.values(planner.courses).sort((a, b) => a.createdAt - b.createdAt)[0];
    if (firstCourse) out.push({ id: 'firstCourse', kind: 'firstCourse', achievedAt: firstCourse.createdAt, courseId: firstCourse.id });
    const firstSyllabus = Object.values(planner.syllabi).sort((a, b) => a.importedAt - b.importedAt)[0];
    if (firstSyllabus) out.push({ id: 'firstSyllabus', kind: 'firstSyllabus', achievedAt: firstSyllabus.importedAt, courseId: firstSyllabus.courseId });

    const ledger = Object.values(planner.studySessions).sort((a, b) => a.endedAt - b.endedAt);
    const independent = ledger.find((s) => s.outcome === 'completed' && s.sessionPlanId && s.independentStart);
    if (independent) out.push({ id: 'firstIndependentStart', kind: 'firstIndependentStart', achievedAt: independent.endedAt, courseId: independent.courseId });

    const retrievalEvent = planner.events.find((e) => e.type === 'retrievalCompleted');
    if (retrievalEvent) out.push({ id: 'firstRetrieval', kind: 'firstRetrieval', achievedAt: retrievalEvent.at });
    else if (ledger.some((s) => s.retrievalCompleted)) out.push({ id: 'firstRetrieval', kind: 'firstRetrieval', achievedAt: null });

    // Syllabus-connected milestones (real actions only; repeated imports never re-award).
    const fromSyllabus = tasks.find((t) => planner.assignments[t.assignmentId]?.syllabusId);
    if (fromSyllabus) out.push({ id: 'firstSyllabusTaskDone', kind: 'firstSyllabusTaskDone', achievedAt: fromSyllabus.completedAt, courseId: fromSyllabus.courseId });
    const linked = completed.find((r) => r.assignmentId && planner.assignments[r.assignmentId]);
    if (linked) out.push({ id: 'firstTaskSession', kind: 'firstTaskSession', achievedAt: linked.endedAt, courseId: linked.courseId });
    const prep = completed.find((r) => r.assignmentId && planner.assignments[r.assignmentId]?.type === 'exam');
    if (prep) out.push({ id: 'firstExamPrep', kind: 'firstExamPrep', achievedAt: prep.endedAt, courseId: prep.courseId });

    for (const course of Object.values(planner.courses)) {
      const first = completed.find((r) => r.courseId === course.id);
      if (first) out.push({ id: `courseFirstSession:${course.id}`, kind: 'courseFirstSession', achievedAt: first.endedAt, courseId: course.id });
    }
  }

  const planned = completed.find((r) => r.fromPlan);
  if (planned) out.push({ id: 'firstPlannedSession', kind: 'firstPlannedSession', achievedAt: planned.endedAt, courseId: planned.courseId });

  // Pet growth: dated by the session whose reward reached the stage, or by
  // seeing the change happen live (previous evaluation was below the stage).
  if (inputs.petXp != null) {
    for (const stage of JOURNEY_CONFIG.petStages) {
      const min = stageMinXp(stage);
      if (inputs.petXp < min) continue;
      const bySession = [...records].sort(byEnd).find((r) => r.stageReached === stage);
      const achievedAt = bySession ? bySession.endedAt : previousPetXp != null && previousPetXp < min ? now : null;
      out.push({ id: `petStage:${stage}`, kind: 'petStage', achievedAt, stage });
    }
  }

  return out;
}

/**
 * Adds newly reached milestones (each id once, ever). Returns the same object
 * when nothing changed so callers can skip a save.
 */
export function evaluateJourney(state: JourneyState, inputs: JourneyInputs, now: Timestamp): JourneyState {
  let milestones = state.milestones;
  for (const c of journeyCandidates(inputs, state.petXpSeen, now)) {
    if (milestones[c.id]) continue;
    if (milestones === state.milestones) milestones = { ...milestones };
    milestones[c.id] = { ...c, recordedAt: now };
  }
  const petXpSeen = inputs.petXp ?? state.petXpSeen;
  if (milestones === state.milestones && petXpSeen === state.petXpSeen) return state;
  return { ...state, milestones, petXpSeen };
}

/** Milestones newest first; undated ("before Journey began") ones last. */
export function journeyTimeline(state: JourneyState): JourneyMilestone[] {
  return Object.values(state.milestones).sort((a, b) => {
    if (a.achievedAt == null && b.achievedAt == null) return a.recordedAt - b.recordedAt || (a.id < b.id ? -1 : 1);
    if (a.achievedAt == null) return 1;
    if (b.achievedAt == null) return -1;
    return b.achievedAt - a.achievedAt || (a.id < b.id ? -1 : 1);
  });
}
