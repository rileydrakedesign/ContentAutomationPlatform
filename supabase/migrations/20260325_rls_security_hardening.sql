-- ============================================================
-- RLS Security Hardening Migration
-- Adds Row-Level Security to all user-facing tables that were
-- missing it. Critical for multi-tenant safety before launch.
-- ============================================================

-- ============================================================
-- 1. x_connections (CRITICAL: contains OAuth tokens)
-- ============================================================
ALTER TABLE x_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "x_connections_select_own"
  ON x_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "x_connections_insert_own"
  ON x_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "x_connections_update_own"
  ON x_connections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "x_connections_delete_own"
  ON x_connections FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 2. api_keys (CRITICAL: contains API key hashes)
-- ============================================================
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_select_own"
  ON api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "api_keys_insert_own"
  ON api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "api_keys_update_own"
  ON api_keys FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "api_keys_delete_own"
  ON api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. x_oauth_requests (HIGH: contains OAuth secrets in-flight)
-- ============================================================
ALTER TABLE x_oauth_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "x_oauth_requests_select_own"
  ON x_oauth_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "x_oauth_requests_insert_own"
  ON x_oauth_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "x_oauth_requests_update_own"
  ON x_oauth_requests FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "x_oauth_requests_delete_own"
  ON x_oauth_requests FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 4. user_voice_settings (HIGH: per-user AI config)
-- ============================================================
ALTER TABLE user_voice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_voice_settings_select_own"
  ON user_voice_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_voice_settings_insert_own"
  ON user_voice_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_voice_settings_update_own"
  ON user_voice_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_voice_settings_delete_own"
  ON user_voice_settings FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 5. user_voice_examples (HIGH: per-user voice training data)
-- ============================================================
ALTER TABLE user_voice_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_voice_examples_select_own"
  ON user_voice_examples FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_voice_examples_insert_own"
  ON user_voice_examples FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_voice_examples_update_own"
  ON user_voice_examples FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_voice_examples_delete_own"
  ON user_voice_examples FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 6. inspiration_posts (HIGH: per-user saved posts)
-- ============================================================
ALTER TABLE inspiration_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspiration_posts_select_own"
  ON inspiration_posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "inspiration_posts_insert_own"
  ON inspiration_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "inspiration_posts_update_own"
  ON inspiration_posts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "inspiration_posts_delete_own"
  ON inspiration_posts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 7. extracted_patterns (HIGH: per-user AI patterns)
-- ============================================================
ALTER TABLE extracted_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extracted_patterns_select_own"
  ON extracted_patterns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "extracted_patterns_insert_own"
  ON extracted_patterns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "extracted_patterns_update_own"
  ON extracted_patterns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "extracted_patterns_delete_own"
  ON extracted_patterns FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 8. captured_posts (HIGH: per-user synced posts + analytics)
-- ============================================================
ALTER TABLE captured_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "captured_posts_select_own"
  ON captured_posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "captured_posts_insert_own"
  ON captured_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "captured_posts_update_own"
  ON captured_posts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "captured_posts_delete_own"
  ON captured_posts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 9. drafts (HIGH: per-user generated content)
-- ============================================================
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drafts_select_own"
  ON drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "drafts_insert_own"
  ON drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "drafts_update_own"
  ON drafts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "drafts_delete_own"
  ON drafts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 10. user_settings (MEDIUM: per-user settings)
-- ============================================================
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings_select_own"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_settings_insert_own"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_update_own"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_delete_own"
  ON user_settings FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 11. waitlist_signups (MEDIUM: lock down email list)
-- Block all client-side access. Server uses service role key.
-- ============================================================
ALTER TABLE waitlist_signups ENABLE ROW LEVEL SECURITY;
-- No policies = no client access. Service role key bypasses RLS.

-- ============================================================
-- 12. Fix user_niche_profile UPDATE policy (add WITH CHECK)
-- ============================================================
DROP POLICY IF EXISTS "user_niche_profile_update" ON user_niche_profile;
CREATE POLICY "user_niche_profile_update"
  ON user_niche_profile FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
