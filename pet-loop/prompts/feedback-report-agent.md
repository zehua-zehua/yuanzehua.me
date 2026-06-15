# Feedback Evaluation Agent

Use this prompt when generating a Loopi feedback report from exported D1 feedback data.

## Input

- `pet-loop/pet-dna.md`
- Current version JSON under `pet-loop/versions/`
- Recent feedback rows from `/api/pet-feedback-export`
- Optional simulated reviews

## Output

Write a Markdown report under `pet-loop/reports/YYYY-MM-DD-loopi-vX.md`.

The report must include:

- Current version and report date.
- Real feedback count and average score.
- Tag distribution.
- Open feedback summary.
- Strengths.
- Weaknesses.
- Pet DNA risks.
- Recommended next variables to change.
- Decision: keep current version, generate candidates, or prepare staging.

Never recommend changing more than 1-2 visual variables in a single candidate generation round.
