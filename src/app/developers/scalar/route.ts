/**
 * Serves the Scalar standalone browser bundle from our own origin so the
 * /developers reference has no CDN/runtime third-party dependency and stays
 * CSP `'self'`-clean. The file is read once from the installed
 * @scalar/api-reference package and cached in memory.
 *
 * next.config.ts's `outputFileTracingIncludes` forces this bundle into the
 * serverless function for this route so the file exists in production.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";

// Plain runtime path (not require.resolve) so the bundler doesn't try to turn
// the 4 MB bundle into a module graph node. `outputFileTracingIncludes` in
// next.config.ts keeps this file at the same relative path in production.
const BUNDLE_PATH = join(
  process.cwd(),
  "node_modules/@scalar/api-reference/dist/browser/standalone.js"
);

let cached: string | null = null;

function loadBundle(): string {
  if (cached === null) {
    cached = readFileSync(BUNDLE_PATH, "utf8");
  }
  return cached;
}

export function GET() {
  return new Response(loadBundle(), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Immutable per deploy; the bundle version is pinned by the package.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
