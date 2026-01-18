ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS email_verifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token_hash ON email_verifications(token_hash);
