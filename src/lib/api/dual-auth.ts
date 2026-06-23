import { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAuthClient } from "@/lib/supabase/server";

/**
 * Resolve the authenticated user from EITHER a Supabase Bearer token (the
 * Chrome extension sends the session access token) OR the session cookie (the
 * web app). Returns a Supabase client scoped to that user in both cases.
 *
 * Shared by the surfaces the extension and the dashboard both hit
 * (generate-reply, reply-targets, extension/replies) so there is one auth path,
 * not a copy per route.
 */
export async function getDualAuthUser(
  request: NextRequest
): Promise<{ user: { id: string } | null; supabase: SupabaseClient | null }> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) return { user: null, supabase: null };
    return { user, supabase };
  }

  const supabase = await createAuthClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { user: null, supabase: null };
  return { user, supabase: supabase as unknown as SupabaseClient };
}
