-- Seed/migrate the email_vendors table.
-- Apply locally:  wrangler d1 execute <DB_NAME> --local --file scripts/seed-email-vendors.sql
-- Apply remote:   wrangler d1 execute <DB_NAME> --remote --file scripts/seed-email-vendors.sql
-- Replace the REPLACE_WITH_* placeholders before running against remote.

CREATE TABLE IF NOT EXISTS email_vendors (
  id TEXT PRIMARY KEY,
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

-- Sender.net: primary, enabled. Replace with your endpoint and token.
INSERT OR REPLACE INTO email_vendors
  (id, name, enabled, priority, api_endpoint, api_token, from_email, from_name, config, created_at, updated_at)
VALUES
  ('sender', 'sender', 1, 1, 'REPLACE_WITH_SENDER_API_ENDPOINT', 'REPLACE_WITH_SENDER_API_TOKEN', 'no-reply@example.com', 'Your Company', NULL, datetime('now'), datetime('now'));

-- Brevo: fallback, disabled until a real token is filled in. Endpoint is fixed.
INSERT OR REPLACE INTO email_vendors
  (id, name, enabled, priority, api_endpoint, api_token, from_email, from_name, config, created_at, updated_at)
VALUES
  ('brevo', 'brevo', 0, 2, 'https://api.brevo.com/v3/smtp/email', 'REPLACE_WITH_BREVO_API_TOKEN', 'no-reply@example.com', 'Your Company', NULL, datetime('now'), datetime('now'));
