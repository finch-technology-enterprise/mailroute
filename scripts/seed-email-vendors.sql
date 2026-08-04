-- Seed/migrate the email_vendors table for the default tenant (see
-- migrations/0009_seed_default_tenant.sql). Requires migrations through
-- 0020 to already be applied (email_vendors is tenant-scoped).
-- Apply locally:  wrangler d1 execute <DB_NAME> --local --file scripts/seed-email-vendors.sql
-- Apply remote:   wrangler d1 execute <DB_NAME> --remote --file scripts/seed-email-vendors.sql
-- Replace the REPLACE_WITH_* placeholders before running against remote.

-- Sender.net: primary, enabled. Replace with your endpoint and token.
INSERT OR REPLACE INTO email_vendors
  (id, tenant_id, name, enabled, priority, api_endpoint, api_token, from_email, from_name, config, created_at, updated_at)
VALUES
  ('sender', '00000000-0000-0000-0000-000000000001', 'sender', 1, 1, 'REPLACE_WITH_SENDER_API_ENDPOINT', 'REPLACE_WITH_SENDER_API_TOKEN', 'placeholder@example.com', 'Your Name', NULL, datetime('now'), datetime('now'));

-- Brevo: fallback, disabled until a real token is filled in. Endpoint is fixed.
INSERT OR REPLACE INTO email_vendors
  (id, tenant_id, name, enabled, priority, api_endpoint, api_token, from_email, from_name, config, created_at, updated_at)
VALUES
  ('brevo', '00000000-0000-0000-0000-000000000001', 'brevo', 0, 2, 'https://api.brevo.com/v3/smtp/email', 'REPLACE_WITH_BREVO_API_TOKEN', 'placeholder@example.com', 'Your Name', NULL, datetime('now'), datetime('now'));
