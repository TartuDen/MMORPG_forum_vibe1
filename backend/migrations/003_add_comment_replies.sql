ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_comment_id);
