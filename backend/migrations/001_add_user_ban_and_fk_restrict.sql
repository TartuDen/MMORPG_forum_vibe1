-- Add ban fields to users and tighten user foreign keys.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS banned_reason TEXT;

ALTER TABLE threads
  DROP CONSTRAINT IF EXISTS threads_user_id_fkey,
  ADD CONSTRAINT threads_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE comments
  DROP CONSTRAINT IF EXISTS comments_user_id_fkey,
  ADD CONSTRAINT comments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
