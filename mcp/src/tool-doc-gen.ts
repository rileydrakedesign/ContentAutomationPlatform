/**
 * Generates the per-tool MCP reference (docs/mcp/tools.generated.md) from the
 * single source of truth: the Zod input schemas + descriptions registered in
 * tools.ts. Nothing here is hand-maintained — re-running reproduces the file
 * byte-for-byte, so the doc cannot silently drift from the tool definitions.
 *
 * How it works:
 *   1. Run registerTools() against a capturing stub server to collect each
 *      tool's name, title, description, and raw Zod input shape.
 *   2. Invoke each tool's handler with a recording fake ApiClient to discover
 *      which v1 REST endpoint (METHOD + path) it maps to.
 *   3. Introspect the Zod shapes for input types/required/enum/min-max.
 *   4. Derive the credit cost from the (tested) description prose.
 *   5. Render deterministic Markdown (tools sorted by name).
 */
import { z } from "zod";
import { registerTools } from "./tools";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "./client";

interface CapturedTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

interface InputDoc {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  enumValues?: string[];
  min?: number;
  max?: number;
  description?: string;
}

interface ToolDoc {
  name: string;
  title?: string;
  description: string;
  endpoint: string;
  cost: string;
  inputs: InputDoc[];
}

/** Collect every registered tool with its config and handler. */
function captureTools(): CapturedTool[] {
  const tools: CapturedTool[] = [];
  const stubServer = {
    registerTool(
      name: string,
      config: { title?: string; description?: string; inputSchema?: Record<string, z.ZodTypeAny> },
      handler: (args: Record<string, unknown>) => Promise<unknown>
    ) {
      tools.push({
        name,
        title: config.title,
        description: config.description ?? "",
        inputSchema: config.inputSchema ?? {},
        handler,
      });
    },
  };
  // registerTools only ever calls server.registerTool; the cast is safe.
  registerTools(stubServer as unknown as McpServer, makeRecordingApi().api);
  return tools;
}

/** A fake ApiClient that records the first REST call a handler makes. */
function makeRecordingApi(): {
  api: ApiClient;
  state: { last: { method: string; path: string } | null };
} {
  const state: { last: { method: string; path: string } | null } = { last: null };
  const record = (method: string) => (path: string) => {
    if (!state.last) state.last = { method, path };
    return Promise.resolve({});
  };
  const api = {
    lastCredits: {},
    get: record("GET"),
    post: record("POST"),
    patch: record("PATCH"),
    put: record("PUT"),
    del: record("DELETE"),
  };
  return { api: api as unknown as ApiClient, state };
}

/** Unwrap optional/default/nullable layers, tracking required + default. */
function unwrap(schema: z.ZodTypeAny): {
  inner: z.ZodTypeAny;
  optional: boolean;
  defaultValue?: unknown;
} {
  let inner = schema;
  let optional = false;
  let defaultValue: unknown;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const def = (inner as { _def?: { typeName?: string; innerType?: z.ZodTypeAny; defaultValue?: () => unknown } })._def;
    if (!def) break;
    if (def.typeName === "ZodOptional" || def.typeName === "ZodNullable") {
      optional = true;
      inner = def.innerType as z.ZodTypeAny;
    } else if (def.typeName === "ZodDefault") {
      optional = true;
      defaultValue = def.defaultValue?.();
      inner = def.innerType as z.ZodTypeAny;
    } else {
      break;
    }
  }
  return { inner, optional, defaultValue };
}

function numericChecks(inner: z.ZodTypeAny): { min?: number; max?: number; int?: boolean } {
  const checks = (inner as { _def?: { checks?: Array<{ kind: string; value?: number }> } })._def?.checks ?? [];
  let min: number | undefined;
  let max: number | undefined;
  let int = false;
  for (const c of checks) {
    if (c.kind === "min") min = c.value;
    if (c.kind === "max") max = c.value;
    if (c.kind === "int") int = true;
  }
  return { min, max, int };
}

function describeType(inner: z.ZodTypeAny): { type: string; enumValues?: string[]; min?: number; max?: number } {
  const typeName = (inner as { _def?: { typeName?: string } })._def?.typeName;
  switch (typeName) {
    case "ZodString": {
      const { min, max } = numericChecks(inner);
      return { type: "string", min, max };
    }
    case "ZodNumber": {
      const { min, max, int } = numericChecks(inner);
      return { type: int ? "integer" : "number", min, max };
    }
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodEnum":
      return { type: "enum", enumValues: (inner as unknown as { options: string[] }).options };
    case "ZodArray": {
      const el = (inner as { _def: { type: z.ZodTypeAny } })._def.type;
      const elDesc = describeType(unwrap(el).inner);
      return { type: `${elDesc.type}[]` };
    }
    case "ZodObject":
      return { type: "object" };
    case "ZodRecord":
      return { type: "object (map)" };
    case "ZodUnion":
      return { type: "object (one of several shapes)" };
    case "ZodUnknown":
    case "ZodAny":
      return { type: "any" };
    default:
      return { type: typeName ? typeName.replace(/^Zod/, "").toLowerCase() : "unknown" };
  }
}

function introspectInputs(shape: Record<string, z.ZodTypeAny>): InputDoc[] {
  return Object.entries(shape).map(([name, schema]) => {
    const { inner, optional, defaultValue } = unwrap(schema);
    const t = describeType(inner);
    const description = (schema as { _def?: { description?: string } })._def?.description
      ?? (inner as { _def?: { description?: string } })._def?.description;
    return {
      name,
      type: t.type,
      required: !optional,
      default: defaultValue !== undefined ? JSON.stringify(defaultValue) : undefined,
      enumValues: t.enumValues,
      min: t.min,
      max: t.max,
      description,
    };
  });
}

