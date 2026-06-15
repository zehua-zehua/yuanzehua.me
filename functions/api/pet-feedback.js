const MAX_TEXT_LENGTH = 500;
const MAX_TAGS = 12;
const DEFAULT_SOURCE = "real_user";

const ALLOWED_TAGS = new Set([
  "懂技术",
  "有产品感",
  "有亲和力",
  "有记忆点",
  "有点幼稚",
  "不够专业",
  "AI Native",
  "专业可信",
  "轻科技",
  "持续进化",
  "survey:loopi_homepage_feedback_v1",
]);

const STRUCTURED_SCORE_TAG = /^q[1-8]_[a-z0-9_]+:[1-5]$/;

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

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_pet_feedback_visitor_version
        ON pet_feedback (visitor_id_hash, version_name, created_at DESC)`
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

function cleanText(value, maxLength = MAX_TEXT_LENGTH) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanPath(value) {
  const path = cleanText(value, 120);
  return path.startsWith("/") ? path : "/";
}

function cleanVersion(value) {
  const version = cleanText(value, 80);
  if (!/^[a-z0-9_.-]+$/i.test(version)) return "";
  return version;
}

function cleanTags(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const tags = [];

  for (const raw of value) {
    const tag = cleanText(raw, 80);
    const isAllowed = ALLOWED_TAGS.has(tag) || STRUCTURED_SCORE_TAG.test(tag);
    if (!tag || seen.has(tag) || !isAllowed) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= MAX_TAGS) break;
  }

  return tags;
}

async function hashVisitorId(visitorId, env) {
  const salt = env.PET_HASH_SALT || "homepage-pet-default-salt";
  const bytes = new TextEncoder().encode(`${salt}:${visitorId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function parsePayload(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 4096) {
    return { error: "payload_too_large" };
  }

  try {
    return { data: await request.json() };
  } catch (_error) {
    return { error: "invalid_json" };
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.PET_DB) {
    return jsonResponse(
      { ok: false, error: "pet_db_binding_missing" },
      { status: 500 }
    );
  }

  const parsed = await parsePayload(request);
  if (parsed.error) {
    return jsonResponse({ ok: false, error: parsed.error }, { status: 400 });
  }

  const payload = parsed.data || {};
  const versionName = cleanVersion(payload.version_name);
  const score = Number(payload.score);
  const visitorId = cleanText(payload.visitor_id, 120);
  const tags = cleanTags(payload.tags);
  const freeText = cleanText(payload.free_text_feedback);
  const pagePath = cleanPath(payload.page_path);

  if (!versionName) {
    return jsonResponse({ ok: false, error: "version_name_required" }, { status: 400 });
  }

  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return jsonResponse({ ok: false, error: "score_must_be_1_to_5" }, { status: 400 });
  }

  if (!visitorId) {
    return jsonResponse({ ok: false, error: "visitor_id_required" }, { status: 400 });
  }

  const visitorHash = await hashVisitorId(visitorId, env);
  const id = crypto.randomUUID();

  try {
    await ensureFeedbackTable(env.PET_DB);

    await env.PET_DB.prepare(
      `INSERT INTO pet_feedback
        (id, version_name, score, tags, free_text_feedback, page_path, visitor_id_hash, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        versionName,
        score,
        JSON.stringify(tags),
        freeText || null,
        pagePath,
        visitorHash,
        DEFAULT_SOURCE
      )
      .run();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "database_write_failed" }, { status: 500 });
  }

  return jsonResponse({ ok: true, id });
}

export async function onRequestOptions() {
  return jsonResponse({ ok: true });
}
