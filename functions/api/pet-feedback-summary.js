const DEFAULT_VERSION = "loopi_v0_1";

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

  const summary = await env.PET_DB.prepare(
    `SELECT
       COUNT(*) AS feedback_count,
       AVG(score) AS average_score,
       MAX(created_at) AS latest_feedback_at
     FROM pet_feedback
     WHERE version_name = ?`
  )
    .bind(versionName)
    .first();

  const tagRows = await env.PET_DB.prepare(
    `SELECT tags FROM pet_feedback WHERE version_name = ? ORDER BY created_at DESC LIMIT 500`
  )
    .bind(versionName)
    .all();

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
