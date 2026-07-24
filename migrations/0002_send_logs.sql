CREATE TABLE IF NOT EXISTS send_logs (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('sent', 'failed')),
  error TEXT,
  template_slug TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_send_logs_created_at ON send_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_send_logs_vendor ON send_logs(vendor_name);
CREATE INDEX IF NOT EXISTS idx_send_logs_status ON send_logs(status);
