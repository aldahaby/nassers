# Studyling Planner: evidence ledger

**Evidence for a psychological principle ≠ evidence that Studyling's implementation works.**
Nothing here claims that Studyling improves grades or learning. Studyling has not been evaluated.
Use this ledger to keep product copy honest.

| Feature | Underlying idea | Classification | What Studyling actually does |
|---|---|---|---|
| Post-session retrieval (brain dump, recall questions) | Retrieval practice ("testing effect") | **STRONG UNDERLYING EVIDENCE** (many lab and classroom studies; e.g. Roediger & Karpicke 2006; Dunlosky et al. 2013 review) | A short, optional, student-made recall step after eligible sessions. Effect of *this* prompt is unknown. |
| Spreading an assignment's blocks across days | Distributed / spaced practice | **STRONG UNDERLYING EVIDENCE** (e.g. Cepeda et al. 2006; Dunlosky et al. 2013) | Even spacing inside a lead window before the deadline. No claim that any interval is optimal. |
| Planned blocks with a time and a one-tap start | Implementation intentions / cue-action planning | **PROMISING / CONTEXT DEPENDENT** (Gollwitzer & Sheeran 2006 meta-analysis; effects vary by population and task) | Accepted plans with a start cue and Start & Lock. |
| Notifications / reminders | Prompts and reminders | **CAUTION / MIXED** (can help initiation; habituation, annoyance and dependence are real risks) | Few reminders, quiet hours, no reminders during study, digest only on busy days, fading. |
| The exact planning heuristic (lead window, block sizes, buffers) | — | **STUDYLING HYPOTHESIS** | `config/planner.ts › PLANNER_RULES` |
| Reminder fading thresholds (3/4 on time, 2/4 then 3/4 independent) | Fading prompts to build self-initiation | **STUDYLING HYPOTHESIS** | `REMINDER_FADING_POLICY` (versioned, `fading-v1`) |
| One-tap protected start reduces start friction | — | **STUDYLING HYPOTHESIS** | Start & Lock |
| Pet-assisted initiation | — | **STUDYLING HYPOTHESIS** | The pet keeps the student company; no study claim |

## Copy rules

- Don't say "proven", "science-backed results", or "improves grades".
- Acceptable: "Trying to recall without looking is a well-studied way to strengthen memory." Not
  acceptable: "Studyling will raise your grades."
- Reminder adaptation is described to students as an experiment ("Adapting is an experiment").
- Session minutes are "protected/focused session time", never "concentration".
- No "Focus Score".

## Measuring it later (no Stats UI in this milestone)

The local records support honest evaluation: start delay, independent-start rate, planned vs
completed, early-end rate, recovery after misses, retrieval attempts and self-rated results, all by
policy version. Any study needs consent and its own privacy review; nothing is collected today.
