ALTER TABLE public.x_connections
  ADD COLUMN IF NOT EXISTS last_api_sync_at timestamptz;
