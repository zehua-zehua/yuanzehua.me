const DEFAULT_VERSION = "loopi_v0_2";

const QUESTION_DEFINITIONS = [
  {
    key: "q1_visual_beauty",
    label: "整体好看",
    dimension: "visual_first_impression",
    dimensionLabel: "视觉第一印象",
  },
  {
    key: "q2_visual_quality_professional",
    label: "专业质感",
    dimension: "visual_first_impression",
    dimensionLabel: "视觉第一印象",
  },
  {
    key: "q3_homepage_not_abrupt",
    label: "首页不突兀",
    dimension: "homepage_fit",
    dimensionLabel: "主页适配度",
  },
  {
    key: "q4_first_impression_not_distracting",
    label: "增强第一印象",
    dimension: "homepage_fit",
    dimensionLabel: "主页适配度",
  },
  {
    key: "q5_ai_curiosity_exploration",
    label: "好奇探索 AI",
    dimension: "personal_fit",
    dimensionLabel: "个人气质匹配",
  },
  {
    key: "q6_friendliness_approachable",
    label: "亲和易交流",
    dimension: "personal_fit",
    dimensionLabel: "个人气质匹配",
  },
  {
    key: "q7_pony_momentum_growth",
    label: "小马行动力",
    dimension: "pony_dog_concept",
    dimensionLabel: "小马 + 小狗设定",
  },
  {
    key: "q8_dog_warmth_companionship",
    label: "小狗陪伴感",
    dimension: "pony_dog_concept",
    dimensionLabel: "小马 + 小狗设定",
  },
];

const QUESTION_BY_KEY = new Map(QUESTION_DEFINITIONS.map((item) => [item.key, item]));
const STRUCTURED_SCORE_TAG = /^(q[1-8]_[a-z0-9_]+):([1-5])$/;

async function ensureFeedbackTable(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS pet_feedback (
        id TEXT PRIMARY KEY,
        version_name TEXT NOT NULL,
        score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
        tags TEXT NOT NULL DEFAULT '[]',
        free_text_feedback TEXT,
        page_path TEXT NOT NULL DEFAULT '/',
        visitor_id_hash TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'real_user',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_pet_feedback_version_created
        ON pet_feedback (version_name, created_at DESC)`
    )
    .run();
}

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
      ...init.headers,
    },
  });
}

function cleanVersion(value) {
  const version = String(value || DEFAULT_VERSION).trim().slice(0, 80);
  if (!/^[a-z0-9_.-]+$/i.test(version)) return DEFAULT_VERSION;
  return version;
}

function parseTags(value) {
  try {
    const tags = JSON.parse(value || "[]");
    return Array.isArray(tags) ? tags : [];
  } catch (_error) {
    return [];
  }
}

function emptyStats() {
  return { sum: 0, count: 0 };
}

function averageStat(stat) {
  if (!stat.count) return null;
  return stat.sum / stat.count;
}

function parseStructuredScoreTag(tag) {
  const match = String(tag || "").match(STRUCTURED_SCORE_TAG);
  if (!match) return null;
  const definition = QUESTION_BY_KEY.get(match[1]);
  if (!definition) return null;
  return { definition, score: Number(match[2]) };
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.PET_DB) {
    return jsonResponse(
      { ok: false, error: "pet_db_binding_missing" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  const url = new URL(request.url);
  const versionName = cleanVersion(url.searchParams.get("version"));

  let summary;
  let tagRows;

  try {
    await ensureFeedbackTable(env.PET_DB);

    summary = await env.PET_DB.prepare(
      `SELECT
         COUNT(*) AS feedback_count,
         AVG(score) AS average_score,
         MAX(created_at) AS latest_feedback_at
       FROM pet_feedback
       WHERE version_name = ?`
    )
      .bind(versionName)
      .first();

    tagRows = await env.PET_DB.prepare(
      `SELECT tags FROM pet_feedback WHERE version_name = ? ORDER BY created_at DESC LIMIT 500`
    )
      .bind(versionName)
      .all();
  } catch (_error) {
    return jsonResponse(
      { ok: false, error: "database_query_failed" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  const tagCounts = {};
  const questionStats = new Map(
    QUESTION_DEFINITIONS.map((definition) => [definition.key, emptyStats()])
  );
  const dimensionStats = new Map();

  for (const row of tagRows.results || []) {
    for (const tag of parseTags(row.tags)) {
      const structuredScore = parseStructuredScoreTag(tag);
      if (structuredScore) {
        const questionStat = questionStats.get(structuredScore.definition.key);
        questionStat.sum += structuredScore.score;
        questionStat.count += 1;

        const dimensionKey = structuredScore.definition.dimension;
        const dimensionStat = dimensionStats.get(dimensionKey) || emptyStats();
        dimensionStat.sum += structuredScore.score;
        dimensionStat.count += 1;
        dimensionStats.set(dimensionKey, dimensionStat);
        continue;
      }

      if (String(tag).startsWith("survey:")) continue;
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));

  const questionScores = QUESTION_DEFINITIONS.map((definition) => {
    const stat = questionStats.get(definition.key) || emptyStats();
    return {
      key: definition.key,
      label: definition.label,
      dimension: definition.dimension,
      average: averageStat(stat),
      count: stat.count,
    };
  });

  const seenDimensions = new Set();
  const dimensionScores = [];
  for (const definition of QUESTION_DEFINITIONS) {
    if (seenDimensions.has(definition.dimension)) continue;
    seenDimensions.add(definition.dimension);
    const stat = dimensionStats.get(definition.dimension) || emptyStats();
    dimensionScores.push({
      key: definition.dimension,
      label: definition.dimensionLabel,
      average: averageStat(stat),
      count: stat.count,
    });
  }

  return jsonResponse({
    ok: true,
    evaluation_schema: "loopi_homepage_feedback_v1",
    version_name: versionName,
    feedback_count: Number(summary?.feedback_count || 0),
    average_score:
      summary?.average_score === null || summary?.average_score === undefined
        ? null
        : Number(summary.average_score),
    latest_feedback_at: summary?.latest_feedback_at || null,
    top_tags: topTags,
    question_scores: questionScores,
    dimension_scores: dimensionScores,
  });
}
