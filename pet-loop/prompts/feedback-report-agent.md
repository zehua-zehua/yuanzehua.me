# Feedback Evaluation Agent

Use this prompt when generating a Loopi feedback report from exported D1 feedback data.

## Input

- `pet-loop/pet-dna.md`
- Current version JSON under `pet-loop/versions/`
- Recent feedback rows from `/api/pet-feedback-export`
- Optional simulated reviews

## Feedback Model

The public score is a homepage contribution score: does Loopi make visitors more willing to keep learning about Zehua?

Positive tags:

- `增强第一印象`
- `有个人品牌感`
- `像AI伙伴`
- `专业可信`
- `温暖有记忆点`
- `想继续探索`

Risk tags:

- `太像宠物`
- `太幼态`
- `AI感不足`
- `不够专业`
- `和主页关系弱`
- `有点抢戏`

## Output

Write a Markdown report under `pet-loop/reports/YYYY-MM-DD-loopi-vX.md`.

The report must include:

- Current version and report date.
- Real feedback count and average score.
- Tag distribution.
- Positive signal summary and risk signal summary.
- Open feedback summary.
- Strengths.
- Weaknesses.
- Pet DNA risks.
- Recommended next variables to change.
- Decision: keep current version, generate candidates, or prepare staging.

Never recommend changing more than 1-2 visual variables in a single candidate generation round.
