#!/usr/bin/env node
/**
 * Generate a local Loopi feedback report from the deployed feedback API.
 *
 * Usage:
 *   PET_ADMIN_TOKEN=... node scripts/generate-pet-report.js
 *   PET_ADMIN_TOKEN=... node scripts/generate-pet-report.js loopi_v0_2
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const VERSION = process.argv[2] || "loopi_v0_2";
const SITE = process.env.PET_SITE_URL || "https://yuanzehua.me";
const TOKEN = process.env.PET_ADMIN_TOKEN || "";

const QUESTION_DEFINITIONS = [
  ["q1_visual_beauty", "整体好看", "visual_first_impression", "视觉第一印象"],
  ["q2_visual_quality_professional", "专业质感", "visual_first_impression", "视觉第一印象"],
  ["q3_homepage_not_abrupt", "首页不突兀", "homepage_fit", "主页适配度"],
  ["q4_first_impression_not_distracting", "增强第一印象", "homepage_fit", "主页适配度"],
  ["q5_ai_curiosity_exploration", "好奇探索 AI", "personal_fit", "个人气质匹配"],
  ["q6_friendliness_approachable", "亲和易交流", "personal_fit", "个人气质匹配"],
  ["q7_pony_momentum_growth", "小马行动力", "pony_dog_concept", "小马 + 小狗设定"],
  ["q8_dog_warmth_companionship", "小狗陪伴感", "pony_dog_concept", "小马 + 小狗设定"],
].map(([key, label, dimension, dimensionLabel]) => ({
  key,
  label,
  dimension,
  dimensionLabel,
}));

const QUESTION_BY_KEY = new Map(QUESTION_DEFINITIONS.map((item) => [item.key, item]));
const STRUCTURED_SCORE_TAG = /^(q[1-8]_[a-z0-9_]+):([1-5])$/;

function formatDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function safeVersion(value) {
  return String(value).replace(/[^a-z0-9_.-]/gi, "_");
}

function parseTags(value) {
  try {
    const tags = JSON.parse(value || "[]");
    return Array.isArray(tags) ? tags : [];
  } catch (_error) {
    return [];
  }
}

function average(rows) {
  if (!rows.length) return null;
  const total = rows.reduce((sum, row) => sum + Number(row.score || 0), 0);
  return total / rows.length;
}

function emptyStats() {
  return { sum: 0, count: 0 };
}

function addStat(stat, score) {
  stat.sum += score;
  stat.count += 1;
}

function formatAverage(stat) {
  if (!stat || !stat.count) return "not available";
  return (stat.sum / stat.count).toFixed(2);
}

function parseStructuredScore(tag) {
  const match = String(tag || "").match(STRUCTURED_SCORE_TAG);
  if (!match) return null;
  const definition = QUESTION_BY_KEY.get(match[1]);
  if (!definition) return null;
  return { definition, score: Number(match[2]) };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${body.slice(0, 160)}`);
  }
  return JSON.parse(body);
}

async function main() {
  const summaryUrl = `${SITE}/api/pet-feedback-summary?version=${encodeURIComponent(VERSION)}`;
  const summary = await fetchJson(summaryUrl);

  let rows = [];
  if (TOKEN) {
    const exportUrl = `${SITE}/api/pet-feedback-export?version=${encodeURIComponent(VERSION)}&limit=500`;
    const exported = await fetchJson(exportUrl, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    rows = exported.rows || [];
  }

  const tagCounts = new Map();
  const questionStats = new Map(
    QUESTION_DEFINITIONS.map((definition) => [definition.key, emptyStats()])
  );
  const dimensionStats = new Map();

  rows.forEach((row) => {
    parseTags(row.tags).forEach((tag) => {
      const structured = parseStructuredScore(tag);
      if (structured) {
        addStat(questionStats.get(structured.definition.key), structured.score);
        const dimensionStat =
          dimensionStats.get(structured.definition.dimension) || emptyStats();
        addStat(dimensionStat, structured.score);
        dimensionStats.set(structured.definition.dimension, dimensionStat);
        return;
      }
      if (String(tag).startsWith("survey:")) return;
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  const openFeedback = rows
    .map((row) => String(row.free_text_feedback || "").trim())
    .filter(Boolean)
    .slice(0, 12);

  const avg = average(rows);
  const report = `# Loopi Feedback Report

Date: ${formatDate()}
Version: \`${VERSION}\`

## Data Snapshot

- Public feedback count: ${summary.feedback_count || 0}
- Public average score: ${
    summary.average_score === null || summary.average_score === undefined
      ? "not available"
      : Number(summary.average_score).toFixed(2)
  }
- Exported row count: ${rows.length}${TOKEN ? "" : " (admin token not provided)"}
- Exported average score: ${avg === null ? "not available" : avg.toFixed(2)}
- Evaluation schema: ${summary.evaluation_schema || "legacy_or_unavailable"}

## Dimension Scores

${
  rows.length
    ? Array.from(new Set(QUESTION_DEFINITIONS.map((item) => item.dimension)))
        .map((dimension) => {
          const definition = QUESTION_DEFINITIONS.find((item) => item.dimension === dimension);
          return `- ${definition.dimensionLabel}: ${formatAverage(
            dimensionStats.get(dimension)
          )}`;
        })
        .join("\n")
    : (summary.dimension_scores || [])
        .map((item) => `- ${item.label}: ${item.average === null || item.average === undefined ? "not available" : Number(item.average).toFixed(2)}`)
        .join("\n") || "- No dimension scores yet."
}

## Question Scores

${
  rows.length
    ? QUESTION_DEFINITIONS.map(
        (definition) =>
          `- ${definition.label}: ${formatAverage(questionStats.get(definition.key))}`
      ).join("\n")
    : (summary.question_scores || [])
        .map((item) => `- ${item.label}: ${item.average === null || item.average === undefined ? "not available" : Number(item.average).toFixed(2)}`)
        .join("\n") || "- No question scores yet."
}

## Top Tags

${
  rows.length
    ? Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([tag, count]) => `- ${tag}: ${count}`)
        .join("\n") || "- No tags yet."
    : (summary.top_tags || [])
        .map((item) => `- ${item.tag}: ${item.count}`)
        .join("\n") || "- No tags yet."
}

## Open Feedback

${openFeedback.length ? openFeedback.map((item) => `- ${item}`).join("\n") : "- No open feedback yet."}

## Diagnosis

Loopi is now validated through the 8-question homepage feedback survey. Diagnose the weakest dimension first, then map it to 1-2 candidate variables.

## Recommended Next Step

Keep \`${VERSION}\` active. If real feedback remains low, run simulated visitor reviews using the same 8 questions before generating v0.3 visual assets.
`;

  const outDir = path.join(ROOT, "pet-loop", "reports");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${formatDate()}-${safeVersion(VERSION)}.md`);
  fs.writeFileSync(outPath, report, "utf8");
  console.log(outPath);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
