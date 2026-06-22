const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PET_LOOP_DIR = path.join(ROOT, "pet-loop");
const RULES_PATH = path.join(PET_LOOP_DIR, "rules", "evolution-rules.json");
const DEFAULT_SITE_URL = "https://yuanzehua.me";
const DEFAULT_VERSION = "loopi_v0_2";

const QUESTION_DEFINITIONS = [
  ["q1_visual_beauty", "整体好看", "visual_first_impression", "视觉第一印象"],
  ["q2_visual_quality_professional", "专业质感", "visual_first_impression", "视觉第一印象"],
  ["q3_homepage_not_abrupt", "首页不突兀", "homepage_fit", "主页适配度"],
  ["q4_first_impression_not_distracting", "增强第一印象", "homepage_fit", "主页适配度"],
  ["q5_ai_curiosity_exploration", "好奇探索 AI", "personal_fit", "个人气质匹配"],
  ["q6_friendliness_approachable", "亲和易交流", "personal_fit", "个人气质匹配"],
  ["q7_pony_momentum_growth", "小马行动力", "pony_dog_concept", "小马 + 小狗设定"],
  ["q8_dog_warmth_companionship", "小狗陪伴感", "pony_dog_concept", "小马 + 小狗设定"]
].map(([key, label, dimension, dimensionLabel]) => ({
  key,
  label,
  dimension,
  dimensionLabel
}));

const DIMENSION_DEFINITIONS = Array.from(
  new Map(
    QUESTION_DEFINITIONS.map((item) => [
      item.dimension,
      { key: item.dimension, label: item.dimensionLabel }
    ])
  ).values()
);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function safeVersion(value) {
  const version = String(value || DEFAULT_VERSION).trim().slice(0, 80);
  if (!/^[a-z0-9_.-]+$/i.test(version)) return DEFAULT_VERSION;
  return version;
}

function safeId(value) {
  return String(value || "").replace(/[^a-z0-9_.-]/gi, "_");
}

function formatDate(date = new Date(), timeZone = "Asia/Shanghai") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatTimestamp(date = new Date()) {
  return date.toISOString();
}

function scoreText(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "not available";
  }
  return Number(value).toFixed(2);
}

function loadRules() {
  return readJson(RULES_PATH);
}

function loadPetDna() {
  return fs.readFileSync(path.join(PET_LOOP_DIR, "pet-dna.md"), "utf8");
}

function loadVersion(versionName) {
  const filePath = path.join(PET_LOOP_DIR, "versions", `${safeVersion(versionName)}.json`);
  return fs.existsSync(filePath) ? readJson(filePath) : null;
}

function latestFile(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((file) => predicate(file))
    .sort();
  if (!files.length) return null;
  return path.join(dir, files[files.length - 1]);
}

function latestJsonFile(dir, versionName, suffix) {
  const safe = safeVersion(versionName);
  return latestFile(dir, (file) => file.includes(safe) && file.endsWith(suffix));
}

function nextVersionName(versionName) {
  const match = String(versionName || "").match(/^loopi_v(\d+)_(\d+)$/);
  if (!match) return "loopi_vNEXT";
  return `loopi_v${match[1]}_${Number(match[2]) + 1}`;
}

function getScoreMap(items = []) {
  const map = new Map();
  for (const item of items) {
    if (!item || !item.key) continue;
    map.set(item.key, {
      ...item,
      average:
        item.average === null || item.average === undefined ? null : Number(item.average),
      count: Number(item.count || 0)
    });
  }
  return map;
}

function sortedScores(items = [], direction = "asc") {
  const multiplier = direction === "desc" ? -1 : 1;
  return [...items]
    .filter((item) => item.average !== null && item.average !== undefined)
    .sort((a, b) => {
      const diff = Number(a.average) - Number(b.average);
      if (diff !== 0) return diff * multiplier;
      return String(a.key).localeCompare(String(b.key));
    });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function readMaybeJson(filePath) {
  return filePath && fs.existsSync(filePath) ? readJson(filePath) : null;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${body.slice(0, 240)}`);
  }
  return JSON.parse(body);
}

function redactText(value) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[redacted-url]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[redacted-phone]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

function questionDefinition(key) {
  return QUESTION_DEFINITIONS.find((item) => item.key === key) || null;
}

function dimensionDefinition(key) {
  return DIMENSION_DEFINITIONS.find((item) => item.key === key) || null;
}

module.exports = {
  ROOT,
  PET_LOOP_DIR,
  RULES_PATH,
  DEFAULT_SITE_URL,
  DEFAULT_VERSION,
  QUESTION_DEFINITIONS,
  DIMENSION_DEFINITIONS,
  ensureDir,
  readJson,
  writeJson,
  safeVersion,
  safeId,
  formatDate,
  formatTimestamp,
  scoreText,
  loadRules,
  loadPetDna,
  loadVersion,
  latestFile,
  latestJsonFile,
  nextVersionName,
  getScoreMap,
  sortedScores,
  unique,
  readMaybeJson,
  fetchJson,
  redactText,
  questionDefinition,
  dimensionDefinition
};
