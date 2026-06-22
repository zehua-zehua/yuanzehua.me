#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  PET_LOOP_DIR,
  DEFAULT_VERSION,
  DIMENSION_DEFINITIONS,
  QUESTION_DEFINITIONS,
  dimensionDefinition,
  formatDate,
  formatTimestamp,
  getScoreMap,
  latestJsonFile,
  loadPetDna,
  loadRules,
  loadVersion,
  questionDefinition,
  readJson,
  safeVersion,
  scoreText,
  sortedScores,
  unique,
  writeJson
} = require("./pet-loop-core");

function actionsForWeakness(rules, weakQuestions, weakDimensions) {
  const actions = [];

  for (const question of weakQuestions.slice(0, 3)) {
    actions.push(...(rules.question_actions[question.key] || []));
  }

  for (const dimension of weakDimensions.slice(0, 2)) {
    actions.push(...(rules.dimension_actions[dimension.key] || []));
  }

  return unique(actions).slice(0, 4);
}

function collectRedLines(summary, rules) {
  const redLines = [];
  const dimensionScores = getScoreMap(summary.dimension_scores);
  const questionScores = getScoreMap(summary.question_scores);

  for (const [key, minimum] of Object.entries(rules.red_lines.dimension_minimums || {})) {
    const score = dimensionScores.get(key);
    if (score && score.average !== null && score.average < Number(minimum)) {
      const definition = dimensionDefinition(key);
      redLines.push({
        type: "dimension",
        key,
        label: definition ? definition.label : key,
        average: score.average,
        minimum
      });
    }
  }

  for (const [key, minimum] of Object.entries(rules.red_lines.question_minimums || {})) {
    const score = questionScores.get(key);
    if (score && score.average !== null && score.average < Number(minimum)) {
      const definition = questionDefinition(key);
      redLines.push({
        type: "question",
        key,
        label: definition ? definition.label : key,
        average: score.average,
        minimum
      });
    }
  }

  return redLines;
}

function decide(summary, rules) {
  const thresholds = rules.thresholds;
  const feedbackCount = Number(summary.feedback_count || 0);
  const averageScore =
    summary.average_score === null || summary.average_score === undefined
      ? null
      : Number(summary.average_score);
  const dimensionScores = sortedScores(summary.dimension_scores || []);
  const questionScores = sortedScores(summary.question_scores || []);
  const weakDimensions = dimensionScores.filter(
    (score) => score.average < Number(thresholds.iterate_dimension_score_below)
  );
  const weakQuestions = questionScores.filter((score) => score.average < Number(thresholds.keep_average_score));
  const strengths = sortedScores(summary.question_scores || [], "desc").slice(0, 4);
  const redLines = collectRedLines(summary, rules);

  if (feedbackCount < Number(thresholds.min_feedback_count)) {
    return {
      decision: "watch_only",
      confidence: "low_confidence",
      reason: `Only ${feedbackCount} feedback rows are available; minimum is ${thresholds.min_feedback_count}.`,
      weakDimensions,
      weakQuestions,
      strengths,
      redLines
    };
  }

  if (redLines.length) {
    return {
      decision: "urgent_iteration",
      confidence: "usable",
      reason: "One or more Pet DNA red lines were triggered.",
      weakDimensions,
      weakQuestions,
      strengths,
      redLines
    };
  }

  const allDimensionsKeep = DIMENSION_DEFINITIONS.every((definition) => {
    const score = (summary.dimension_scores || []).find((item) => item.key === definition.key);
    return score && score.average !== null && Number(score.average) >= Number(thresholds.keep_min_dimension_score);
  });

  if (
    averageScore !== null &&
    averageScore >= Number(thresholds.keep_average_score) &&
    allDimensionsKeep
  ) {
    return {
      decision: "keep_current",
      confidence: "usable",
      reason: "Average score and all dimension scores are above the keep thresholds.",
      weakDimensions,
      weakQuestions,
      strengths,
      redLines
    };
  }

  const urgentDimension = weakDimensions.find(
    (score) => score.average < Number(thresholds.urgent_dimension_score_below)
  );

  if (urgentDimension) {
    return {
      decision: "urgent_iteration",
      confidence: "usable",
      reason: `${urgentDimension.label} is below the urgent iteration threshold.`,
      weakDimensions,
      weakQuestions,
      strengths,
      redLines
    };
  }

  return {
    decision: "generate_candidates",
    confidence: "usable",
    reason: "Current feedback is useful and at least one score is below the keep threshold.",
    weakDimensions,
    weakQuestions,
    strengths,
    redLines
  };
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map(
    (row) => `| ${columns.map((column) => column.value(row)).join(" | ")} |`
  );
  return [header, divider, ...body].join("\n");
}

