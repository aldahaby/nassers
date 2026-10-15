# Syllabus Intelligence 2.0

Studyling reads a syllabus **on the device** and turns it into something the student reviews:
course details, deadlines, grading and weekly structure. Nothing is planned until the student
approves it. Everything is deterministic rules: **no AI model or backend is connected.**

```
file ──► core/documents (type check, DOCX, size/zip-bomb limits, readability)
     ──► stripRunningHeaders (repeated headers/footers, page numbers)
     ──► syllabusParser (deadlines: dates, times, release vs due, tentative, exam periods,
                        conflicts, recurrence, weights, stated time zones, explicit coverage)
     ──► syllabusInsights (course identity, people, office hours, class times, grading,
                           weekly topics, "X covers Weeks 1–5", key dates, policy headings)
     ──► import draft (trust status per item, revision matching, course-detail diffs)
     ──► student review ──► commit (planner schema 3) ──► Planner, Lock-In, Stats, Journey
```

## What it reads (and where)

| Format | Web preview | iPhone app |
|---|---|---|
| Plain text / pasted text | ✅ | ✅ |
| DOCX | ✅ (pure TypeScript ZIP + DEFLATE reader, `core/documents`) | ✅ (same code) |
| Text-based PDF | ❌ "read on the iPhone app" | PDFKit (`modules/studyling-native`), **not yet run on a device** |
| Scanned PDF | ❌ | Vision OCR per page, **not yet run on a device** |
| Photo of a page (JPEG/PNG/HEIC) | ❌ | Vision OCR (`extractImageText`), **not yet run on a device** |
| Legacy .doc, other files | ❌ "can't be read here" | ❌ |

- The type is decided from the file's bytes, not its name.
- Files over 15 MB are refused. DOCX archives have entry, size and compression-ratio limits, and
  encrypted files are refused.
- DOCX: only `word/document.xml` is read. Headers, footers, comments, macros and embedded
  objects are never read or run. Tables become `cell | cell` rows, and page breaks are kept.
- Text that is mostly unreadable (for example a bad scan) is **refused** with a clear message,
  rather than imported in part.
- Multi-column PDFs are read in the order PDFKit gives; columns may interleave. This is a known
  limitation.

## What it extracts (only when the syllabus states it)

| Area | Details |
|---|---|
| Course identity | Institution, code, title, term/year, section |
| People | Instructor(s) and TAs from labelled lines. Email only where written, and saved only if the student opts in |
| Times | Office hours (who, days, times, place) and class meetings (lecture/lab/tutorial, compact codes like MWF/TTh) |
| Deadlines | Assignments, quizzes, exams, papers, projects, labs, readings, presentations, with time, release date and weight on the line |
| Grading | Components and weights, including "8 × 4%". The total is checked, and a total that isn't 100% is shown, never "fixed" |
| Structure | Weekly topics and readings, explicit coverage ("Midterm covers Weeks 1–7", "Midterm (Chapters 1–4)") linked to those weeks' topics |
| Key dates | Drop/withdraw deadlines and no-class days are saved with the course, never as tasks |
| Policies | Headings only (e.g. "Late Work Policy"), with page. No policy text is stored |

## Date reasoning

- **Release vs due:** "released Aug 31, due Sept 11" sets the due date and records the release.
- **Missing year:** inferred from the term ("Fall 2026" → 2026, with January after a fall term
  going to the next year). Each inference is recorded and shown, e.g. "Year 2026 from
  “Fall 2026”" (status **Inferred from context**).
- **Tentative** dates ("tentative", "subject to change") need review.
- **Exam periods** ("during the final exam period, Dec 8–17") become a **window**, never a date.
  The assignment is saved as an unresolved requirement until the student adds the date.
- **TBA** dates ("date to be announced") are saved as unresolved requirements with no date.
- **Conflicts:** two dates for one item are both shown, and the student picks one.
- **Time zones:** "11:59 PM ET" is recorded. A zone that differs from the course zone is flagged
  for review.
- **Weekly activities** (tutorials every Thursday) are class meetings, not assignments.

## Trust statuses (no fake percentages)

| Status | Meaning |
|---|---|
| Confirmed by you | The student edited or confirmed it |
| Confirmed from document | Stated in the syllabus |
| Inferred from context | Worked out (e.g. the year), with the note shown |
| Needs your review | Ambiguous, tentative, time zone, OCR damage… (the reason is shown in words) |
| Conflicting information | The syllabus gives two different values |
| Not specified | The syllabus doesn't say (TBA, exam period only) |

Each item shows its source page and line. During review it also shows the original line as a
quote; that quote is held in memory only and never saved.

