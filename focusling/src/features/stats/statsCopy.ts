import { GROWTH_STAGES } from '@/config/progression';
import type { Course, JourneyMilestone, SessionRecordStatus } from '@/core';
import { courseLabel } from '../planner/plannerCopy';

/**
 * Stats & Journey words. Minutes are always "focus time" (time inside a focus
 * session), never concentration; no percentages, rankings or guilt.
 */

export const STATUS_LABEL: Record<SessionRecordStatus, string> = { completed: 'Completed', endedEarly: 'Ended early' };

export const FOCUS_TIME_NOTE = 'Focus time is time spent inside a focus session. It is not a measure of how well you concentrated.';

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

const stageLabel = (stage: string | undefined) => GROWTH_STAGES.find((s) => s.stage === stage)?.label ?? 'new';

/** Title and a short detail for a milestone. Course names come from the planner, if the course still exists. */
export function milestoneCopy(m: JourneyMilestone, courses: Record<string, Course>, petName: string | null): { title: string; detail: string; icon: 'focus' | 'check' | 'book' | 'planner' | 'pet' | 'stats' } {
  const course = m.courseId ? courses[m.courseId] : undefined;
  const n = m.threshold ?? 0;
  switch (m.kind) {
    case 'firstSession':
      return { title: 'First focus session finished', detail: 'Where it all started.', icon: 'focus' };
    case 'sessions':
      return { title: `${n} focus sessions finished`, detail: 'Showing up, one session at a time.', icon: 'focus' };
    case 'focusHours':
      return { title: `${plural(n, 'hour')} of focus time`, detail: 'Recorded across all your sessions.', icon: 'stats' };
    case 'firstTask':
      return { title: 'First task completed', detail: course ? courseLabel(course) : 'Marked done in the Planner.', icon: 'check' };
    case 'tasks':
      return { title: `${n} tasks completed`, detail: 'Finished work from your Planner.', icon: 'check' };
    case 'firstCourse':
      return { title: 'Added your first course', detail: course ? courseLabel(course) : 'Your Planner began.', icon: 'book' };
    case 'firstSyllabus':
      return { title: 'Imported your first syllabus', detail: course ? courseLabel(course) : 'Reviewed and added to your Planner.', icon: 'book' };
    case 'firstPlannedSession':
      return { title: 'Finished your first planned study block', detail: course ? courseLabel(course) : 'Planned, then done.', icon: 'planner' };
    case 'firstIndependentStart':
      return { title: 'Started a planned block on your own', detail: 'No reminder needed.', icon: 'planner' };
    case 'firstRetrieval':
      return { title: 'First recall practice', detail: 'Tried to remember what you studied, without looking.', icon: 'book' };
    case 'petStage':
      return { title: `${petName ?? 'Your pet'} grew to ${stageLabel(m.stage)}`, detail: 'Grown by your focus sessions.', icon: 'pet' };
    case 'courseFirstSession':
      return { title: `First session for ${course ? courseLabel(course) : 'a course'}`, detail: course?.name && course.code ? course.name : 'Study time linked to this course.', icon: 'book' };
  }
}
