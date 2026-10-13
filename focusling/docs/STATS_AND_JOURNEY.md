# Stats & Journey

Stats answers "what did I actually do?" and Journey answers "how far have I come?". Both are built
only from records the app already keeps. Nothing is estimated, back-filled or invented, and both
are fully **Free**.

## Where the data comes from

| Source | What it holds | Limits |
|---|---|---|
| Planner `studySessions` (`studyling/planner/v1`) | One durable record per finished focus session since the planner was installed: start, credited minutes, outcome, course/assignment, plan, start source | None (grows with use) |
| Game save `focus.history` | Recent finished `FocusSession`s, including ones from before the planner existed, and the growth stage a reward reached | Last 50 sessions (`FOCUS_CONFIG.historyLimit`) |
| Planner `assignments` | `status: 'completed'` + `completedAt` | Reopened or deleted tasks drop out of Stats |
| Game save `stats` (lifetime counters) | Total completed sessions and credited minutes | Totals only; used to detect older history, never charted |

`buildSessionRecords` merges the two session sources into one `FocusSessionRecord` per FocusSession
id (planner record wins; duplicates are impossible). Active sessions are never records.

### Recorded minutes

`recordedMinutes = min(credited minutes, real elapsed minutes)` (`recordedMinutesFor`).

- A session that finished while the app was closed is stored with `endedAt` = the reopen time. Stats
  uses `startedAt + recordedMinutes` as the end, so it isn't stretched over hours.
- A developer "complete now" credits the planned time immediately; Stats counts only the real
  seconds (shown as "under 1 min").
- Ended-early sessions count their real focus time but are labelled **Ended early** and are never
  counted as completed sessions.

### Days, weeks, time zones

Days are local calendar days in the planner's time zone (the device zone). A day runs from local
midnight to the next local midnight, so DST days are 23 or 25 real hours. A session that crosses
midnight is split between the days by real elapsed time (`splitByDay`; the parts always add up).
Weeks start on Monday (`STATS_CONFIG.weekStartsOn`).

## Stats screen (`features/stats`, Stats tab)

- **Overview tiles**: today's focus time, this week's focus time, sessions completed this week,
  tasks done this week.
- **Days studied in the last 7**: not a streak. Nothing resets; rest days are called normal.
- **Weekly chart**: seven dated bars, the week's own largest day sets the scale, future days marked
  "still to come", empty days shown as "–". Page back through every week with records (Free).
- **By course**: focus time, completed sessions and task completions per course. Time without a
  course is shown as "Not linked to a course", never guessed.
- **Progress over time**: totals since the first record, 4 weekly rows (12 with the
  `canUseExtendedStats` capability), and "N of M Planner tasks done".
- **Recent sessions**: date, time, duration, course and status, paged.
- Honesty notes: focus time ≠ concentration; older sessions the pet remembers but whose details
  weren't kept; Stats stay on the device.

The tab bar is now Pet / Planner / Focus / **Stats** / Settings. The Shop opens from the Pet
screen (its route is unchanged).

## Journey

Milestones are stored in the planner document (`journey`, planner schema 2), once each, and are
never removed, re-awarded or re-dated (`evaluateJourney`). They are evaluated on every planner
commit and when the pet's XP changes.

| Milestone | Comes from |
|---|---|
| First focus session; 5/10/25/50/100/250 sessions | Completed session records (+ lifetime counter for older ones) |
| 1/5/10/25/50/100 hours of focus time | Recorded minutes (+ older lifetime minutes) |
| First task; 5/10/25/50 tasks | Completed planner assignments |
| First course, first syllabus | `course.createdAt`, `syllabus.importedAt` |
| First planned block, first independent start | Planner study sessions |
| First recall practice | `retrievalCompleted` event |
| First session per course | Course-linked completed records |
| Pet grew to Young / Adult / Evolved | The session whose reward reached the stage, or the moment it was seen happening |

**Dates are never guessed.** When the lifetime counters show a milestone happened before detailed
records existed (or a pet stage was already reached when Journey started), `achievedAt` is `null`
and the timeline says "Before Journey began".

**Deliberately absent:** streaks, daily-login rewards, longest-session or "study longer" goals,
missed-day penalties, comparisons with other people.

## Free vs Premium

Free: everything above (today/week, weekly chart, all past weeks, sessions, tasks, course
breakdown, full history, Journey, pet progression). A student's own records are never paywalled.

Premium (later, only where data supports it): longer-range trends (`canUseExtendedStats`, 12 weeks
today), custom ranges, exports, richer Journey visuals. Not built: exports, custom ranges.

## Code map

- Models: `core/models/studyStats.ts`
- Pure logic: `core/stats/` (`sessionRecords`, `aggregations`, `journey`, `studyData`)
- Config: `config/stats.ts`, `config/journey.ts`
- State: `state/planner.ts › useStudyData`, `createPlannerStore` (Journey on commit)
- UI: `features/stats/` (`StatsScreen`, `WeekChart`, `JourneyView`, `statsCopy`)
- Tests: `core/__tests__/stats/*`, `state/__tests__/plannerStore.test.ts` (Journey), browser suite m13

## Known gaps

- Sessions from before the planner existed are detailed only for the last 50 in the game history.
- `DailyStats` (60 days, no course) is not used, to avoid double counting.
- No pause/resume or distinct "interrupted by the system" status exists; there are only Completed
  and Ended early.
- Pet stages reached before Journey began have no date.
