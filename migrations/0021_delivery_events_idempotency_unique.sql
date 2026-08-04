-- NOTE: this turned out to be a no-op. 0019 already created an index with
-- this exact name (a composite one that doesn't actually enforce
-- idempotency — see 0022, which drops and replaces it). IF NOT EXISTS
-- silently skipped this CREATE against the real database. Left as-is,
-- unedited, since it already ran; 0022 is the migration that matters.
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_events_idempotency
  ON delivery_events(idempotency_key);
