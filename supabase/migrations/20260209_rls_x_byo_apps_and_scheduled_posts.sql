-- Enable RLS + policies for BYO X credentials and scheduled posts
-- Idempotent-ish: uses DO blocks to avoid errors if policies already exist.

-- x_byo_apps
alter table if exists public.x_byo_apps enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='x_byo_apps' AND policyname='x_byo_apps_select_own'
  ) THEN
    CREATE POLICY x_byo_apps_select_own ON public.x_byo_apps
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='x_byo_apps' AND policyname='x_byo_apps_insert_own'
  ) THEN
    CREATE POLICY x_byo_apps_insert_own ON public.x_byo_apps
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='x_byo_apps' AND policyname='x_byo_apps_update_own'
  ) THEN
    CREATE POLICY x_byo_apps_update_own ON public.x_byo_apps
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='x_byo_apps' AND policyname='x_byo_apps_delete_own'
  ) THEN
    CREATE POLICY x_byo_apps_delete_own ON public.x_byo_apps
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END$$;

-- scheduled_posts
alter table if exists public.scheduled_posts enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scheduled_posts' AND policyname='scheduled_posts_select_own'
  ) THEN
    CREATE POLICY scheduled_posts_select_own ON public.scheduled_posts
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scheduled_posts' AND policyname='scheduled_posts_insert_own'
  ) THEN
    CREATE POLICY scheduled_posts_insert_own ON public.scheduled_posts
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scheduled_posts' AND policyname='scheduled_posts_update_own'
  ) THEN
    CREATE POLICY scheduled_posts_update_own ON public.scheduled_posts
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scheduled_posts' AND policyname='scheduled_posts_delete_own'
  ) THEN
    CREATE POLICY scheduled_posts_delete_own ON public.scheduled_posts
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END$$;
