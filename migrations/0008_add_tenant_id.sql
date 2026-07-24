ALTER TABLE email_templates ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_email_templates_tenant ON email_templates(tenant_id);

ALTER TABLE email_vendors ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_email_vendors_tenant ON email_vendors(tenant_id);

ALTER TABLE service_config ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_service_config_tenant ON service_config(tenant_id);

ALTER TABLE send_logs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_send_logs_tenant ON send_logs(tenant_id);

ALTER TABLE activity_logs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant ON activity_logs(tenant_id);

ALTER TABLE push_subscriptions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_tenant ON push_subscriptions(tenant_id);
