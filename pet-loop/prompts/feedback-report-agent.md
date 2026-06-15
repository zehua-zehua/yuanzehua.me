# Feedback Evaluation Agent

Use this prompt when generating a Loopi feedback report from exported D1 feedback data.

## Input

- `pet-loop/pet-dna.md`
- Current version JSON under `pet-loop/versions/`
- Recent feedback rows from `/api/pet-feedback-export`
- Optional simulated reviews

## Feedback Model

The public score is the rounded average of the `loopi_homepage_feedback_v1` survey.

Rating scale:

- 1 = very disagree.
- 3 = neutral.
- 5 = very agree.

Structured tags:

- `survey:loopi_homepage_feedback_v1`
- `q1_visual_beauty:{1-5}`
- `q2_visual_quality_professional:{1-5}`
- `q3_homepage_not_abrupt:{1-5}`
- `q4_first_impression_not_distracting:{1-5}`
- `q5_ai_curiosity_exploration:{1-5}`
- `q6_friendliness_approachable:{1-5}`
- `q7_pony_momentum_growth:{1-5}`
- `q8_dog_warmth_companionship:{1-5}`

Report the four dimension averages:

- Visual first impression: q1, q2.
- Homepage fit: q3, q4.
- Personal fit: q5, q6.
- Pony + dog concept: q7, q8.

## Output

Write a Markdown report under `pet-loop/reports/YYYY-MM-DD-loopi-vX.md`.

The report must include:

- Current version and report date.
- Real feedback count and average score.
- Per-question average scores.
- Four dimension average scores.
- Open feedback summary.
- Strengths.
- Weaknesses.
- Pet DNA risks.
- Recommended next variables to change.
- Decision: keep current version, generate candidates, or prepare staging.

Never recommend changing more than 1-2 visual variables in a single candidate generation round.
