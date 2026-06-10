import * as Sentry from "@sentry/nextjs";

export async function register() {
  // No-op when SENTRY_DSN is unset (e.g. local dev).
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    enabled: Boolean(process.env.SENTRY_DSN),
    tracesSampleRate: 0.1,
  });
}

export const onRequestError = Sentry.captureRequestError;
