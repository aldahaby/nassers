# iPhone Safari: PDF import device checklist

Automated tests run PDF import in Chromium, including at iPhone 13 size. **Chromium is not
Safari.** This checklist is for a person with a real iPhone. Record the iOS version and
results at the bottom, and don't mark PDF import "device-verified" until it has been done.

## Setup

1. Build the web app.
   - Normal build: `npx expo export --platform web`.
   - Test build, which also enables simulated Premium:
     `EXPO_PUBLIC_STUDYLING_TEST_PURCHASES=enabled npx expo export --platform web`.
2. Serve `dist/` over **HTTPS**, or open the Studyling preview link. Safari blocks some file
   APIs on plain-HTTP pages that aren't localhost.
3. On the iPhone, save these to the Files app (iCloud Drive or On My iPhone):
   - a real, text-based course syllabus PDF (one you can select text in when you open it in Files);
   - `src/core/__tests__/fixtures/pdf/chem2410-tables.pdf` (tables, 3 pages, two-column policies);
   - `psyc1010-two-column.pdf`, `scanned.pdf`, `encrypted.pdf`, `corrupt.pdf` and `mixed-scan.pdf`
     from the same folder.

## Steps

| # | Do | Expect |
|---|---|---|
| 1 | Open Studyling in Safari, finish onboarding, open **Planner → Add a course** | "PDF, Word or text file: Choose your syllabus from Files…" |
| 2 | Tap it, then pick the real syllabus PDF in the Files sheet | A "Reading page X of Y" message, then **Your course at a glance** within about 10 s for a 20-page PDF |
| 3 | Check the course card | Correct code, title, term, instructor(s), class days, time and room (where the syllabus has them) |
| 4 | Check the counts and the status line | "N assessments · X with a date · Y waiting for a date", and "N things to check" or "Everything we found is clear" |
| 5 | Tap **Next** and answer or skip each question | Each card disappears when answered, and nothing else changes |
| 6 | Tap **Next: preview your planner** | "With a date (X)" and "Waiting for a date (Y)", with dates that match the syllabus |
| 7 | Tap **Add N items to planner** | The planner shows "N assessments added", with Today's study plan, Upcoming deadlines, Waiting for a date and Courses |
| 8 | **Refresh the page** (pull down, or the reload button) | Everything is still there: assessments, course details, and any plan you accepted |
| 9 | Import the same PDF again | "Already imported", and nothing new is added |
| 10 | Import `chem2410-tables.pdf` | CHEM 2410, Riverbend University, Mon/Wed/Fri 9:30–10:20 AM in Ellis Hall 210, and the problem sets, lab report and both midterms with their dates |
| 11 | Import `psyc1010-two-column.pdf` | PSYC 1010, with Reading Responses 1 and 2, the midterm and the research proposal dated in 2027 |
| 12 | Import `scanned.pdf` | "This PDF is a scan (pictures of the pages)…", and nothing is imported |
| 13 | Import `encrypted.pdf` | "That PDF is password-protected…" |
| 14 | Import `corrupt.pdf` | "That file seems to be damaged…" |
| 15 | Import `mixed-scan.pdf` | Imports page 1; under Check it says "Page 2 couldn't be read" |
| 16 | Rotate to landscape on the review and the planner | No sideways scrolling, and nothing is clipped by the notch or home bar |
| 17 | Turn on VoiceOver and swipe through Stage A | Course name, counts and the Next button are all announced |
| 18 | Test build only: **Premium → Simulate Premium Purchase → Simulate purchase**, then refresh | "Status: Premium (test purchase, no charge)" survives the refresh; Expire, Restore, a failing purchase and Reset to Free all behave |

## Known limits on the web

- Only PDFs with a text layer can be read. There's no OCR in the browser, so scans are refused
  with a message rather than imported empty.
- PDF.js runs on the main thread (no web worker), which suits syllabus-length files. Very long
  PDFs are refused above 80 pages.
- On iOS versions older than Safari 16.4, the legacy PDF.js build should still work through its
  built-in polyfills, but this hasn't been tested.

## Results

| Date | Device | iOS / Safari | Steps passed | Notes |
|---|---|---|---|---|
| (not yet run) | | | | |
