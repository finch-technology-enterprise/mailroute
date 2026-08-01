-- Migration 0018: Scheduler durability & delivery correlation
--
-- Adds lease columns to scheduled_emails for atomic job claiming:
--   - locked_at: timestamp when a scheduler instance claimed the job
--   - attempt: how many times the job has been attempted
--
-- Adds provider_message_id to both send_logs and scheduled_emails so
-- webhooks can correlate events back to the correct send record
-- without requiring the local UUID.
--
-- For send_logs: store the vendor-assigned message ID on successful send
-- For scheduled_emails: mirror the message ID from the send_log for
--   webhook lookup when the job originated from a scheduled entry

ALTER TABLE scheduled_emails
  ADD COLUMN locked_at TEXT;

ALTER TABLE scheduled_emails
  ADD COLUMN attempt INTEGER NOT NULL DEFAULT 0;

ALTER TABLE scheduled_emails
  ADD COLUMN provider_message_id TEXT;

-- Index for the atomic claim query: find due pending jobs and expired leases
-- efficiently. The partial expression index on (status, send_at) is already
-- covered by idx_scheduled_emails_status_send_at.
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_locked_at
  ON scheduled_emails(locked_at);

-- Add provider_message_id to send_logs so webhooks can look up by
-- the vendor's message ID rather than our internal UUID.
ALTER TABLE send_logs
  ADD COLUMN provider_message_id TEXT;

-- Index for webhook lookups by provider-assigned ID
CREATE INDEX IF NOT EXISTS idx_send_logs_provider_message_id
  ON send_logs(provider_message_id);

-- Composite index covering the circuit-breaker query shape:
-- SELECT vendor_id, status, COUNT(*) FROM send_logs
--   WHERE tenant_id = ? AND created_at > ? GROUP BY vendor_id, status
CREATE INDEX IF NOT EXISTS idx_send_logs_tenant_created
  ON send_logs(tenant_id, created_at DESC);
