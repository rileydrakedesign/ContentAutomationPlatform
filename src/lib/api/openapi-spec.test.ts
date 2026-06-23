import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { openApiSpec } from "./openapi-spec";

/**
 * Structural drift guard: the set of (METHOD + path) pairs documented in the
 * OpenAPI spec must equal the set implemented under src/app/api/v1. Adding or
 * removing a route without updating the spec fails this test.
 *
 * It is intentionally structural (presence of path + method), not a per-field
 * diff. Two infrastructure routes are excluded because they are not part of
 * the documented REST contract:
 *   - /openapi.json — serves the spec itself.
 *   - /mcp          — the hosted MCP gateway (OAuth 2.1, streamable HTTP), not
 *                     an API-key REST endpoint. It is documented via the spec's
 *                     externalDocs pointer + the "## MCP" section, by design.
 */
const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;
const EXCLUDED_PATHS = new Set(["/openapi.json", "/mcp"]);

const here = dirname(fileURLToPath(import.meta.url));
const v1Dir = resolve(here, "..", "..", "app", "api", "v1");

/** All "METHOD /path" pairs declared in the spec. */
function specPairs(): Set<string> {
  const pairs = new Set<string>();
  const paths = openApiSpec.paths as Record<string, Record<string, unknown>>;
  for (const [path, ops] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      if (ops[method]) pairs.add(`${method.toUpperCase()} ${path}`);
    }
  }
  return pairs;
}

/** Recursively find every route.ts under src/app/api/v1. */
function findRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...findRouteFiles(full));
    else if (entry.name === "route.ts") out.push(full);
  }
  return out;
}

/** Map a route.ts file to its API path ([id] -> {id}, dir -> /). */
function filePathToApiPath(file: string): string {
  const rel = relative(v1Dir, dirname(file));
  if (rel === "") return "/";
  const segments = rel.split(/[/\\]/).map((s) => s.replace(/^\[(.+)\]$/, "{$1}"));
  return "/" + segments.join("/");
}

/** All "METHOD /path" pairs implemented in the route handlers (minus OPTIONS). */
function implementedPairs(): Set<string> {
  const pairs = new Set<string>();
  for (const file of findRouteFiles(v1Dir)) {
    const apiPath = filePathToApiPath(file);
    if (EXCLUDED_PATHS.has(apiPath)) continue;
    const src = readFileSync(file, "utf8");
    const re = /export\s+(?:const|async\s+function)\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      pairs.add(`${m[1]} ${apiPath}`);
    }
  }
  return pairs;
}

describe("openapi spec / route consistency", () => {
  it("documents exactly the implemented v1 routes (path + method)", () => {
    const spec = specPairs();
    const impl = implementedPairs();

    const undocumented = [...impl].filter((p) => !spec.has(p)).sort();
    const phantom = [...spec].filter((p) => !impl.has(p)).sort();

    expect(undocumented, "routes implemented but missing from the spec").toEqual([]);
    expect(phantom, "paths in the spec with no matching route handler").toEqual([]);
  });
});
