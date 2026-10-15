# Studyling Planner: privacy data flow

Studyling's planner is **local-first and local-only**. There is no account, no server, no
analytics and no AI service. The only provider in `services.sync` is `LocalOnlySyncProvider`, which
sends nothing.

## Data flow

```
Syllabus file / pasted text
   │  on-device only: PDFKit text, Vision OCR (iOS); text files/paste (web)
   ▼
Raw text  ── memory only (import draft) ──────────────► discarded on "Add" or "Cancel"
   │                                                     (kept on this device ONLY if the student
   ▼                                                      turns on "Keep the original")
Parser (deterministic, on device)
   ▼
Review screen (snippets shown, never saved)
   ▼
Planner document  studyling/planner/v1  (AsyncStorage / localStorage on this device)
   ├─ courses, assignments (title, type, dates, estimate, page/line provenance, content hash)
   ├─ plans, reminder rules, scheduled reminders, exposures
   ├─ study sessions (times, durations, outcome, start source, protection result)
   ├─ retrieval items (the student's own prompts/answers)
   ├─ Journey milestones (ids, dates, course ids; no text)
   ├─ course details (optional; identity, people, times, grading, topics, key dates; no policy text)
   └─ event log (ids, times, small codes; no titles or text)
   │
   ├─► Local notifications (OS): titles/bodies follow the Lock Screen setting
   ├─► Widget snapshot (App Group): minimal fields, see below
   └─► Live Activity: "Studyling" + "Study session · 45 min" (Private) or course · assignment (Detailed)
```

## Classification (`core/planner/privacy.ts › FIELD_CLASSIFICATION`)

| Data | Class | Notes |
|---|---|---|
| Raw syllabus text / OCR output | NEVER_PERSISTED | Memory only during review |
| Kept original (opt-in) | LOCAL | Explicit opt-in only |
| Review snippets | NEVER_PERSISTED | |
| Course name/code, assignment title | LOCAL · SYNC_ELIGIBLE · WIDGET_SHARED | Shared with widget/Live Activity only in Detailed mode |
| Dates, estimates, plans | LOCAL · SYNC_ELIGIBLE | Next plan time + minutes go to the widget |
| Study session records | LOCAL · SYNC_ELIGIBLE | No content |
| Retrieval prompts / answers / brain dumps | LOCAL · SYNC_ELIGIBLE | Never in notifications, widgets or logs |
| Event log | LOCAL | Never sent to analytics |
| Journey milestones / Stats | LOCAL | Derived on device; no analytics SDK |
| Hash, parser version, provenance | LOCAL · SYNC_ELIGIBLE | No source text |
| Widget snapshot | WIDGET_SHARED | 12 fixed keys (`WIDGET_SNAPSHOT_KEYS`) |
| Pet species + stage | WIDGET_SHARED | No name |
| Future LMS/OAuth tokens | SECRET_STORAGE | Keychain only; `serializePlannerState` strips token-like keys |
| Student ID images | NEVER_PERSISTED | Never collected |

"SYNC_ELIGIBLE" means a future, separately reviewed sync could carry it; nothing syncs today.

## Rules enforced in code and tests

- Raw syllabus and OCR text are absent from the serialised planner after commit (tests).
- Token-like keys (`accessToken`, `refreshToken`, `oauthToken`, …) never serialise (test).
- The game save contains no planner records, entitlement, friend, student-ID or verification data (tests).
- The widget snapshot contains only approved keys; Private mode removes course and assignment (tests).
- Private Live Activity shows "Study session · N min" (test). Notifications follow the same setting (test).
- The parser and import code never log text; the native extractor never logs text.
- Planner events hold ids, timestamps and small codes only (E2E checks no titles/notes in the log).
- Instructor/TA names, office hours and course details are extracted for review and saved only if
  the student keeps "Save course details" (local only). Email addresses are off by default and saved
  only on request. They never reach events, notifications, widgets or any shared space. No location, contacts, microphone or
  mailbox access. No Gmail OAuth. Email import is paste-only (or picking a saved attachment).
- Erase local data (Settings) removes the planner document and cancels scheduled reminders.

## Defaults

Lock Screen details **off** (Private). Keep original **off**. Reminders **off** until the student
turns them on. Notification sound is the system default and separate from in-app Sound Effects.
