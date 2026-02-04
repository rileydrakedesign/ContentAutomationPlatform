import { createBrowserClient } from "@supabase/ssr";

// Runtime config injected from server layout via script tag
function getSupabaseConfig() {
  // In browser: read from window (injected at runtime by server layout)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = typeof window !== "undefined" ? (window as any) : null;
  if (win?.__SUPABASE_CONFIG__) {
    return win.__SUPABASE_CONFIG__ as { url: string; anonKey: string };
  }
  // Fallback to env vars (works locally and during SSG)
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key",
  };
}

// Browser client for client-side components
export function createClient() {
  const { url, anonKey } = getSupabaseConfig();
  return createBrowserClient(url, anonKey);
}
