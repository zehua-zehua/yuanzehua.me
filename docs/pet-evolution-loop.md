# Homepage Pet Evolution Loop

This is the lowest-complexity automation layer for Loopi.

The loop is file-based. It reads Cloudflare D1 feedback through existing APIs, writes reports and candidate JSON files into the repository, and never publishes a new pet asset without human approval.

## Agents

The MVP loop has four agents:

1. Feedback Collector Agent
2. Evaluation Agent
3. Generation Agent
4. Selection Agent

They run in order:

```text
feedback -> evaluation -> generation -> selection
```

## Local Run

```bash
node scripts/run-pet-evolution-loop.js loopi_v0_2
```

Optional protected export:

```bash
PET_ADMIN_TOKEN=your-token node scripts/run-pet-evolution-loop.js loopi_v0_2
```

By default, raw visitor text is not saved. To include short redacted samples in the local snapshot:

```bash
PET_LOOP_INCLUDE_REDACTED_TEXT=1 PET_ADMIN_TOKEN=your-token node scripts/run-pet-evolution-loop.js loopi_v0_2
```

## Individual Agent Runs

```bash
node scripts/run-pet-feedback-collector.js loopi_v0_2
node scripts/run-pet-evaluation.js loopi_v0_2
node scripts/run-pet-generation.js loopi_v0_2
node scripts/run-pet-selection.js loopi_v0_2
```

## Generated Files

- `pet-loop/feedback/`: public-safe feedback snapshots.
- `pet-loop/evaluations/`: machine-readable evaluation decisions.
- `pet-loop/generations/`: candidate generation batch metadata.
- `pet-loop/selections/`: machine-readable selection decisions.
- `pet-loop/reports/`: human-readable reports.
- `pet-loop/candidates/`: generated candidate prompts.
- `pet-loop/versions/*_staging.json`: staging recommendation only.

## Safety

- No raw comments are committed by default.
- No email, phone, IP, or visitor hash is saved in snapshots.
- No homepage asset is replaced automatically.
- A staging file means "review this candidate", not "publish this candidate".

## GitHub Actions

The scheduled workflow runs weekly and can also be started manually from GitHub Actions.

Required secret for protected raw export:

```text
PET_ADMIN_TOKEN
```

If the secret is missing, the loop still runs from public aggregate feedback.
