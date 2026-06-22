#!/usr/bin/env node

const fs = require("fs");
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
  safeVersion,
  scoreText,
  writeJson
} = require("./pet-loop-core");

function weightedScore(scores, weights) {
  let total = 0;
  let weightTotal = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const value = key === "risk_safety" ? 6 - Number(scores.risk_level || 3) : Number(scores[key] || 0);
    total += value * Number(weight);
    weightTotal += Number(weight);
  }

  return weightTotal ? total / weightTotal : 0;
}

function currentDimension(evaluation, key) {
  const row = (evaluation.public_summary.dimension_scores || []).find((item) => item.key === key);
  return row && row.average !== null && row.average !== undefined ? Number(row.average) : null;
}

function isSafe(candidate, evaluation) {
  const scores = candidate.score_estimate || {};
  const visualNow = currentDimension(evaluation, "visual_first_impression");
  const homepageNow = currentDimension(evaluation, "homepage_fit");
  const personalNow = currentDimension(evaluation, "personal_fit");
  const conceptNow = currentDimension(evaluation, "pony_dog_concept");
  const reasons = [];

  if (visualNow !== null && Number(scores.visual_first_impression || 0) < visualNow) {
    reasons.push("visual_first_impression may decrease");
  }
  if (homepageNow !== null && Number(scores.homepage_fit || 0) < homepageNow) {
    reasons.push("homepage_fit may decrease");
  }
  if (personalNow !== null && Number(scores.personal_brand_fit || 0) < personalNow) {
    reasons.push("personal_brand_fit may decrease");
  }
  if (conceptNow !== null) {
    const conceptEstimate = Math.min(
      Number(scores.pony_momentum_readability || 0),
      Number(scores.dog_warmth_readability || 0)
    );
    if (conceptEstimate < conceptNow) reasons.push("pony/dog concept readability may decrease");
  }
  if (Number(scores.homepage_fit || 0) < 3.5) reasons.push("homepage_fit below 3.5");
  if (Number(candidate.pet_dna_consistency_score_estimate || 0) < 4) {
    reasons.push("Pet DNA consistency below 4");
  }
  if ((candidate.changed_variables || []).length > 2) {
    reasons.push("changes more than two variables");
  }

  return { safe: reasons.length === 0, reasons };
}

function buildReport(selection) {
  const rows = selection.candidate_scores.map(
    (item) =>
      `| \`${item.candidate_id}\` | ${item.candidate_name} | ${scoreText(item.total_score)} | ${item.safe ? "yes" : "no"} | ${item.safety_notes || "none"} |`
  );

  return `# Loopi Selection Report

Date: ${selection.report_date}
Based on: \`${selection.version_name}\`
Decision: \`${selection.final_decision}\`

## Candidate Comparison

| Candidate | Name | Weighted Score | Safe | Notes |
| --- | --- | --- | --- | --- |
${rows.length ? rows.join("\n") : "| none | none | not available | no | No candidates were generated. |"}

## Best Candidate

${selection.selected_candidate ? `\`${selection.selected_candidate.candidate_id}\` - ${selection.selected_candidate.candidate_name}` : "No candidate selected."}

## Reason

${selection.reason}

## Main Risk

${selection.selected_candidate ? selection.selected_candidate.risk_to_watch : "No staging risk because no candidate entered staging."}

## Human Review Points

${selection.human_review_points.map((item) => `- ${item}`).join("\n")}

## Publishing Rule

