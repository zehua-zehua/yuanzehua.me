#!/usr/bin/env node
/**
 * Generate a local Loopi feedback report from the deployed feedback API.
 *
 * Usage:
 *   PET_ADMIN_TOKEN=... node scripts/generate-pet-report.js
 *   PET_ADMIN_TOKEN=... node scripts/generate-pet-report.js loopi_v0_1
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const VERSION = process.argv[2] || "loopi_v0_1";
const SITE = process.env.PET_SITE_URL || "https://yuanzehua.me";
const TOKEN = process.env.PET_ADMIN_TOKEN || "";

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
  rows.forEach((row) => {
    parseTags(row.tags).forEach((tag) => {
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

Loopi is still in the seed validation stage. Do not generate a production replacement until there is enough feedback or a simulated visitor review pass.

## Recommended Next Step

Keep \`${VERSION}\` active. If feedback remains low, run simulated visitor reviews against the three prepared v0.2 candidate lanes before generating visual assets.
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
