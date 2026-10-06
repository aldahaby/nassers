import { acceptAllProposed, addAssignment, addCourse, commitImport, createImportDraft, createPlannerState, fromWallClock, proposePlans, updateAssignment, type PlannerState } from '@/core';
import { CLEAN_TEXT, TERM_CROSSING } from '@/core/planner/fixtures/syllabi';

/**
 * Planner QA scenarios (Developer tools only). Each returns the simulated
 * "now" and a planner document built with the real core functions. Data is
 * synthetic. Reminder/privacy preferences are carried over from `base`.
 */
export type QaScenario = 'newSemester' | 'midterm' | 'finals' | 'overloaded' | 'dueTomorrow';

export const QA_SCENARIOS: readonly { id: QaScenario; label: string }[] = [
  { id: 'newSemester', label: 'New semester' },
  { id: 'midterm', label: 'Midterm' },
  { id: 'finals', label: 'Finals' },
  { id: 'overloaded', label: 'Overloaded week' },
  { id: 'dueTomorrow', label: 'Due tomorrow' },
];

let seq = 0;
const ids = (p: string) => `qa_${p}_${Date.now().toString(36)}_${++seq}`;

export function buildScenario(id: QaScenario, base: PlannerState | null): { now: number; state: PlannerState } {
  const tz = base?.preferences.timezone ?? 'America/New_York';
  const at = (m: number, d: number, h = 9, y = 2026) => fromWallClock({ year: y, month: m, day: d, hour: h, minute: 0 }, tz);
  const fresh = (now: number): PlannerState => {
    const s = createPlannerState(now, tz);
    return base ? { ...s, preferences: base.preferences } : s;
  };
  const estimate = (s: PlannerState, now: number, map: Record<string, number>) => {
    let next = s;
    for (const a of Object.values(next.assignments)) if (map[a.title]) next = updateAssignment(next, a.id, { estimatedMinutes: map[a.title] }, now).state;
    return next;
  };
  const planAll = (s: PlannerState, now: number) => acceptAllProposed(proposePlans(s, now, ids).state, now, ids);
  const importText = (s: PlannerState, text: string, now: number) => commitImport(s, createImportDraft(s, { text, sourceType: 'pdf', filename: 'synthetic-syllabus.pdf', timezone: tz, now }), { now, ids, keepOriginal: false }).state;

  switch (id) {
    case 'newSemester': {
      const now = at(9, 7);
      let s = importText(fresh(now), CLEAN_TEXT.text, now);
      s = estimate(s, now, { 'Problem Set 1': 90, 'Quiz 1': 60, 'Problem Set 2': 120 });
      return { now, state: planAll(s, now) };
    }
    case 'midterm': {
      const now = at(10, 8);
      let s = importText(fresh(now), CLEAN_TEXT.text, now);
      s = estimate(s, now, { 'Midterm Exam': 240, 'Problem Set 3': 120, 'Read Chapter 7': 45 });
      return { now, state: planAll(s, now) };
    }
    case 'finals': {
      const now = at(12, 1);
      let s = importText(fresh(now), TERM_CROSSING.text, now);
      s = estimate(s, now, { 'Project milestone 2': 180, 'Take-home final exam': 360, 'Course reflection': 60 });
      return { now, state: planAll(s, now) };
    }
    case 'overloaded': {
      const now = at(10, 12);
      const c = addCourse(fresh(now), { name: 'Organic Chemistry', code: 'CHEM 210', timezone: tz }, now, ids);
      let s = c.state;
      for (const [title, type] of [
        ['Lab report 3', 'lab'],
        ['Problem set 6', 'assignment'],
        ['Reaction mechanisms quiz', 'quiz'],
      ] as const) {
        s = addAssignment(s, { courseId: c.courseId, title, type, dueDayKey: '2026-10-13', dueTime: '23:00', estimatedMinutes: 240 }, now, ids).state;
      }
      return { now, state: proposePlans(s, now, ids).state };
    }
    case 'dueTomorrow': {
      const now = at(10, 14, 15);
      const c = addCourse(fresh(now), { name: 'Psychology', code: 'PSYC 101', timezone: tz }, now, ids);
      const s = addAssignment(c.state, { courseId: c.courseId, title: 'Chapter 5 reading', type: 'reading', dueDayKey: '2026-10-15', dueTime: '09:00', estimatedMinutes: 90 }, now, ids).state;
      return { now, state: planAll(s, now) };
    }
  }
}
