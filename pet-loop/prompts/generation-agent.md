# Pet Generation Agent

Use this prompt when creating next-version Loopi candidates.

Read:

- `pet-loop/pet-dna.md`
- Latest report in `pet-loop/reports/`
- Current version JSON in `pet-loop/versions/`

Use the `loopi_homepage_feedback_v1` survey as the diagnosis map:

- q1/q2 low: improve visual beauty or professional material quality.
- q3/q4 low: improve homepage fit or reduce attention stealing.
- q5/q6 low: improve curiosity, AI exploration signal, friendliness, or approachability.
- q7/q8 low: improve pony momentum or dog-like warmth without becoming a literal animal mascot.

Generate exactly 3 candidate JSON files under `pet-loop/candidates/`.

Each candidate must include:

- `candidate_id`
- `based_on_version`
- `candidate_name`
- `changed_variables`
- `expected_improvement`
- `risk_to_watch`
- `prompt`

Rules:

- Change only 1-2 variables per candidate.
- Every candidate must name the survey question or dimension it is trying to improve.
- Preserve virtual AI companion identity, pony-origin momentum, silver-white body, blue-purple hair or tail-like energy, warm intelligent eyes, subtle AI markings, and professional homepage fit.
- Do not return to literal four-legged pony anatomy or drift into a generic puppy mascot.
- Do not publish candidates automatically.
- Do not replace homepage production without human approval.
