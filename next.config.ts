import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            // Report-Only to start: observe violations before enforcing.
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/inbox",
        destination: "/library",
        permanent: true,
      },
      {
        source: "/my-posts",
        destination: "/library?filter=my_posts",
        permanent: true,
      },
      {
        source: "/inspiration",
        destination: "/library?filter=inspiration",
        permanent: true,
      },
      {
        source: "/sources",
        destination: "/create",
        permanent: true,
      },
      {
        source: "/drafts",
        destination: "/create?tab=drafts",
        permanent: true,
      },
      {
        source: "/drafts/generate",
        destination: "/create",
        permanent: true,
      },
      {
        source: "/collections",
        destination: "/library",
        permanent: true,
      },
      {
        source: "/collections/:id",
        destination: "/library",
        permanent: true,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "agents-for-x",
  project: "javascript-nextjs",

  // Auth token for source map upload — set SENTRY_AUTH_TOKEN in CI/Vercel only.
  // No-op locally when unset, so dev builds skip the upload step.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print upload logs in CI; keep local builds quiet.
  silent: !process.env.CI,

  // Upload a wider set of client source maps for prettier stack traces.
  widenClientFileUpload: true,

  // Tree-shake Sentry logger statements to shrink the client bundle.
  disableLogger: true,
});
