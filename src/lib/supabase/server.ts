import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server client with cookie-based auth for API routes and server components
export async function createAuthClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method is called from a Server Component
          // This can be ignored if you have middleware refreshing user sessions
        }
      },
    },
  });
}

// Server client with service role key for admin operations (bypasses RLS)
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
  });
}

// Helper to get current user from auth client
export async function getCurrentUser() {
  const supabase = await createAuthClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }
  return user;
}

// Helper to require authentication (throws if not authenticated)
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
