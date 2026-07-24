-- Seed default tenant for existing data
-- Generates deterministic UUIDs for the default tenant and user
-- so re-running is safe.
INSERT OR IGNORE INTO tenants (id, name, slug, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default', 'default', datetime('now'), datetime('now'));

-- Backfill tenant_id for all existing rows
UPDATE email_templates SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = '';
UPDATE email_vendors   SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = '';
UPDATE service_config  SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = '';
UPDATE send_logs       SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = '';
UPDATE activity_logs   SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = '';
UPDATE push_subscriptions SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id = '';
