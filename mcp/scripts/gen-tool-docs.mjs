#!/usr/bin/env node
/**
 * Writes docs/mcp/tools.generated.md from the built tool-doc generator.
 * Run via `npm run gen-docs` (which builds first). The generated file is
 * committed; the mcp test suite asserts it stays in sync with tools.ts.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateToolDocsMarkdown } from "../dist/tool-doc-gen.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const outPath = resolve(repoRoot, "docs", "mcp", "tools.generated.md");

const markdown = await generateToolDocsMarkdown();
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, markdown, "utf8");
console.log(`Wrote ${outPath} (${markdown.split("\n").length} lines)`);
