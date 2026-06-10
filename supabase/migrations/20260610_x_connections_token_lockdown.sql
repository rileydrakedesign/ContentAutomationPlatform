-- Lock down X OAuth token columns. RLS limits clients to their own row, but the
-- SELECT policy still exposed plaintext access_token / refresh_token /
-- access_token_secret to the browser (any XSS could exfiltrate them).
-- Column-level privileges: revoke table SELECT from client roles and re-grant
-- only the non-secret columns. Server code reads tokens via the service role
-- (src/lib/x-api/client.ts getValidAccessToken).
REVOKE SELECT ON public.x_connections FROM anon, authenticated;

GRANT SELECT (
  id,
  user_id,
  x_user_id,
  x_username,
  last_sync_at,
  last_api_sync_at,
  created_at,
  updated_at,
  access_token_expires_at
) ON public.x_connections TO authenticated;
