#!/usr/bin/env node

const path = require("path");
const {
  PET_LOOP_DIR,
  DEFAULT_SITE_URL,
  DEFAULT_VERSION,
  fetchJson,
  formatDate,
  formatTimestamp,
  loadRules,
  redactText,
  safeVersion,
  writeJson
} = require("./pet-loop-core");

async function fetchExport(siteUrl, versionName, token) {
  if (!token) {
    return {
      available: false,
      rows: [],
      note: "PET_ADMIN_TOKEN was not provided."
    };
  }

  const exportUrl = `${siteUrl}/api/pet-feedback-export?version=${encodeURIComponent(
    versionName
  )}&limit=500`;

  try {
    const exported = await fetchJson(exportUrl, {
      headers: { authorization: `Bearer ${token}` }
    });
    return {
      available: true,
      rows: Array.isArray(exported.rows) ? exported.rows : [],
      note: "Protected export succeeded."
    };
  } catch (error) {
    return {
      available: false,
      rows: [],
      note: `Protected export failed: ${error.message}`
    };
  }
}

function summariseRows(rows) {
  const sourceCounts = {};
  const pageCounts = {};

  for (const row of rows) {
    const source = row.source || "unknown";
    const page = row.page_path || "unknown";
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    pageCounts[page] = (pageCounts[page] || 0) + 1;
  }

  const includeRedactedText = process.env.PET_LOOP_INCLUDE_REDACTED_TEXT === "1";
  const redactedOpenFeedbackSamples = includeRedactedText
    ? rows
        .map((row) => redactText(row.free_text_feedback))
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return {
    source_counts: sourceCounts,
    page_counts: pageCounts,
    redacted_open_feedback_samples: redactedOpenFeedbackSamples
  };
}

async function runFeedbackCollector(options = {}) {
  const rules = loadRules();
  const versionName = safeVersion(options.version || process.argv[2] || rules.default_version || DEFAULT_VERSION);
  const siteUrl = String(options.siteUrl || process.env.PET_SITE_URL || rules.site_url || DEFAULT_SITE_URL).replace(/\/$/, "");
  const token = options.token || process.env.PET_ADMIN_TOKEN || "";
  const date = options.date || formatDate();

  const summaryUrl = `${siteUrl}/api/pet-feedback-summary?version=${encodeURIComponent(
    versionName
  )}`;
  const summary = await fetchJson(summaryUrl);
  const exported = await fetchExport(siteUrl, versionName, token);
  const rowSummary = summariseRows(exported.rows);
  const feedbackCount = Number(summary.feedback_count || 0);

  const snapshot = {
    agent: "feedback_collector",
    schema: "loopi_feedback_snapshot_v1",
    run_id: `${date}-${safeVersion(summary.version_name || versionName)}`,
    version_name: summary.version_name || versionName,
    collected_at: formatTimestamp(),
    site_url: siteUrl,
    summary_endpoint: `/api/pet-feedback-summary?version=${encodeURIComponent(
      summary.version_name || versionName
    )}`,
    export_endpoint_used: exported.available,
    confidence:
      feedbackCount < Number(rules.thresholds.min_feedback_count || 20)
        ? "low_confidence"
        : "usable",
    public_summary: {
      ok: summary.ok === true,
      evaluation_schema: summary.evaluation_schema || null,
      feedback_count: feedbackCount,
      average_score:
        summary.average_score === null || summary.average_score === undefined
          ? null
          : Number(summary.average_score),
      latest_feedback_at: summary.latest_feedback_at || null,
      top_tags: Array.isArray(summary.top_tags) ? summary.top_tags : [],
      question_scores: Array.isArray(summary.question_scores)
        ? summary.question_scores
        : [],
      dimension_scores: Array.isArray(summary.dimension_scores)
        ? summary.dimension_scores
        : []
    },
    raw_feedback_available: exported.available,
    raw_feedback_count: exported.rows.length,
    raw_feedback_note: exported.note,
    raw_feedback_policy:
      "Raw visitor comments are not saved in this public snapshot. Set PET_LOOP_INCLUDE_REDACTED_TEXT=1 to include short redacted samples.",
    ...rowSummary
  };

  const outPath = path.join(
    PET_LOOP_DIR,
    "feedback",
    `${date}-${safeVersion(snapshot.version_name)}-feedback.json`
  );
  writeJson(outPath, snapshot);

  if (!options.silent) {
    console.log(outPath);
  }

  return { snapshot, snapshotPath: outPath };
}

if (require.main === module) {
  runFeedbackCollector().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { runFeedbackCollector };
