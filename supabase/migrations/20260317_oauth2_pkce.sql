-- Add OAuth 2.0 columns to x_connections
ALTER TABLE public.x_connections
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS access_token_expires_at timestamptz;
ALTER TABLE public.x_connections
  ALTER COLUMN access_token_secret DROP NOT NULL;

-- Update x_oauth_requests for PKCE flow
ALTER TABLE public.x_oauth_requests
  ADD COLUMN IF NOT EXISTS code_verifier text,
  ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.x_oauth_requests
  ALTER COLUMN oauth_token DROP NOT NULL,
  ALTER COLUMN oauth_token_secret DROP NOT NULL;
