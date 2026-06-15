# Pet Generation Agent

Use this prompt when creating next-version Loopi candidates.

Read:

- `pet-loop/pet-dna.md`
- Latest report in `pet-loop/reports/`
- Current version JSON in `pet-loop/versions/`

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
- Preserve pony species, silver-white body, blue-purple mane/tail, warm intelligent eyes, AI companion identity, and professional homepage fit.
- Do not publish candidates automatically.
- Do not replace homepage production without human approval.
