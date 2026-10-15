import { conditionalRuleText, dayKeyIn, toWallClock, type Assignment, type AssignmentType, type ConfidenceLevel, type Course, type DraftItem, type ImportDraft, type ProtectionResult, type StartContext, type TermSeason, type Timestamp, type TrustStatus } from '@/core';

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

/** What Studyling knows about a value, in the student's words. */
export const TRUST_STATUS_LABEL: Record<TrustStatus, string> = {
  confirmedByYou: 'Confirmed by you',
  fromDocument: 'From your syllabus',
  inferred: 'Worked out from context',
  needsReview: 'Worth a quick check',
  conflicting: 'Syllabus disagrees',
  notSpecified: 'No date yet',
};

export function minuteRange(start: number | null, end: number | null): string {
  if (start === null) return '';
  return end === null ? minuteLabel(start) : `${minuteLabel(start)}–${minuteLabel(end)}`;
}

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

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 29" (no weekday: used when the year, and so the weekday, isn't known yet). */
export const monthDay = (month: number, day: number) => `${MONTHS_SHORT[month - 1]} ${day}`;

/** "23:59" → "11:59 PM". */
export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return minuteLabel((h ?? 0) * 60 + (m ?? 0));
}

export function seasonYear(season: TermSeason, year: number): string {
  return `${season[0]!.toUpperCase()}${season.slice(1)} ${year}`;
}

/** What a review row says about an item's date, in plain words. */
export function draftDueText(item: DraftItem, draft: ImportDraft): string {
  if (item.recurrence) return `Every ${WEEKDAYS_LONG[item.recurrence.weekday]}${item.dueTime ? ` · ${timeLabel(item.dueTime)}` : ''}`;
  if (item.dueDayKey) return `${formatDayKey(item.dueDayKey)}${item.dueTime ? ` · ${timeLabel(item.dueTime)}` : ''}`;
  if (item.conditional) return `Due ${conditionalRuleText(item.conditional)}`;
  if (item.dueOptions?.length) return `${item.dueOptions.length} possible dates`;
  if (item.reasons.includes('yearConflict') && item.writtenDate) return `${monthDay(item.writtenDate.month, item.writtenDate.day)} · year to confirm`;
  if (item.window) return `Exam period ${formatDayKey(item.window.from)} – ${formatDayKey(item.window.to)}`;
  if (item.reasons.includes('examPeriod')) return 'During the exam period (date not set yet)';
  if (item.reasons.includes('tba')) return 'Date to be announced';
  void draft;
  return 'No date given';
}

/** The same for a saved assignment that has no date yet. */
export function unresolvedText(a: Pick<Assignment, 'unresolved' | 'conditional' | 'dueCandidates'>): string {
  if (a.conditional && !a.conditional.anchorDayKey) return `Due ${conditionalRuleText(a.conditional)}`;
  if (a.dueCandidates?.length) return `${a.dueCandidates.length} possible dates: pick one`;
  if (a.unresolved === 'examPeriod') return 'During the exam period (date not set yet)';
  if (a.unresolved === 'tba') return 'Date to be announced';
  return 'No date yet';
}
