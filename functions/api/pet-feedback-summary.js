const DEFAULT_VERSION = "loopi_v0_1";

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
  for (const row of tagRows.results || []) {
    for (const tag of parseTags(row.tags)) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));

  return jsonResponse({
    ok: true,
    version_name: versionName,
    feedback_count: Number(summary?.feedback_count || 0),
    average_score:
      summary?.average_score === null || summary?.average_score === undefined
        ? null
        : Number(summary.average_score),
    latest_feedback_at: summary?.latest_feedback_at || null,
    top_tags: topTags,
  });
}
