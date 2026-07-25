-- Performance indexes for common query patterns

CREATE INDEX IF NOT EXISTS idx_vendors_tenant_enabled
  ON email_vendors(tenant_id, enabled, priority);

CREATE INDEX IF NOT EXISTS idx_templates_tenant_slug
  ON email_templates(tenant_id, slug);

CREATE INDEX IF NOT EXISTS idx_send_logs_tenant_created
  ON send_logs(tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_created
  ON activity_logs(tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant
  ON api_keys(tenant_id);

CREATE INDEX IF NOT EXISTS idx_users_tenant
  ON users(tenant_id);

CREATE INDEX IF NOT EXISTS idx_push_subs_tenant
  ON push_subscriptions(tenant_id);
