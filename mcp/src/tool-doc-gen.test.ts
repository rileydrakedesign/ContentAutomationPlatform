import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateToolDocsMarkdown, collectToolDocs } from "./tool-doc-gen";

const here = dirname(fileURLToPath(import.meta.url));
const docPath = resolve(here, "..", "..", "docs", "mcp", "tools.generated.md");

describe("generated MCP tool reference", () => {
  it("matches the committed docs/mcp/tools.generated.md (run `npm run gen-docs`)", async () => {
    const generated = await generateToolDocsMarkdown();
    const onDisk = readFileSync(docPath, "utf8");
    expect(generated).toBe(onDisk);
  });

  it("regenerates deterministically", async () => {
    const a = await generateToolDocsMarkdown();
    const b = await generateToolDocsMarkdown();
    expect(a).toBe(b);
  });

  it("resolves a REST endpoint and inputs for every tool", async () => {
    const docs = await collectToolDocs();
    expect(docs).toHaveLength(36);
    for (const d of docs) {
      expect(d.endpoint, `${d.name} should map to a REST endpoint`).toMatch(
        /^(GET|POST|PATCH|PUT|DELETE) \/api\/v1\//
      );
      expect(d.cost.length, `${d.name} should have a cost note`).toBeGreaterThan(0);
    }
  });
});
