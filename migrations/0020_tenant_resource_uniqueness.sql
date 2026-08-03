-- Replace global vendor/template uniqueness with tenant-scoped constraints.
PRAGMA foreign_keys = OFF;

CREATE TABLE email_templates_new (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE (tenant_id, slug)
);

INSERT INTO email_templates_new (
  id, tenant_id, slug, subject, content, version, created_at, updated_at
)
SELECT
  id, tenant_id, slug, subject, content, version, created_at, updated_at
FROM email_templates;

DROP TABLE email_templates;
ALTER TABLE email_templates_new RENAME TO email_templates;
CREATE INDEX idx_email_templates_tenant ON email_templates(tenant_id);

CREATE TABLE email_vendors_new (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL,
  api_endpoint TEXT NOT NULL,
  api_token TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL,
  config TEXT,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE (tenant_id, name)
);

INSERT INTO email_vendors_new (
  id, tenant_id, name, enabled, priority, api_endpoint, api_token,
  from_email, from_name, config, created_at, updated_at
)
SELECT
  id, tenant_id, name, enabled, priority, api_endpoint, api_token,
  from_email, from_name, config, created_at, updated_at
FROM email_vendors;

DROP TABLE email_vendors;
ALTER TABLE email_vendors_new RENAME TO email_vendors;
CREATE INDEX idx_email_vendors_tenant ON email_vendors(tenant_id);
CREATE INDEX idx_email_vendors_enabled_priority
  ON email_vendors(tenant_id, enabled, priority);

PRAGMA foreign_keys = ON;
