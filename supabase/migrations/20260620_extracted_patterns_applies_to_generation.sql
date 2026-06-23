-- Persist, at extraction time, whether a pattern shapes the content text the
-- generation model writes (vs. timing/post-type/visual patterns that are real
-- insights but not things the writer controls). Backfilled NULL so the runtime
-- helper isGenerationApplicablePattern() decides for already-stored rows.
ALTER TABLE extracted_patterns
  ADD COLUMN IF NOT EXISTS applies_to_generation boolean;

COMMENT ON COLUMN extracted_patterns.applies_to_generation IS
  'Whether this pattern is applied to text generation (content-shaping). NULL = decide at runtime via isGenerationApplicablePattern. Timing/post-type/visual patterns are false; they remain visible in the Voice Report as insight.';
