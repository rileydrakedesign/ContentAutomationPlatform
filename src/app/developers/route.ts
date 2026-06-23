/**
 * Public, standalone API reference page (Scalar).
 *
 * This is intentionally a route handler returning raw HTML, NOT a React page —
 * so it lives entirely OUTSIDE the authenticated app shell (no AuthProvider,
 * sidebar, providers, or `max-w-5xl` wrapper from src/app/layout.tsx). That
 * keeps it public, self-contained, and cheap to render: the heavy Scalar bundle
 * loads as a single same-origin script instead of mounting inside the whole
 * client app (which made the embedded React version slow/crash).
 *
 * The bundle is self-hosted from /developers/scalar (see ./scalar/route.ts) so
 * there is no CDN dependency and the page stays CSP `'self'`-clean.
 *
 * `/developers` is allowlisted in src/proxy.ts so it does not require login.
 */
export const runtime = "nodejs";

const CONFIG = JSON.stringify({
  darkMode: true,
  layout: "modern",
  theme: "purple",
  hiddenClients: [
    "php", "ruby", "swift", "kotlin", "java", "csharp", "clojure",
    "powershell", "r", "objc",
  ],
  authentication: { preferredSecurityScheme: "bearerAuth" },
  metaData: { title: "Agents For X — API Reference" },
});

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Agents For X — API Reference</title>
    <link rel="icon" href="/favicon.ico" />
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #0b0b0f; }
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/api/v1/openapi.json"
      data-configuration='${CONFIG.replace(/'/g, "&#39;")}'
    ></script>
    <script src="/developers/scalar"></script>
  </body>
</html>`;

export function GET() {
  return new Response(HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Page is tiny; the spec + bundle have their own caching.
      "Cache-Control": "public, max-age=300",
    },
  });
}
