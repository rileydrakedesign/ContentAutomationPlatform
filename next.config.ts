import type { NextConfig } from "next";

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

export default nextConfig;
