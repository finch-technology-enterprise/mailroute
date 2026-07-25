-- Track login attempts for brute-force protection

CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  attempted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
  ON login_attempts(email, attempted_at);

CREATE INDEX IF NOT EXISTS idx_login_attempts_cleanup
  ON login_attempts(attempted_at);
