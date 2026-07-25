CREATE TABLE IF NOT EXISTS tracking_events (
  id TEXT PRIMARY KEY,
  send_id TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT,
  user_agent TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_send_id ON tracking_events(send_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_type ON tracking_events(type);
