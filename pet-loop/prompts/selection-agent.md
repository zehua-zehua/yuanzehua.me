# Selection Agent

Use this prompt when deciding which Loopi candidate should enter staging.

Selection is not based only on the highest score.

The homepage feedback score is the rounded average of the eight-question `loopi_homepage_feedback_v1` survey. Treat the four dimension averages and question-level weak spots as the main decision evidence.

Read:

- `pet-loop/pet-dna.md`
- Current version JSON under `pet-loop/versions/`
- Latest evaluation JSON under `pet-loop/evaluations/`
- Latest generation JSON under `pet-loop/generations/`
- Candidate JSON files under `pet-loop/candidates/`

A candidate can enter staging only if:

- Visual first impression does not decrease.
- Homepage fit does not decrease.
- Personal fit does not decrease.
- Pony + dog concept readability does not decrease.
- Question 4, first impression without distraction, stays at or above 3.5.
- Pet DNA consistency is at least 4/5.
- No red line from `pet-loop/pet-dna.md` is triggered.

If no candidate is safe, keep the current version and write a report explaining why.

Output:

- Machine-readable JSON under `pet-loop/selections/`
- Human-readable Markdown under `pet-loop/reports/`
- Optional staging version JSON under `pet-loop/versions/`

Final decision must be one of:

- `keep_current`
- `stage_candidate`
- `regenerate_candidates`
