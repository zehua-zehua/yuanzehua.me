-- Homepage Pet Evolution System
-- Minimal Cloudflare D1 schema.
--
-- The database is intentionally only a feedback inbox. Loopi versions,
-- candidates, reports, and generation notes stay in the git repository.

CREATE TABLE IF NOT EXISTS pet_feedback (
  id TEXT PRIMARY KEY,
  version_name TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  tags TEXT NOT NULL DEFAULT '[]',
  free_text_feedback TEXT,
  page_path TEXT NOT NULL DEFAULT '/',
  visitor_id_hash TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'real_user',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_pet_feedback_version_created
  ON pet_feedback (version_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pet_feedback_visitor_version
  ON pet_feedback (visitor_id_hash, version_name, created_at DESC);
