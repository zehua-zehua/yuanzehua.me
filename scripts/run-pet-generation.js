#!/usr/bin/env node

const path = require("path");
const {
  PET_LOOP_DIR,
  DEFAULT_VERSION,
  formatDate,
  formatTimestamp,
  latestJsonFile,
  loadRules,
  nextVersionName,
  readJson,
  safeId,
  safeVersion,
  scoreText,
  unique,
  writeJson
} = require("./pet-loop-core");

const PRESERVED_ASSET_FIELDS = [
  "asset_status",
  "image_url",
  "source_image_url",
  "sprite_url",
  "visual_generated_at",
  "visual_generation_prompt"
];

function preserveGeneratedAsset(candidatePath, candidate) {
  if (!require("fs").existsSync(candidatePath)) return candidate;

  const existing = readJson(candidatePath);
  if (existing.candidate_id !== candidate.candidate_id) return candidate;

  if (existing.image_url && existing.status) {
    candidate.status = existing.status;
  }

  for (const field of PRESERVED_ASSET_FIELDS) {
    if (existing[field] !== undefined && existing[field] !== null) {
      candidate[field] = existing[field];
    }
  }

  return candidate;
}

function primaryWeakness(evaluation) {
  if (evaluation.weak_questions && evaluation.weak_questions.length) {
    return { type: "question", ...evaluation.weak_questions[0] };
  }
  if (evaluation.weak_dimensions && evaluation.weak_dimensions.length) {
    return { type: "dimension", ...evaluation.weak_dimensions[0] };
  }
  return {
    type: "system",
    key: "none",
    label: "No strong weakness",
    average: null
  };
}

function targetWeaknesses(strategyKey, evaluation) {
  const questionWeaknesses = (evaluation.weak_questions || []).map((item) => ({
    type: "question",
    ...item
  }));
  const dimensionWeaknesses = (evaluation.weak_dimensions || []).map((item) => ({
    type: "dimension",
    ...item
  }));

  if (strategyKey === "conservative") {
    const selected = [];
    const seenDimensions = new Set();

    for (const weakness of questionWeaknesses) {
      if (seenDimensions.has(weakness.dimension)) continue;
      selected.push(weakness);
      seenDimensions.add(weakness.dimension);
      if (selected.length === 2) return selected;
    }

    return selected.length ? selected : [primaryWeakness(evaluation)];
  }

  return [primaryWeakness(evaluation), ...dimensionWeaknesses.slice(0, 1)].slice(0, 2);
}

function variablesForStrategy(strategyKey, evaluation, rules) {
  if (strategyKey === "conservative") {
    const variables = [];
    for (const weakness of targetWeaknesses(strategyKey, evaluation)) {
      const actions =
        weakness.type === "question"
          ? rules.question_actions[weakness.key] || []
          : rules.dimension_actions[weakness.key] || [];
      if (actions[0]) variables.push(actions[0]);
    }
    return unique(variables.length ? variables : evaluation.recommended_variables).slice(0, 2);
  }

  if (strategyKey === "expressive") {
    return unique(["tail-energy direction", "animation restraint", "smile softness"]).slice(0, 2);
  }

  return unique(["subtle AI cue", "tail-energy direction"]).slice(0, 2);
}

