-- 0019's index included processed_at in the unique key, which defeats its own
-- stated purpose ("enforce idempotency"): two rows can never collide on
-- (idempotency_key, processed_at) since processed_at differs on every insert,
-- so it never actually rejected a genuine duplicate. Replace it with a real
-- single-column unique constraint on idempotency_key alone.
DROP INDEX IF EXISTS idx_delivery_events_idempotency;

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_events_idempotency_key
  ON delivery_events(idempotency_key)
  WHERE provider_event_id IS NOT NULL;
