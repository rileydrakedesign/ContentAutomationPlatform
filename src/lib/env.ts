// Server env validation, run once at boot from src/instrumentation.ts.
// Throws in production with ALL missing vars listed; warns in development so
// local work without e.g. Stripe keys stays possible.

const REQUIRED_SERVER_ENV_VARS = [
  // Supabase
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  // Stripe
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PRO_PRICE_ID",
  // QStash (scheduled publishing)
  "QSTASH_TOKEN",
  "QSTASH_PUBLISH_URL",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
  // Upstash Redis (rate limiting)
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  // X OAuth (confidential client)
  "X_CLIENT_ID",
  "X_CLIENT_SECRET",
  // AI providers
  "OPENAI_API_KEY",
  "CLAUDE_API_KEY",
  // App
  "CRON_SECRET",
  "NEXT_PUBLIC_APP_URL",
] as const;

export function validateServerEnv(): void {
  const missing = REQUIRED_SERVER_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length === 0) return;

  const message =
    `Missing ${missing.length} required environment variable(s): ` +
    missing.join(", ") +
    ". See .env.example for documentation.";

  if (process.env.NODE_ENV === "production") {
    throw new Error(message);
  }
  console.warn(`[env] ${message} (continuing in development)`);
}