function scoreEstimate(strategyKey, evaluation) {
  const summary = evaluation.public_summary || {};
  const dimension = Object.fromEntries(
    (summary.dimension_scores || []).map((item) => [item.key, Number(item.average || 0)])
  );

  const currentVisual = dimension.visual_first_impression || 4;
  const currentHomepage = dimension.homepage_fit || 4;
  const currentPersonal = dimension.personal_fit || 4;
  const currentConcept = dimension.pony_dog_concept || 4;

  if (strategyKey === "conservative") {
    return {
      visual_first_impression: Math.min(5, Math.max(currentVisual, currentVisual + 0.18)),
      homepage_fit: Math.min(5, Math.max(currentHomepage, currentHomepage + 0.28)),
      personal_brand_fit: Math.min(5, Math.max(currentPersonal, currentPersonal)),
      ai_companion_identity: 4.55,
      pony_momentum_readability: Math.min(5, Math.max(currentConcept, currentConcept + 0.05)),
      dog_warmth_readability: Math.min(5, Math.max(currentConcept, currentConcept + 0.08)),
      professional_quality: 4.25,
      animation_feasibility: 4.45,
      risk_level: 1.8
    };
  }

  if (strategyKey === "expressive") {
    return {
      visual_first_impression: Math.min(5, Math.max(currentVisual, currentVisual + 0.08)),
      homepage_fit: Math.min(5, Math.max(currentHomepage, currentHomepage + 0.12)),
      personal_brand_fit: Math.min(5, Math.max(currentPersonal, currentPersonal + 0.2)),
      ai_companion_identity: 4.45,
      pony_momentum_readability: Math.min(5, Math.max(currentConcept, currentConcept + 0.08)),
      dog_warmth_readability: Math.min(5, Math.max(currentConcept, currentConcept + 0.18)),
      professional_quality: 4.05,
      animation_feasibility: 4.2,
      risk_level: 2.6
    };
  }

  return {
    visual_first_impression: Math.min(5, Math.max(currentVisual, currentVisual + 0.12)),
    homepage_fit: Math.min(5, Math.max(currentHomepage, currentHomepage + 0.15)),
    personal_brand_fit: Math.min(5, Math.max(currentPersonal, currentPersonal + 0.1)),
    ai_companion_identity: 4.7,
    pony_momentum_readability: Math.min(5, Math.max(currentConcept, currentConcept + 0.15)),
    dog_warmth_readability: Math.min(5, Math.max(currentConcept, currentConcept + 0.06)),
    professional_quality: 4.15,
    animation_feasibility: 4.05,
    risk_level: 2.3
  };
}

function visualPrompt(candidate, evaluation, rules) {
  const weaknessLabels = candidate.target_feedback_weakness
    .map((weakness) => `${weakness.label} (${scoreText(weakness.average)})`)
    .join(" and ");
  const changes = candidate.changed_variables.join(" and ");
  return [
    `Generate ${candidate.candidate_id} for Loopi, based on ${evaluation.version_name}.`,
    `This candidate targets ${weaknessLabels}.`,
    `Change only ${changes}.`,
    "Preserve Loopi's virtual AI companion identity, pony-origin momentum, silver-white body, blue-purple mane or energy tail, warm intelligent eyes, subtle cyan AI markings, and professional homepage fit.",
    `Avoid ${rules.hard_avoids.join(", ")}.`
  ].join(" ");
}

function buildCandidate(strategy, index, evaluation, rules, date) {
  const nextVersion = nextVersionName(evaluation.version_name);
  const candidateId = `${nextVersion}_auto_${date.replace(/-/g, "")}_c${String(index + 1).padStart(2, "0")}`;
  const weaknesses = targetWeaknesses(strategy.key, evaluation);
  const changedVariables = variablesForStrategy(strategy.key, evaluation, rules);
  const scores = scoreEstimate(strategy.key, evaluation);
  const weaknessText = weaknesses
    .map((weakness) => `${weakness.label} from ${scoreText(weakness.average)}`)
    .join(" and ");

  const candidate = {
    candidate_id: candidateId,
    based_on_version: evaluation.version_name,
    target_version: nextVersion,
    candidate_name: strategy.label,
    status: "loop_generated",
    generated_by: "generation_agent",
    generated_at: formatTimestamp(),
    generation_run_id: evaluation.run_id,
    target_feedback_weakness: weaknesses,
    changed_variables: changedVariables,
    preserved_variables: rules.protected_variables,
    expected_improvement: [
      `Improve ${weaknessText} without weakening homepage fit.`,
      "Keep the change to one controlled visual direction so the next feedback loop can isolate signal."
    ],
    risk_to_watch:
      strategy.key === "conservative"
        ? "May improve fit but feel too subtle if the visual change is barely visible."
        : strategy.key === "expressive"
          ? "May become too cute or dog-like if warmth cues dominate the AI companion identity."
          : "May become too tech-heavy or generic AI if product cues are too literal.",
    visual_prompt: "",
    animation_notes:
      strategy.key === "conservative"
        ? "Use calmer idle and restrained waving; avoid attention-stealing motion."
        : strategy.key === "expressive"
          ? "Let warmth show through small face and ear changes, not through large bouncy motion."
          : "Use tiny cyan pulse or tail-energy direction only if it remains homepage-quiet.",
    homepage_fit_notes:
      "Candidate must remain secondary to the personal homepage content and should sit naturally on the paper background.",
    pet_dna_consistency_score_estimate:
      strategy.key === "expressive" ? 4.35 : strategy.key === "brand_ip" ? 4.5 : 4.65,
    score_estimate: scores
  };

  candidate.visual_prompt = visualPrompt(candidate, evaluation, rules);
  return candidate;
}

