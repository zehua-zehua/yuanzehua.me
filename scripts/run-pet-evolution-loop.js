#!/usr/bin/env node

const {
  DEFAULT_VERSION,
  formatDate,
  loadRules,
  safeVersion
} = require("./pet-loop-core");
const { runFeedbackCollector } = require("./run-pet-feedback-collector");
const { runEvaluation } = require("./run-pet-evaluation");
const { runGeneration } = require("./run-pet-generation");
const { runSelection } = require("./run-pet-selection");

async function runPetEvolutionLoop(options = {}) {
  const rules = loadRules();
  const version = safeVersion(options.version || process.argv[2] || rules.default_version || DEFAULT_VERSION);
  const date = options.date || formatDate();

  console.log(`Loopi evolution loop started for ${version}.`);

  const collector = await runFeedbackCollector({
    version,
    date,
    silent: true
  });
  console.log(`collector=${collector.snapshotPath}`);

  const evaluation = await runEvaluation({
    version,
    date,
    snapshotPath: collector.snapshotPath,
    silent: true
  });
  console.log(`evaluation=${evaluation.evaluationPath}`);

  const generation = await runGeneration({
    version,
    date,
    evaluationPath: evaluation.evaluationPath,
    silent: true
  });
  console.log(`generation=${generation.generationPath}`);

  const selection = await runSelection({
    version,
    date,
    evaluationPath: evaluation.evaluationPath,
    generationPath: generation.generationPath,
    silent: true
  });
  console.log(`selection=${selection.selectionPath}`);
  if (selection.stagingPath) console.log(`staging=${selection.stagingPath}`);
  console.log(`decision=${selection.selection.final_decision}`);

  return {
    collector,
    evaluation,
    generation,
    selection
  };
}

if (require.main === module) {
  runPetEvolutionLoop().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = { runPetEvolutionLoop };
