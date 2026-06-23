-- Capture the previously-applied remote fix: extracted_patterns.source_post_ids
-- stores tweet IDs (text), not internal uuids. The column was changed from
-- uuid[] -> text[] directly on the remote DB; this file records that change so
-- the repo migration history is complete. Idempotent: only converts if still uuid[].
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extracted_patterns'
      AND column_name = 'source_post_ids'
      AND udt_name = '_uuid'
  ) THEN
    ALTER TABLE extracted_patterns
      ALTER COLUMN source_post_ids TYPE text[]
      USING source_post_ids::text[];
  END IF;
END $$;