This Selection Agent may create a staging version file, but it must not replace homepage production assets without human approval.
`;
}

async function runSelection(options = {}) {
  const rules = loadRules();
  const versionName = safeVersion(options.version || process.argv[2] || rules.default_version || DEFAULT_VERSION);
  const evaluationPath =
    options.evaluationPath ||
    process.argv[3] ||
    latestJsonFile(path.join(PET_LOOP_DIR, "evaluations"), versionName, "-evaluation.json");
  const generationPath =
    options.generationPath ||
    process.argv[4] ||
    latestJsonFile(path.join(PET_LOOP_DIR, "generations"), versionName, "-generation.json");

  if (!evaluationPath) throw new Error(`No evaluation file found for ${versionName}.`);
  if (!generationPath) throw new Error(`No generation file found for ${versionName}.`);

  const evaluation = readJson(evaluationPath);
  const generation = readJson(generationPath);
  const date = options.date || formatDate();
  const candidates = generation.candidates || [];
  const candidateScores = candidates
    .map((candidate) => {
      const safety = isSafe(candidate, evaluation);
      return {
        candidate_id: candidate.candidate_id,
        candidate_name: candidate.candidate_name,
        total_score: weightedScore(candidate.score_estimate || {}, rules.selection_weights),
        safe: safety.safe,
        safety_notes: safety.reasons.join("; "),
        candidate
      };
    })
    .sort((a, b) => b.total_score - a.total_score);

  const selectedScore = candidateScores.find((item) => item.safe) || null;
  const selectedCandidate = selectedScore ? selectedScore.candidate : null;
  let finalDecision = "keep_current";
  let reason = "No candidate generation was required.";

  if (["generate_candidates", "urgent_iteration"].includes(evaluation.decision)) {
    if (selectedCandidate) {
      finalDecision = "stage_candidate";
      reason = "A candidate safely addresses the weakest feedback area while preserving Pet DNA guardrails.";
    } else {
      finalDecision = "regenerate_candidates";
      reason = "Generated candidates did not satisfy the staging safety rules.";
    }
  } else if (evaluation.decision === "watch_only") {
    reason = "Feedback volume is below the minimum threshold, so the current version should stay under observation.";
  }

  const humanReviewPoints = selectedCandidate
    ? [
        "Confirm the candidate still feels like a professional homepage companion.",
        "Confirm the sprite animation is calm enough for the first viewport.",
        "Confirm the visual change is limited to the listed variables before publishing."
      ]
    : [
        "Review whether more feedback is needed before visual iteration.",
        "If candidate generation failed safety checks, regenerate with smaller variable changes."
      ];

  const selection = {
    agent: "selection",
    schema: "loopi_selection_v1",
    run_id: evaluation.run_id,
    version_name: versionName,
    target_version: generation.target_version || nextVersionName(versionName),
    selected_at: formatTimestamp(),
    report_date: date,
    evaluation_path: path.relative(PET_LOOP_DIR, evaluationPath),
    generation_path: path.relative(PET_LOOP_DIR, generationPath),
    final_decision: finalDecision,
    reason,
    candidate_scores: candidateScores.map(({ candidate, ...rest }) => rest),
    selected_candidate: selectedCandidate,
    human_review_points: humanReviewPoints
  };

  const selectionPath = path.join(PET_LOOP_DIR, "selections", `${date}-${versionName}-selection.json`);
  const reportPath = path.join(PET_LOOP_DIR, "reports", `${date}-${versionName}-selection.md`);
  writeJson(selectionPath, selection);
  fs.writeFileSync(reportPath, buildReport(selection), "utf8");

  let stagingPath = null;
  if (finalDecision === "stage_candidate" && selectedCandidate) {
    const stagingVersionName = `${selection.target_version}_staging`;
    stagingPath = path.join(PET_LOOP_DIR, "versions", `${stagingVersionName}.json`);
    const existingStaging = fs.existsSync(stagingPath) ? readJson(stagingPath) : null;
    const keepExistingAsset =
      existingStaging &&
      existingStaging.selected_candidate_id === selectedCandidate.candidate_id &&
      existingStaging.image_url;
    const staging = {
      version_name: stagingVersionName,
      display_name: `Loopi ${selection.target_version.replace("loopi_", "").replace("_", ".")} Staging`,
      status: "staging_recommended",
      based_on_version: versionName,
      selected_candidate_id: selectedCandidate.candidate_id,
      selected_at: selection.selected_at,
      selection_report: path.relative(PET_LOOP_DIR, reportPath),
      asset_status: keepExistingAsset
        ? existingStaging.asset_status || "static_candidate_ready"
        : "candidate_prompt_ready",
      image_url: keepExistingAsset ? existingStaging.image_url : null,
      source_image_url: keepExistingAsset
        ? existingStaging.source_image_url || null
        : null,
      sprite_url: keepExistingAsset ? existingStaging.sprite_url || null : null,
      visual_generated_at: keepExistingAsset
        ? existingStaging.visual_generated_at || null
        : null,
      changed_variables: selectedCandidate.changed_variables,
      preserved_variables: selectedCandidate.preserved_variables,
      visual_prompt: selectedCandidate.visual_prompt,
      animation_notes: selectedCandidate.animation_notes,
      homepage_fit_notes: selectedCandidate.homepage_fit_notes,
      publish_rule: "Human approval required before replacing production homepage assets."
    };
    writeJson(stagingPath, staging);
  }

  if (!options.silent) {
    console.log(selectionPath);
    console.log(reportPath);
    if (stagingPath) console.log(stagingPath);
  }

  return { selection, selectionPath, reportPath, stagingPath };
}

if (require.main === module) {
  runSelection().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { runSelection };