## Review → planner

- The student can edit the course details (institution, section), choose whether to save them,
  and choose whether to include email addresses (off by default).
- Each item can be edited, confirmed, excluded or have a conflict resolved, and grading,
  structure and key dates can be reviewed. "Cancel import" changes nothing.
- On commit:
  - Assignments keep their provenance, weight, release date, exam window, coverage and inference
    notes.
  - The course keeps its `details`.
  - Lecture times fill `meetingSchedule` if that was empty.
- **Three kinds of things stay distinct in the UI:**
  - course requirements ("Course requirement · from your syllabus");
  - Studyling's suggestions (study blocks, and the exam "Suggestion from Studyling · not from
    your instructor" card);
  - the student's own tasks ("Added by you").
- No tasks are created automatically and no study length is assumed. Planning still needs the
  student's own estimate.

## Revised syllabi

Re-importing the same file is a no-op (same content hash and parser version). A revised syllabus
shows the following before anything changes:

- **Items:** new, changed (old → new), unchanged, and no longer listed (kept by default; the
  student chooses).
- **Possible matches:** a new item that looks like a removed one is offered as "Is this the same
  as …?". This triggers on title similarity, or on the same type plus the same leading word plus
  a due date within 14 days (`REVISION_MATCH`). "Same item" updates the existing assignment, so
  study history is kept and no duplicate is created. "Different" keeps both. Nothing is merged
  silently.
- **Course details:** grading weight changes, added or removed components, weekly topic changes,
  and people or class-time changes.
- **The student's edits win.** A source change to an edited field becomes a visible conflict
  (`applySourceUpdate`).

## Lock-In, Stats, Journey, pets

- "Start & Lock now" on an assignment starts the existing focus session with the course and
  assignment attached. The running session shows "Studying: CS 1301 · Homework 2".
- The finished session is one `StudySession` record. Stats counts it once, capped to real elapsed
  time, under its course. An assignment's "Studied" minutes use the same rule.
- Studying never completes a task. Only "Mark as done" does.
- New Journey milestones (each stored once):
  - "First syllabus task completed";
  - "First Lock-In for a specific task";
  - "Started preparing for an exam".

  "Imported your first syllabus" already existed. Repeated imports never re-award.
- **Pets:** importing gives no coins or XP. Rewards still come only from focus sessions and
  missions.

## Course Spaces (future, data only)

`courseSpaceKeyOf(identity)` gives `institution/term/code`, plus an optional section. It is null
unless all three parts are known, and it always includes the institution, so the same code at two
universities never matches. Nothing is published, shared or joined.

## AI architecture

`services.syllabusAnalysis` is the `LocalSyllabusAnalysisProvider` (on device).
`UnavailableRemoteSyllabusAnalysisProvider` documents the future boundary: it refuses without
explicit consent and is unavailable without a backend. A real remote model needs:

- a Studyling backend that holds the model key (never the app);
- a per-import disclosure screen;
- no retention by default;
- results going through the same review.

No mock AI output is ever shown as real.

## Code map

- `core/documents/`: `inflate`, `zip`, `docx`, `documentText` (sniff, readability, headers)
- `services/documents/readDocument.ts`: the shared reader used by the web and iOS services
- `core/planner/syllabusParser.ts` (parser 2.0), `syllabusInsights.ts`, `syllabusImport.ts`,
  `courseIdentity.ts`
- `config/documents.ts`, `config/planner.ts` (`TENTATIVE_WORDS`, `RELEASE_WORDS`,
  `ZONE_ABBREVIATIONS`, `REVISION_MATCH`)
- UI: `features/planner/SyllabusReview.tsx`, `CourseInsightsReview.tsx`, `CourseDetail.tsx`
  (route `planner/course/[id]`), `AssignmentDetail.tsx`, and the `features/focus/ActiveSession`
  study line
- Fixtures: `core/planner/fixtures/courseOutlines.ts` (synthetic US and Canadian outlines)
- Tests: `core/__tests__/documents/*`, `core/__tests__/planner/insights.test.ts`,
  `intelligence.test.ts`, `stats/journey.test.ts`, `state/__tests__/plannerStore.test.ts`,
  browser suite m14

## Limitations

- PDF, scanned PDF and photo reading are iOS-only and have **not been run on a device**.
- Rules recognise common English layouts (US/Canadian). Unusual layouts, non-English syllabi and
  multi-column PDFs can miss items; review is always required.
- People, office hours and grading are read from labelled lines and grading sections. Free-form
  prose may be missed and is then shown as "Not specified".
- Exam coverage is linked only when written explicitly.
