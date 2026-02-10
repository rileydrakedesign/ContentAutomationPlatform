-- Tighten user_analytics UPDATE policy: add WITH CHECK to prevent changing user_id

DO $$
BEGIN
  -- Drop the existing policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='user_analytics'
      AND policyname='Users can update their own analytics'
  ) THEN
    DROP POLICY "Users can update their own analytics" ON public.user_analytics;
  END IF;
END$$;

CREATE POLICY "Users can update their own analytics" ON public.user_analytics
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
