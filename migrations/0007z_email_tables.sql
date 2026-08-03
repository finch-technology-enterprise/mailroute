-- Backfill the two legacy tables that predated the migration directory.
-- Existing databases already have them; fresh databases need them before 0008.
CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS email_vendors (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL,
  api_endpoint TEXT NOT NULL,
  api_token TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL,
  config TEXT,
  created_at TEXT,
  updated_at TEXT
);