/** Build a representative value so the handler reaches its REST call. */
function sampleValue(name: string, schema: z.ZodTypeAny): unknown {
  const { inner, defaultValue } = unwrap(schema);
  if (defaultValue !== undefined) return defaultValue;
  const typeName = (inner as { _def?: { typeName?: string } })._def?.typeName;
  switch (typeName) {
    case "ZodString":
      return `:${name}`;
    case "ZodNumber": {
      const { min } = numericChecks(inner);
      return min ?? 1;
    }
    case "ZodBoolean":
      return false;
    case "ZodEnum":
      return (inner as unknown as { options: string[] }).options[0];
    case "ZodArray":
      return [`:${name}`];
    case "ZodUnion":
    case "ZodObject":
    case "ZodRecord":
      return { text: ":text" };
    default:
      return `:${name}`;
  }
}

/** Run a handler with a recording API to find its REST endpoint. */
async function discoverEndpoint(tool: CapturedTool): Promise<string> {
  // Re-register just this tool bound to a fresh recording api, then invoke its
  // handler with representative args so it reaches its api.<method>() call.
  const { api, state } = makeRecordingApi();
  const local: Array<(args: Record<string, unknown>) => Promise<unknown>> = [];
  const stub = {
    registerTool(
      name: string,
      _config: unknown,
      handler: (args: Record<string, unknown>) => Promise<unknown>
    ) {
      if (name === tool.name) local.push(handler);
    },
  };
  registerTools(stub as unknown as McpServer, api);
  const handler = local[0];
  if (!handler) return "—";

  const args: Record<string, unknown> = {};
  for (const [name, schema] of Object.entries(tool.inputSchema)) {
    args[name] = sampleValue(name, schema);
  }
  try {
    await handler(args);
  } catch {
    // Some handlers branch before the API call; the recorded path (if any) still stands.
  }
  if (!state.last) return "—";
  const path = decodeURIComponent(state.last.path).replace(/\?.*$/, "");
  return `${state.last.method} ${path}`;
}

/** Pull the credit/free statement straight from the description prose. */
function creditCost(description: string): string {
  const sentences = description.split(/(?<=[.!?])\s+/);
  const relevant = sentences.filter((s) => /\bcredits?\b|\bfree\b/i.test(s));
  if (relevant.length === 0) return "Free";
  return relevant.join(" ").trim();
}

export async function collectToolDocs(): Promise<ToolDoc[]> {
  const tools = captureTools();
  const docs: ToolDoc[] = [];
  for (const tool of tools) {
    docs.push({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      endpoint: await discoverEndpoint(tool),
      cost: creditCost(tool.description),
      inputs: introspectInputs(tool.inputSchema),
    });
  }
  docs.sort((a, b) => a.name.localeCompare(b.name));
  return docs;
}

export function renderMarkdown(docs: ToolDoc[]): string {
  const lines: string[] = [];
  lines.push("<!-- GENERATED FILE — do not edit by hand.");
  lines.push("     Regenerate with `npm run gen-docs` in the mcp/ package.");
  lines.push("     Source of truth: mcp/src/tools.ts (Zod schemas + descriptions). -->");
  lines.push("");
  lines.push("# MCP Tool Reference");
  lines.push("");
  lines.push(
    `The Agents For X MCP server exposes **${docs.length} tools**. Both transports — the stdio package (\`@agentsforx/mcp\`) and the hosted OAuth gateway (\`/api/v1/mcp\`) — register this identical set via the shared \`registerTools()\`. Each tool maps to one v1 REST endpoint; credit costs and auth scopes are enforced server-side and are identical across transports.`
  );
  lines.push("");
  lines.push("For narrative usage (write-yourself vs. generate, the check_draft loop, freshness), see [tools.md](./tools.md). For the REST contract, see the [OpenAPI spec](../../src/lib/api/openapi-spec.ts) / the interactive reference at `/developers`.");
  lines.push("");
  lines.push("## Tools");
  lines.push("");
  for (const d of docs) {
    lines.push(`### \`${d.name}\``);
    lines.push("");
    if (d.title) {
      lines.push(`**${d.title}**`);
      lines.push("");
    }
    lines.push(d.description);
    lines.push("");
    lines.push(`- **REST endpoint:** \`${d.endpoint}\``);
    lines.push(`- **Cost:** ${d.cost}`);
    lines.push("");
    if (d.inputs.length === 0) {
      lines.push("_No inputs._");
    } else {
      lines.push("| Input | Constraints | Description |");
      lines.push("|---|---|---|");
      for (const i of d.inputs) {
        const facets: string[] = [i.type];
        facets.push(i.required ? "required" : "optional");
        if (i.default !== undefined) facets.push(`default ${i.default}`);
        if (i.enumValues) facets.push(`one of ${i.enumValues.map((v) => `\`${v}\``).join(", ")}`);
        if (i.min !== undefined) facets.push(`min ${i.min}`);
        if (i.max !== undefined) facets.push(`max ${i.max}`);
        const desc = (i.description ?? "").replace(/\|/g, "\\|");
        lines.push(`| \`${i.name}\` | ${facets.join(", ")} | ${desc} |`);
      }
    }
    lines.push("");
  }
  return lines.join("\n").replace(/\n+$/, "") + "\n";
}

export async function generateToolDocsMarkdown(): Promise<string> {
  return renderMarkdown(await collectToolDocs());
}
