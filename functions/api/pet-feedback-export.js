const DEFAULT_VERSION = "loopi_v0_2";
const MAX_EXPORT_ROWS = 500;

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
}

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...init.headers,
    },
  });
}

function cleanVersion(value) {
  const version = String(value || DEFAULT_VERSION).trim().slice(0, 80);
  if (!/^[a-z0-9_.-]+$/i.test(version)) return DEFAULT_VERSION;
  return version;
}

function hasAdminAccess(request, env) {
  const token = env.PET_ADMIN_TOKEN;
  if (!token) return false;

  const auth = request.headers.get("authorization") || "";
  if (auth === `Bearer ${token}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("token") === token;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!hasAdminAccess(request, env)) {
    return jsonResponse({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!env.PET_DB) {
    return jsonResponse({ ok: false, error: "pet_db_binding_missing" }, { status: 500 });
  }

  const url = new URL(request.url);
  const versionName = cleanVersion(url.searchParams.get("version"));
  const limit = Math.min(
    MAX_EXPORT_ROWS,
    Math.max(1, Number(url.searchParams.get("limit") || 100))
  );

  let rows;

  try {
    await ensureFeedbackTable(env.PET_DB);

    rows = await env.PET_DB.prepare(
      `SELECT
         id,
         version_name,
         score,
         tags,
         free_text_feedback,
         page_path,
         source,
         created_at
       FROM pet_feedback
       WHERE version_name = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
      .bind(versionName, limit)
      .all();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "database_export_failed" }, { status: 500 });
  }

  return jsonResponse({
    ok: true,
    version_name: versionName,
    rows: rows.results || [],
  });
}
