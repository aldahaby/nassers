# Studyling Planner: syllabus intelligence and study planning

Studyling helps students **plan → lock → study → retrieve → recover → adapt**. This document
describes what exists in the code today. Native-only parts are marked **UNTESTED** until an EAS
development build runs on a physical iPhone (see `NATIVE_IPHONE_TEST_PLAN.md`).

Evidence: `PLANNER_EVIDENCE.md`. Privacy: `PLANNER_PRIVACY.md`.

## 1. Status

| Area | Status |
|---|---|
| Parser, import review, planner, reminder policy, fading, retrieval, privacy (pure core) | Implemented, unit-tested (`src/core/__tests__/planner/`) |
| Planner store (persistence, Start & Lock, session recording, reminder sync) | Implemented, integration-tested (`src/state/__tests__/plannerStore.test.ts`) |
| Planner UI, Syllabus Lab, Planner QA | Implemented, browser-tested (web build, suite m12) |
| Local notifications (expo-notifications) | Wired; verified on web with the mock only. **UNTESTED on device** |
| PDF text + on-device OCR (`modules/studyling-native`, PDFKit + Vision) | Written. **UNTESTED, not compiled**. Web reads text files and pasted text only |
| Widget + Live Activity (`targets/widgets`) | Written. **UNTESTED, not compiled**. Web shows labelled mocks |
| Google Classroom / Canvas | Interfaces + fixtures only. No OAuth, no network, shown as "Coming later" |
| Share extension (email attachment) | Deferred. V1 email import = paste text, or save the attachment and pick it as a file |

## 2. Data model and persistence

Models: `src/core/models/syllabus.ts`, `planner.ts`, `retrieval.ts`. Normalised tables keyed by id
inside one **planner document** (`PlannerState`):

`courses`, `assignments`, `syllabi`, `plans` (SessionPlan), `reminderRules`, `scheduledReminders`,
`exposures` (each scheduled cue), `studySessions`, `retrievalItems`, `events` (local log, capped),
`progress` (UserProgress: reminder support), `preferences` (PlannerPreferences), `originals`
(only with the explicit "Keep original" opt-in), `pendingRetrieval`.

**Persistence decision.** The game save stays at **schema v8** (the audit found v8, not v7). The
planner is a separate document, `studyling/planner/v1`, with its own `plannerSchemaVersion` (1)
and migrator (`migratePlanner`). Semester-scale records never bloat the game save, and neither
migration depends on the other. Installing the planner changes nothing in an existing save (tested
from a v7 fixture through the v8 migration).