function buildGenerationReport(generation) {
  return `# Loopi Generation Report

Date: ${generation.report_date}
Based on: \`${generation.version_name}\`
Decision source: \`${generation.evaluation_decision}\`

## Result

- Status: \`${generation.status}\`
- Candidate count: ${generation.candidates.length}

## Candidate Batch

${generation.candidates.length ? generation.candidates.map((item) => `- \`${item.candidate_id}\`: ${item.candidate_name} (${item.changed_variables.join(", ")})`).join("\n") : "- No candidates generated."}

## Guardrails

- Do not publish candidates automatically.
- Do not replace homepage production assets without human review.
- Change only one or two variables in each candidate.
`;
}

async function runGeneration(options = {}) {
  const rules = loadRules();
  const versionName = safeVersion(options.version || process.argv[2] || rules.default_version || DEFAULT_VERSION);
  const evaluationPath =
    options.evaluationPath ||
    process.argv[3] ||
    latestJsonFile(path.join(PET_LOOP_DIR, "evaluations"), versionName, "-evaluation.json");

  if (!evaluationPath) {
    throw new Error(`No evaluation file found for ${versionName}. Run evaluation first.`);
  }

  const evaluation = readJson(evaluationPath);
  const date = options.date || formatDate();
  const shouldGenerate = ["generate_candidates", "urgent_iteration"].includes(evaluation.decision);
  const candidates = shouldGenerate
    ? rules.candidate_strategies.map((strategy, index) =>
        buildCandidate(strategy, index, evaluation, rules, date)
      )
    : [];

  const candidatePaths = [];
  for (const candidate of candidates) {
    const candidatePath = path.join(
      PET_LOOP_DIR,
      "candidates",
      `${safeId(candidate.candidate_id)}.json`
    );
    preserveGeneratedAsset(candidatePath, candidate);
    writeJson(candidatePath, candidate);
    candidatePaths.push(candidatePath);
  }

  const generation = {
    agent: "generation",
    schema: "loopi_generation_v1",
    run_id: evaluation.run_id,
    version_name: versionName,
    target_version: nextVersionName(versionName),
    generated_at: formatTimestamp(),
    report_date: date,
    evaluation_path: path.relative(PET_LOOP_DIR, evaluationPath),
    evaluation_decision: evaluation.decision,
    status: shouldGenerate ? "candidates_generated" : "skipped",
    skip_reason: shouldGenerate ? null : `Evaluation decision was ${evaluation.decision}.`,
    candidates,
    candidate_paths: candidatePaths.map((filePath) => path.relative(PET_LOOP_DIR, filePath))
  };

  const generationPath = path.join(PET_LOOP_DIR, "generations", `${date}-${versionName}-generation.json`);
  const reportPath = path.join(PET_LOOP_DIR, "reports", `${date}-${versionName}-generation.md`);
  writeJson(generationPath, generation);
  require("fs").writeFileSync(reportPath, buildGenerationReport(generation), "utf8");

  if (!options.silent) {
    console.log(generationPath);
    console.log(reportPath);
    for (const candidatePath of candidatePaths) console.log(candidatePath);
  }

  return { generation, generationPath, reportPath, candidatePaths };
}

if (require.main === module) {
  runGeneration().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { runGeneration };
