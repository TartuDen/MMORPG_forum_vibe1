ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'local' CHECK (auth_provider IN ('local', 'google')),
  ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
