-- Migration 0019: Send jobs & delivery event tracking
--
-- send_jobs: a durable, queryable record of every email send request
-- (immediate or scheduled). The send_id returned to callers is this row's id.
-- It tracks the overall job state machine:
--   queued → processing → accepted_by_vendor → delivered
--                                         ↘ retrying → failed (terminal)
--
-- delivery_attempts: one row per provider call attempt, storing the
-- raw response and vendor-assigned message ID for webhook correlation.
--
-- delivery_events: raw webhook payloads indexed by provider event ID
-- for idempotent webhook processing (deduplicate re-deliveries).

CREATE TABLE IF NOT EXISTS send_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK(status IN ('queued', 'processing', 'accepted_by_vendor', 'delivered', 'retrying', 'failed')),
  -- friendly send_id returned to callers
  send_id TEXT NOT NULL UNIQUE,
  -- nullable provider_message_id: populated once the vendor assigns an ID
  provider_message_id TEXT,
  -- nullable job_id: set when this job was triggered from a scheduled_emails row
  scheduled_email_id TEXT,
  -- provider that accepted the message
  vendor_id TEXT,
  vendor_name TEXT,
  -- snapshot of what was sent (for retry / webhook replay)
  payload TEXT NOT NULL,
  -- human-readable error set on terminal failure
  error TEXT,
  -- counts
  attempt_count INTEGER NOT NULL DEFAULT 0,
  -- timestamps
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_send_jobs_send_id
  ON send_jobs(send_id);

CREATE INDEX IF NOT EXISTS idx_send_jobs_tenant
  ON send_jobs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_send_jobs_status
  ON send_jobs(status);

-- delivery_attempts: one row per vendor API call attempt
CREATE TABLE IF NOT EXISTS delivery_attempts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES send_jobs(id),
  vendor_id TEXT,
  vendor_name TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL
    CHECK(status IN ('sent', 'failed')),
  -- the ID the vendor assigned (populated on success)
  provider_message_id TEXT,
  -- vendor's raw HTTP response body (truncated if large)
  vendor_response TEXT,
  duration_ms INTEGER,
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_job_id
  ON delivery_attempts(job_id);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_provider_message_id
  ON delivery_attempts(provider_message_id);

-- delivery_events: raw webhook payloads for idempotency
-- Deduplicate by (provider_name, provider_event_id) within the event window.
-- "event_id" here is the provider's own event/tracking ID, not our UUID.
CREATE TABLE IF NOT EXISTS delivery_events (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES send_jobs(id),
  vendor_name TEXT NOT NULL,
  -- the provider's own event/tracking ID from the webhook payload
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  -- the vendor-assigned message ID this event relates to
  provider_message_id TEXT,
  -- the raw webhook payload so we can replay from durable state
  raw_payload TEXT NOT NULL,
  -- idempotency key: provider_event_id scoped to vendor
  idempotency_key TEXT NOT NULL,
  processed_at TEXT NOT NULL
);

-- Partial unique index: enforce idempotency only on non-null provider_event_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_events_idempotency
  ON delivery_events(idempotency_key, processed_at DESC)
  WHERE provider_event_id IS NOT NULL;
