import { createBrowserClient } from "@supabase/ssr";

// Browser client for client-side components
// Uses placeholder values during build/SSG — the client is only used at runtime
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key"
  );
}
