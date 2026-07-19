-- Central, multi-service configuration store.
-- Apply to the shared D1 database that every microservice binds as D1_DATABASE:
--   wrangler d1 execute <DB_NAME> --remote --file ./migrations/0001_service_config.sql
--
-- service = '*'  -> shared by every microservice
-- service = '<service-name>' -> overrides the shared value for this service

CREATE TABLE IF NOT EXISTS service_config (
  service    TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at TEXT,
  PRIMARY KEY (service, key)
);

-- Seed template — replace the placeholder values, then run with the command
-- above (or paste into the D1 console). Re-running is safe (INSERT OR REPLACE).

-- Shared across all microservices:
INSERT OR REPLACE INTO service_config (service, key, value, updated_at) VALUES
  ('*', 'APP_ENVIRONMENT',       'development',                         datetime('now')),
  ('*', 'NEW_RELIC_LICENSE_KEY', '<NEW_RELIC_LICENSE_KEY>',            datetime('now')),
  ('*', 'NEW_RELIC_LOG_ENDPOINT','https://log-api.newrelic.com/log/v1', datetime('now')),
  ('*', 'SENDER_API_ENDPOINT',   'https://api.sender.example.com/v2/...', datetime('now'));

-- Specific to this service:
INSERT OR REPLACE INTO service_config (service, key, value, updated_at) VALUES
  ('email-microservice', 'API_AUTH_KEY',     '<API_AUTH_KEY>', datetime('now')),
  ('email-microservice', 'SENDER_API_TOKEN', '<SENDER_API_TOKEN>', datetime('now')),
  ('email-microservice', 'APP_URL',          '<APP_URL>', datetime('now'));
