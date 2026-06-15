const DEFAULT_VERSION = "loopi_v0_1";
const MAX_EXPORT_ROWS = 500;

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

  const rows = await env.PET_DB.prepare(
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

  return jsonResponse({
    ok: true,
    version_name: versionName,
    rows: rows.results || [],
  });
}
