# Homepage Pet Evolution System Agent Guide

Last local update: 2026-06-15

## System Definition

Homepage Pet Evolution System is the Loopi evolution loop deployed on `yuanzehua.me`.

It is not just a pet image. It is a personal-brand AI companion system that uses homepage feedback, simulated visitor review, Codex-generated candidates, evaluation agents, and human approval to keep Loopi evolving without weakening the main personal homepage.

## Current Deployment Snapshot

- Production site: `https://yuanzehua.me`
- Pet Lab: `https://yuanzehua.me/pet-lab/`
- Active version: `loopi_v0_2`
- Active display name: `Loopi v0.2 Companion`
- Active image: `/assets/images/pets/loopi/v0-2/loopi-v0-2.webp`
- Public summary API: `/api/pet-feedback-summary?version=loopi_v0_2`
- Admin export API: `/api/pet-feedback-export?version=loopi_v0_2`
- Database: Cloudflare D1 database `homepage_pet`
- Pages binding: `PET_DB`
- Required secrets: `PET_ADMIN_TOKEN`, `PET_HASH_SALT`

Latest production check:

- Homepage contains the v0.2 Loopi display module, compact feedback status, and Pet Lab entry.
- Pet Lab contains the 8-question `Loopi 首页反馈问卷 v1.0`, `Homepage Evaluation Model`, dimension scores, v0.2 status, and v0.3 candidate queue.
- Active WebP image returns HTTP 200.
- Public summary API returns JSON with total, question, and dimension scores.
- Export API returns 401 without admin token.

## Current Architecture

Keep the MVP deliberately simple.

- Static homepage and Pet Lab are plain HTML.
- Cloudflare Pages Functions provide the feedback API.
- Cloudflare D1 stores only real feedback rows.
- Loopi versions, candidate prompts, reports, and Pet DNA stay in git.
- No ORM, no complex relational version tables, no Next.js migration in the MVP.

Important files:

- `index.html` - homepage Loopi display and compact Pet Lab entry.
- `pet-lab/index.html` - Pet Lab dashboard, feedback form, and system explanation.
- `assets/pet-feedback.js` - frontend feedback submit and summary loading logic.
- `functions/api/pet-feedback.js` - public feedback submit API.
- `functions/api/pet-feedback-summary.js` - public aggregate summary API.
- `functions/api/pet-feedback-export.js` - admin-only raw export API.
- `pet-loop/db/schema.sql` - minimal D1 schema.
- `pet-loop/pet-dna.md` - stable Loopi identity and red lines.
- `pet-loop/versions/` - version records.
- `pet-loop/candidates/` - candidate records and prompts.
- `pet-loop/reports/` - iteration reports.
- `pet-loop/prompts/` - agent prompts.
- `scripts/generate-pet-report.js` - pulls deployed feedback and writes local reports.

## Data Rules

The online database should stay minimal until the loop proves useful.

Current production table:

- `pet_feedback`

Fields stored:

- `version_name`
- `score`
- `tags` for survey schema and structured per-question scores
- `free_text_feedback`
- `page_path`
- `visitor_id_hash`
- `source`
- `created_at`

Privacy rules:

- Do not store email, phone, name, or raw IP.
- Do not expose raw text feedback through public APIs.
- Public pages may read only aggregate summary data.
- Raw export requires `PET_ADMIN_TOKEN`.
- Do not submit fake production feedback during QA unless the user explicitly asks for it.
- Keep the online database at one table; do not add separate question tables for the MVP.

## Active Evaluation Model

The homepage score is not a generic cuteness score. It uses `Loopi 首页反馈问卷 v1.0`.

Placement rule:

- Keep the full 8-question form inside Pet Lab.
- The homepage should stay a lightweight display and entry point, with only compact summary metrics.
- Do not place the long questionnaire in the homepage right column; it disrupts the homepage layout and leaves the main content visually unbalanced.

Rating scale:

- 1 = 非常不同意
- 3 = 一般
- 5 = 非常同意

Database storage:

- `score` stores the rounded average of the 8 questions.
- `tags` stores one schema tag and eight structured score tags.
- Example: `survey:loopi_homepage_feedback_v1`, `q1_visual_beauty:5`.

Question groups:

A. 视觉第一印象

- Q1: Loopi 整体看起来是好看的。
- Q2: Loopi 的视觉质感适合一个专业个人主页。

B. 主页适配度

- Q3: Loopi 放在 `yuanzehua.me` 首页不会显得突兀。
- Q4: Loopi 会增强我对站主的第一印象，而不是分散注意力。

C. 个人气质匹配

- Q5: Loopi 让我觉得站主是一个有好奇心、愿意探索 AI 的人。
- Q6: Loopi 让我觉得站主有亲和力，也比较容易交流。

D. 小马 + 小狗设定

- Q7: Loopi 能让我感受到“小马”的行动力、成长感和向前感。
- Q8: Loopi 能让我感受到“小狗”式的亲和、快乐和陪伴感。

Red lines:

- Any A-D dimension drops below the current version.
- Q2 professional visual quality is below 3.5.
- Q4 first impression / attention balance is below 3.5.
- Q7 or Q8 repeatedly falls below 3.3, meaning the hybrid pony + puppy concept is not readable.
- Loopi becomes a generic pet, generic puppy, literal pony, toy, NFT mascot, or generic robot.
- Loopi steals attention from the homepage owner.
- Pet DNA consistency is below 4/5.

## Agent Roles

### Feedback Evaluation Agent

Purpose:

- Read real feedback from the deployed APIs.
- Compute total score, 8 question averages, and A-D dimension averages.
- Summarize open text feedback without exposing private/raw data publicly.
- Write a Markdown report under `pet-loop/reports/`.

Inputs:

- `pet-loop/pet-dna.md`
- Active version JSON under `pet-loop/versions/`
- `/api/pet-feedback-summary`
- `/api/pet-feedback-export` with `PET_ADMIN_TOKEN`

Output:

- Feedback count, average score, question averages, dimension averages, open-feedback summary, strengths, weaknesses, Pet DNA risks, and next recommended variables.

### Simulated Visitor Agent

Purpose:

- Add evaluation signal when real feedback is low.

Use when:

- Real feedback is below 20 rows for the active version.
- A candidate needs review before user traffic is available.

Recommended simulated personas:

- AI product leader.
- Hiring manager or recruiter.
- Product designer.
- Frontend or AI engineer.
- Startup founder or potential collaborator.
- General homepage visitor.

Each persona should answer the same 8-question survey, then add one short comment about the single highest-risk dimension.

### Insight Agent

Purpose:

- Turn feedback into a next-round strategy.

Rules:

- Identify the weakest question or dimension before proposing changes.
- Preserve stable Pet DNA.
- Recommend only 1-2 changed visual variables per round.
- Explain why the change should improve the homepage role.

### Pet Generation Agent

Purpose:

- Generate next candidate prompts or assets.

Rules:

- Never replace homepage production directly.
- Generate exactly three candidates unless the user asks otherwise.
- Each candidate changes only 1-2 variables.
- Every candidate must name the survey question or dimension it is trying to improve.
- Preserve the active version's core identity.
- Save candidate records under `pet-loop/candidates/`.
- If raster assets are generated, save source and optimized WebP under `assets/images/pets/loopi/`.

Current v0.3 candidate lanes:

- `Avatar Maturity`
- `ENFP Warmth`
- `AI Product Cue`

Question-to-candidate mapping:

- Q1/Q2 low: improve beauty, finish, material quality, or professional polish.
- Q3/Q4 low: improve homepage fit, scale, pose, or attention balance.
- Q5/Q6 low: improve curiosity, AI exploration signal, warmth, and approachability.
- Q7/Q8 low: tune pony momentum or dog-like companionship without becoming a literal animal.

### Selection Agent

Purpose:

- Decide which candidate can enter staging.

Selection is not based only on the highest score. A candidate can enter staging only if:

- Visual first impression does not decrease.
- Homepage fit does not decrease.
- Personal temperament fit does not decrease.
- Pony + puppy concept readability does not decrease.
- Q4, first impression without distraction, stays at or above 3.5.
- Pet DNA consistency is at least 4/5.
- No red line is triggered.

### Deploy Agent

Purpose:

- Publish the chosen version safely.

Deployment levels:

- `staging`: Pet Lab only.
- `production`: homepage replacement.

Rules:

- MVP automation may update Pet Lab.
- Homepage production replacement requires explicit human approval.
- Keep rollback path by preserving previous version records and assets.
- After production deploy, verify homepage, Pet Lab, asset URL, and summary API.

### Scheduler Agent

Purpose:

- Define periodic loop cadence.

Recommended cadence for MVP:

- Weekly: read feedback and generate a report.
- When real feedback is low: run simulated visitor review.
- After each report: decide whether to create v0.3 candidate assets.
- After any production change: run a 24-hour follow-up report.

## Local Verification Checklist

Before committing Loopi changes:

1. Run `node scripts/build.js`.
2. Run `node --check assets/pet-feedback.js`.
3. Run `node --check scripts/generate-pet-report.js`.
4. Validate JSON files in `pet-loop/versions/` and `pet-loop/candidates/`.
5. Run `git diff --check`.
6. Preview homepage and Pet Lab locally.
7. Confirm no horizontal overflow on mobile.
8. Confirm the Pet Lab feedback form uses the active version name.

After deploying:

1. Confirm homepage contains the active version.
2. Confirm Pet Lab contains the active version and evaluation model.
3. Confirm active asset returns HTTP 200.
4. Confirm public summary API returns JSON.
5. Confirm export API rejects unauthenticated access.

## Next To Do

Immediate:

1. Collect the first real feedback rows for `loopi_v0_2`.
2. Run `scripts/generate-pet-report.js loopi_v0_2` once `PET_ADMIN_TOKEN` is available locally.
3. If real feedback remains below 20 rows, run a simulated visitor review using the six personas above and the same 8 questions.
4. Turn the weakest question or dimension into a v0.3 decision: keep current version, generate visual candidates, or adjust feedback questions.
5. Generate real v0.3 candidate images only after a report identifies which question-driven variable should change first.

Near term:

1. Add a Pet Lab candidate comparison section once v0.3 images exist.
2. Add a lightweight version timeline fed from version JSON files instead of hardcoded page text.
3. Add a local report template for question averages, dimension averages, and next-variable decisions.
4. Add a manual rollback note for restoring `loopi_v0_1` or earlier assets if needed.
5. Consider a read-only admin summary command that prints feedback without requiring the user to inspect D1 manually.

Later:

1. Add multiple expressions or a small sprite sheet.
2. Add hover or scroll-aware micro-interactions.
3. Add staging-only candidate publishing before homepage replacement.
4. Add automated PR creation for approved candidate updates.
5. Explore Spline, Three.js, or GLB only after the static feedback loop is useful.

## Operating Principle

Every Loopi change must have a reason.

Do not evolve Loopi because a new image is prettier. Evolve it because feedback, simulated review, or a clear product diagnosis shows that the change improves the homepage role while preserving professional trust and Pet DNA.
