CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs(type);