**One timer.** There is no second session system. The canonical `FocusSession` gained an optional
`study?: StudyContext` (course, assignment, plan, start source/context, protection requested and
the real protection result). Optional, so no save migration was needed. When a session ends, the
planner writes a durable `StudySession` (the save's focus history is bounded at 50).

## 3. Import pipeline

`SOURCE → TEXT EXTRACTION → NORMALISATION → CANDIDATES → DATES/TIMES → DEDUPE → CONFIDENCE/PROVENANCE → STUDENT REVIEW → PERSIST`

- **Sources:** PDF/file (`services/documents`), pasted email/text, manual entry. Classroom/Canvas
  types exist for the future.
- **Extraction (iOS, UNTESTED):** `StudylingNative.extractPdfText` uses PDFKit's embedded text per
  page; pages with fewer than 20 characters are rendered at 2× and read with Vision
  `VNRecognizeTextRequest` (accurate, language correction). Background queue, page by page, with
  progress events; max 80 pages. An in-memory cache (process lifetime only, never written to disk)
  avoids re-reading the same file in one session.
- **Parser** (`core/planner/syllabusParser.ts`, `syllabus-parser-1.0`): deterministic, no network.
  Normalises Unicode, splits table rows into cells (pipes, tabs, 3+ spaces), repairs OCR confusions
  inside date tokens (0ct → Oct, l6 → 16) and flags them, finds month-name / day-month / ISO /
  numeric dates (M/D unless the document proves D/M), 12- and 24-hour times, "noon"/"midnight",
  "week of", ranges, TBA and vague timing, weekly recurrences ("every Friday"), multi-line items
  ("Lab Report 2" + "Due: …"), multiple course headings, and infers years from the term
  ("Fall 2026" → January is 2027) or from explicit years; with no anchor every date needs review.
  Grading lines ("Quizzes 15%") and holidays are not assignments.
- **Dedupe:** same normalised title + same date → one candidate with every source location; two
  different dates → one candidate with both options ("conflicting"); a generic title repeated 3+
  times ("Quiz" weekly) → separate items.
- **Older parser** `syllabus-parser-0.9` (no table cells, no recurrences) is kept for Syllabus Lab
  comparison. Each syllabus records `parserVersion` and `contentHash` (SHA-256 of whitespace-
  normalised text). Same hash + same parser version for the same course = duplicate import
  (nothing changes).

## 4. Trust and review

Internal confidence per field (title, type, due) maps to three words: **Confirmed**, **Looks
likely**, **Needs review**. The parser never produces "Confirmed"; a field becomes confirmed when the
student edits it, taps "Looks right", or adds the reviewed item (commit confirms "likely" fields).
Reasons are plain sentences (`describeReason`), never percentages. Needs-review items can be saved
but **are never planned or reminded** (`isSchedulable` requires a reviewed date).

Review screen: course name, counts (found / need review / confirmed), each item editable (title,
type, date, time, effort 30m/1h/2h/4h+/Custom, include/exclude), the reason, the source location,
and an in-memory snippet. Effort is never inferred from titles. "Keep the original on this device"
is off by default.

## 5. Source authority and reconciliation

`USER OVERRIDE > LIVE LMS VALUE > REVIEWED STATIC SYLLABUS > UNREVIEWED PARSER SUGGESTION`
(`core/planner/sourceAuthority.ts`). Revised imports match existing items by a fingerprint of
course + normalised title (+ date for repeated generic titles): changed fields update in place,
student-edited fields become a visible **conflict** ("Keep mine" / "Use the new one"), items no
longer listed are flagged (kept by default), new items are added, nothing is duplicated. A moved
deadline cancels plans that now fall after it, and the reminder sync cancels their notifications.
LMS fixtures reconcile by external id the same way (`reconcileLmsCoursework`).

## 6. Planner algorithm (`core/planner/plannerService.ts`)

Inputs: reviewed deadline, the student's estimate, assignment type, weekly study windows
(default Mon–Thu 6–10 PM, Sun 1–6 PM; no calendar access), preferred block length (default 45),
already accepted plans, the planner time zone (DST-safe via `Intl`).

1. Earliest deadline first; skip completed, undated, needs-review or unestimated work.
2. Remaining = estimate − studied − already planned; blocks = ⌈remaining / preferred⌉, evenly sized.
3. Free time = study windows from now (15-minute boundaries) to deadline − 60 min, minus accepted
   and newly proposed blocks (10-minute gaps).
4. **Lead window**: the last max(4, 2 × blocks) usable days before the deadline. If it has enough
   days, blocks go on evenly spaced distinct days (exam prep gets several opportunities instead of
   one marathon). Otherwise blocks are placed round-robin across the days left (earlier days only if
   needed), so a tight deadline gets balanced evenings.
5. Whatever doesn't fit becomes a **capacity warning**: "You estimated about 4h remaining, but only
   2h currently fits before Friday." → Find more time (study windows) / Change estimate / I'll handle
   it. No red states, no guilt.

Plans are **proposed** first; the student accepts (all, or per assignment). Statuses: proposed,
accepted, rescheduled, completed, skipped, cancelled; "missed" is derived (90 min after start with no
session). These heuristics are Studyling hypotheses (PLANNER_EVIDENCE.md).

## 7. Reminders (`core/planner/reminderPolicy.ts`, `config/planner.ts`)

Local notifications only; permission is requested **only when the student turns reminders on**,
with "Studyling can remind you when a study block you planned is ready." Denied → the planner works
the same; a calm "Open device settings" path; no re-prompting.

- **Start cue** at each accepted plan's start: "Chemistry is ready. / Problem Set 4 · 45 min" with a
  **Start & Lock** action (Private mode: "A study block is ready / Study session · 45 min").
- **Planning digest** (Standard only) on days with ≥2 plans, 2 h before the first, not before
  8:00: "Tonight with Studyling / CHEM 101 · 45m / PSYC 210 · 30m".
- Never for raw imports, needs-review items, completed/deleted work, during quiet hours (default
  10:30 PM–7:30 AM), or during an active study session (scheduled cues inside the session are
  cancelled and foreground banners are hidden).
- Rolling 72 h horizon, ≤40 pending (iOS allows 64). Deterministic keys + a content signature make
  re-syncs idempotent across reloads (no duplicates); a privacy or title change reschedules.

### Reminder fading (EXPERIMENTAL, `fading-v1`)

Levels: **Standard** (digest + start cue), **Light** (start cue only), **Ambient** (no routine
start push; planner + widget). Observations are recorded once per plan: a session start (on time =
started before or within 15 min of the planned start; independent = see §8) or a miss (90 min
passed).

- Standard → Light: of the last 4 observed plans since the last change, ≥3 on time and ≥2
  independent.
- Light → Ambient: another 4, with ≥3 on time and ≥3 independent.
- Misses never escalate automatically. On Light/Ambient, ≥2 misses in the last 3 plans sets a
  **recovery offer**: "Want a little more help this week?" → Restore reminders / Keep it calm (not
  asked again for 7 days).
- Student preference wins: **Always remind me** (Standard), **Let Studyling adapt**, **Keep
  reminders minimal** (Light). The policy version is stored with the student's progress; a new
  version keeps the level and starts a fresh observation window.

Why experimental: the thresholds are Studyling's own starting guesses, not established findings
(PLANNER_EVIDENCE.md). They live only in config, versioned, so they can be studied and changed.

## 8. Start sources and independent starts

`startSource`: app, planner, notification, widget, liveActivity, manual. `startContext`:
beforeReminder, notificationAction, afterReminderWithoutAction, widget, plannerOrApp, unscheduled.

An **independent start** is a planned session started without relying on its start notification:
not from the notification action, and before any start cue for that plan was delivered. A cue
counts as delivered when the OS reported it (foreground delivery or a tap) or, because iOS doesn't
report background deliveries, once its fire time passed without being cancelled (conservative).
Unscheduled sessions count as independent but have no plan, so they don't affect fading.

## 9. One-tap Start & Lock

`plannerStore.startPlan(planId, source)` → `buildStudyContext` → the existing
`gameStore.startFocus(minutes, { study, protectionMode, continueWithoutProtection: true })` → the
existing protection service. The plan's `protectionProfileId` defaults to the student's Focus
protection setting. No timer choice, no confirmation dialog. Entry points: Planner "Start & Lock",
assignment "Start planned 45 min", the notification action, the widget deep link
`focusling://planner/start?plan=ID&source=widget`.

**Protection failure:** the session still starts, unprotected, and says "Not protected · Protection
isn't on for this session. Your study time still counts." Results are recorded truthfully:
`activated` only when the iOS protection service confirmed it, `simulated` for the web/dev mock
(the pill says "simulated, nothing is blocked on this device"), `failed` with the error, or
`notRequested`. The plain Focus screen keeps its previous behaviour (no silent unprotected start).

## 10. Retrieval (`core/planner/retrievalService.ts`)

Eligible plan types (config `RETRIEVAL_ELIGIBLE`): learn, reading, review, exam prep. Not: practice
(problem sets), writing, project, admin; sessions under 10 min; unplanned sessions. Offered once,
right after the reward screen: "Before you check your notes…" → **Brain dump** (write or think it
through, then "Check your notes." and Got it / Partly / Missed it), **Make a recall question**, or
**Not now**. Items (freeRecall / questionAnswer / concept) store prompt, optional answer, course,
assignment, source session, attempts, last result and a V1 `nextDueAt` (fixed 1/2/4 days by result,
not a spaced-repetition algorithm).

## 11. Future Stats instrumentation (no Stats UI yet)

Derivable from local records, without any "focus score": study time by course (`StudySession`),
planned vs completed (plans + sessions), start delay (actual − planned start), independent start
rate (`independentStart`, `startContext`), assignment lead time (first session vs due), study
spread (sessions per assignment across days), early-end rate (`outcome`), recovery after missed
plans (observations), retrieval attempts and result trend (`RetrievalItem.attempts`). Events
capture plan created/accepted/rescheduled/skipped/cancelled, reminder scheduled/cancelled/presented,
notification start action, session started, protection requested/activated/failed, session
completed/ended early, retrieval offered/completed/skipped, assignment completed, source updated,
support level changed. `actualFocusedMinutes` is protected/focused session time, not concentration.

## 12. Widget and Live Activity (UNTESTED)

- Extension: `targets/widgets` via the existing `@bacons/apple-targets` plugin (no separate config
  plugin was needed). Target `StudylingWidgets`, bundle id **`com.focusling.app.widgets`**, App
  Group `group.com.focusling.app`, iOS 16.4+. The plugin also declares it in
  `extra.eas.build.experimental.ios.appExtensions` (verified with `expo config`).
- Data: the app writes a minimal `WidgetSnapshot` (next plan id, course and assignment only in
  Detailed mode, start time, minutes, today's count/minutes, active session end + protection badge,
  pet species/stage) to the App Group and reloads timelines. Nothing else is shared.
- Small: Studyling · next course · time · Start. Medium: + assignment, duration, today summary,
  Start & Lock (deep link). Pet glyph is small; refresh only at the next plan start or hourly.
- Live Activity (`StudylingActivityAttributes`, identical copies in the module and the extension,
  test-enforced): Studyling, course/assignment if Detailed, countdown, protection status. Started,
  updated (only when content changes) and ended through the session lifecycle. No coins or shop.
- Lock Screen privacy: "Show study details on Lock Screen" (default **off** = Private). Applies to
  notifications, widget and Live Activity.

## 13. Android path (not built)

Domain logic is platform-independent. Android would use: Glance home-screen widget; the
POST_NOTIFICATIONS permission (Android 13+) asked at the same moment; an ongoing foreground
notification for the active session instead of a Live Activity (Android has no identical API);
WorkManager for periodic reminder re-sync; inexact alarms (no exact-alarm special access needed for
start cues).

## 14. LMS adapters (interfaces + fixtures only)

`core/planner/lmsAdapters.ts`: `LmsAdapter` (list courses, list published coursework with
due date/time, external id, updated time), `FixtureLmsAdapter`, synthetic fixtures, and
reconciliation. **Google Classroom (future):** read-only student scopes only
(`classroom.courses.readonly`, `classroom.coursework.me.readonly`); no roster, grading or teacher
scopes. **Canvas (future, deferred):** institution URL + an institution developer key, OAuth2 with
scoped endpoints (courses, assignments, calendar events); never manually generated personal tokens as
the consumer design. Tokens would live in the Keychain only (`SECRET_STORAGE`). The UI never claims a
connection.

## 15. Sync boundary

`SyncProvider` with `LocalOnlySyncProvider` (the only provider; never sends anything). Future
candidates: `ApplePrivateSyncProvider`, `EncryptedStudylingSyncProvider`. No accounts, servers or
keys exist.

## 16. Entitlements

`plannerCapabilitiesFor()` returns the effectiveness core as free for every tier: manual entry,
syllabus import, planner, local reminders, fading, Start & Lock, basic retrieval, basic widget.
Future candidates (continuous LMS sync, encrypted multi-device sync, advanced analytics) are not
built and are off for everyone. No purchases in this milestone. Student-promo types stay
future-only; no student ID capture.

## 17. Student-first changes and legacy identifiers

- Tabs: **Pet / Planner / Focus / Shop / Settings**; Play opens from the Pet screen; Stats hidden.
- New UI uses **Studyling**; iOS display name set via `CFBundleDisplayName: "Studyling"`.
- Family Mode is untouched (not expanded, not deleted); its save data is preserved.
- **Legacy technical identifiers kept** to avoid destabilising signing and native work: `expo.name`
  and slug `focusling`, bundle id `com.focusling.app` (and extension ids `com.focusling.app.*`),
  App Group `group.com.focusling.app`, URL scheme `focusling://`, storage keys `focusling/save/v1`,
  native modules `FocuslingProtection` / `FocuslingStore`, `FocuslingSharedState.swift`. New native
  code uses Studyling names (`StudylingNative`, `StudylingWidgets`).

## 18. Path changes from the brief

| Brief | Actual | Why |
|---|---|---|
| `app/planner/index.tsx` | `app/(tabs)/planner.tsx` | Planner is a tab; a second `/planner` route would collide |
| `plugins/withStudylingPlannerExtensions.ts` | `targets/widgets/expo-target.config.js` | The repo already builds extensions with `@bacons/apple-targets` |
| `native/ios/StudylingWidgets/` | `targets/widgets/` (+ `modules/studyling-native/ios`) | Same convention as the existing Screen Time extensions |
| session-history service | `FocusSession.study` + `PlannerState.studySessions` | Extends the existing timer; no parallel system |
| notification service | `services/notifications/` | New (no notification code existed) |

## 19. Developer tools

Settings → Developer tools → **Syllabus Lab** (fixtures, paste, source/time zone/parser version,
OCR damage / missing year / ambiguous date / revised / duplicate simulations, provenance, hash,
golden comparison) and **Planner QA** (simulated time ±1 h/day, semester scenarios, date changes,
notification and protection success/denial, Standard/Light/Ambient, independent/missed starts, fire
reminder → Start & Lock, start from widget, complete/end early, retrieval, mock widgets and Live
Activity, privacy inspector, local event log). The simulated clock is memory-only and refused
unless Developer tools are on.
