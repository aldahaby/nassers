import { dayKeyIn, toWallClock, type AssignmentType, type ConfidenceLevel, type Course, type ProtectionResult, type StartContext, type Timestamp } from '@/core';

/** Plain-language labels for planner screens (no percentages, no guilt). */

export const TYPE_LABEL: Record<AssignmentType, string> = {
  assignment: 'Assignment',
  exam: 'Exam',
  quiz: 'Quiz',
  paper: 'Paper',
  project: 'Project',
  reading: 'Reading',
  lab: 'Lab',
  presentation: 'Presentation',
  review: 'Review',
  other: 'Other',
};

export const TYPE_ORDER: readonly AssignmentType[] = ['assignment', 'reading', 'quiz', 'exam', 'paper', 'project', 'lab', 'presentation', 'review', 'other'];

export const TRUST_LABEL: Record<ConfidenceLevel, string> = { confirmed: 'Confirmed', likely: 'Looks likely', needsReview: 'Needs review' };

export function courseLabel(c: Pick<Course, 'code' | 'name'> | undefined): string {
  return c ? c.code ?? c.name : 'Course';
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatClock(ts: Timestamp, tz: string): string {
  const w = toWallClock(ts, tz);
  const h = w.hour % 12 || 12;
  return `${h}${w.minute ? `:${String(w.minute).padStart(2, '0')}` : ''} ${w.hour < 12 ? 'AM' : 'PM'}`;
}

export function formatDay(ts: Timestamp, tz: string, now?: Timestamp): string {
  if (now !== undefined) {
    const today = dayKeyIn(now, tz);
    const key = dayKeyIn(ts, tz);
    if (key === today) return 'Today';
    if (key === dayKeyIn(now + 86_400_000, tz)) return 'Tomorrow';
  }
  const w = toWallClock(ts, tz);
  return `${WEEKDAYS[w.weekday]} ${MONTHS[w.month - 1]} ${w.day}`;
}

export function formatDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const wd = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return `${WEEKDAYS[wd]} ${MONTHS[m! - 1]} ${d}`;
}

export const weekdayLong = (n: number) => WEEKDAYS_LONG[n]!;
export const weekdayShort = (n: number) => WEEKDAYS[n]!;

export function formatDue(dueAt: Timestamp | undefined, dateOnly: boolean | undefined, tz: string, now?: Timestamp): string {
  if (!dueAt) return 'No date yet';
  return dateOnly ? `Due ${formatDay(dueAt, tz, now)}` : `Due ${formatDay(dueAt, tz, now)}, ${formatClock(dueAt, tz)}`;
}

export function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

export function minuteLabel(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 || h === 24 ? 'AM' : 'PM'}`;
}

export function protectionCopy(result: ProtectionResult | undefined): { label: string; detail: string } {
  switch (result) {
    case 'activated':
      return { label: 'Protected', detail: 'Protection is on for this session.' };
    case 'simulated':
      return { label: 'Protection simulated', detail: 'This device can’t block apps, so protection is only simulated.' };
    case 'failed':
      return { label: 'Not protected', detail: 'Protection couldn’t start. Your study session is running anyway.' };
    case 'notRequested':
      return { label: 'No protection', detail: 'This session runs without app protection.' };
    default:
      return { label: 'Protection unknown', detail: 'Studyling can’t confirm protection for this session.' };
  }
}

export const START_CONTEXT_LABEL: Record<StartContext, string> = {
  beforeReminder: 'Started before the reminder',
  notificationAction: 'Started from the reminder',
  afterReminderWithoutAction: 'Started after the reminder',
  widget: 'Started from the widget',
  plannerOrApp: 'Started from Studyling',
  unscheduled: 'Unplanned session',
};

/** Secondary colour cue per course (always shown with the course's text label). */
export const COURSE_COLORS: readonly string[] = ['#5E41E0', '#1F8A55', '#C2410C', '#0369A1', '#B4237A', '#6B5B00', '#0F766E', '#7C3AED'];

export function courseColor(c: Pick<Course, 'id' | 'color'> | undefined, index = 0): string {
  return c?.color ?? COURSE_COLORS[index % COURSE_COLORS.length]!;
}
