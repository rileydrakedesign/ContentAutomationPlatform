-- Index to support boost-opportunities query:
--   WHERE user_id = ? AND is_own_post = true AND post_timestamp >= ?
--   ORDER BY post_timestamp DESC
CREATE INDEX IF NOT EXISTS idx_captured_posts_boost
  ON captured_posts (user_id, is_own_post, post_timestamp DESC)
  WHERE is_own_post = true;