function buildReport(evaluation) {
  const summary = evaluation.public_summary;
  const questionRows = summary.question_scores || [];
  const dimensionRows = summary.dimension_scores || [];

  return `# Loopi Evaluation Report

Date: ${evaluation.report_date}
Version: \`${evaluation.version_name}\`
Decision: \`${evaluation.decision}\`

## Snapshot

- Feedback count: ${summary.feedback_count}
- Average score: ${scoreText(summary.average_score)}
- Latest feedback: ${summary.latest_feedback_at || "not available"}
- Confidence: ${evaluation.confidence}
- Reason: ${evaluation.reason}

## Dimension Scores

${markdownTable(dimensionRows, [
  { label: "Dimension", value: (row) => row.label || row.key },
  { label: "Average", value: (row) => scoreText(row.average) },
  { label: "Count", value: (row) => row.count || 0 }
])}

## Question Scores

${markdownTable(questionRows, [
  { label: "Question", value: (row) => row.label || row.key },
  { label: "Average", value: (row) => scoreText(row.average) },
  { label: "Count", value: (row) => row.count || 0 }
])}

## Strengths

${evaluation.strengths.length ? evaluation.strengths.map((item) => `- ${item.label}: ${scoreText(item.average)}`).join("\n") : "- No clear strengths yet."}

## Weaknesses

${evaluation.weak_questions.length ? evaluation.weak_questions.slice(0, 5).map((item) => `- ${item.label}: ${scoreText(item.average)}`).join("\n") : "- No question-level weakness above the confidence bar."}

## Pet DNA Risks

${evaluation.red_lines.length ? evaluation.red_lines.map((item) => `- ${item.label}: ${scoreText(item.average)} is below ${item.minimum}`).join("\n") : "- No hard red line is currently triggered."}

## Recommended Next Variables

${evaluation.recommended_variables.length ? evaluation.recommended_variables.map((item) => `- ${item}`).join("\n") : "- No visual variable change recommended yet."}

## Variables That Must Not Change

${evaluation.protected_variables.map((item) => `- ${item}`).join("\n")}

## Agent Notes

This report is generated by the rule-based Evaluation Agent. It does not publish a new pet version and does not replace production assets.
`;
}

async function runEvaluation(options = {}) {
  const rules = loadRules();
  const versionName = safeVersion(options.version || process.argv[2] || rules.default_version || DEFAULT_VERSION);
  const snapshotPath =
    options.snapshotPath ||
    process.argv[3] ||
    latestJsonFile(path.join(PET_LOOP_DIR, "feedback"), versionName, "-feedback.json");

  if (!snapshotPath || !fs.existsSync(snapshotPath)) {
    throw new Error(`No feedback snapshot found for ${versionName}. Run the collector first.`);
  }

  const snapshot = readJson(snapshotPath);
  const summary = snapshot.public_summary || snapshot;
  const decision = decide(summary, rules);
  const recommendedVariables = actionsForWeakness(
    rules,
    decision.weakQuestions,
    decision.weakDimensions
  );
  const reportDate = options.date || formatDate();
  const currentVersion = loadVersion(versionName);
  const petDna = loadPetDna();

  const evaluation = {
    agent: "evaluation",
    schema: "loopi_evaluation_v1",
    run_id: snapshot.run_id || `${reportDate}-${versionName}`,
    version_name: versionName,
    evaluated_at: formatTimestamp(),
    report_date: reportDate,
    snapshot_path: path.relative(PET_LOOP_DIR, snapshotPath),
    current_version_status: currentVersion ? currentVersion.status : "unknown",
    pet_dna_version:
      currentVersion && currentVersion.pet_dna_version
        ? currentVersion.pet_dna_version
        : petDna.split("\n")[0].replace(/^#\s*/, ""),
    public_summary: summary,
    decision: decision.decision,
    confidence: decision.confidence,
    reason: decision.reason,
    strengths: decision.strengths,
    weak_dimensions: decision.weakDimensions,
    weak_questions: decision.weakQuestions,
    red_lines: decision.redLines,
    recommended_variables: recommendedVariables,
    protected_variables: rules.protected_variables,
    hard_avoids: rules.hard_avoids
  };

  const safe = safeVersion(versionName);
  const jsonPath = path.join(PET_LOOP_DIR, "evaluations", `${reportDate}-${safe}-evaluation.json`);
  const reportPath = path.join(PET_LOOP_DIR, "reports", `${reportDate}-${safe}-evaluation.md`);
  writeJson(jsonPath, evaluation);
  fs.writeFileSync(reportPath, buildReport(evaluation), "utf8");

  if (!options.silent) {
    console.log(jsonPath);
    console.log(reportPath);
  }

  return { evaluation, evaluationPath: jsonPath, reportPath };
}

if (require.main === module) {
  runEvaluation().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { runEvaluation, decide };
