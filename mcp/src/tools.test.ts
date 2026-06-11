import { describe, it, expect, beforeEach, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerTools } from "./tools";
import { ApiClient, ApiError, type CreditsInfo } from "./client";

const EXPECTED_TOOLS = [
  // identity & config
  "whoami", "health", "get_credits",
  "get_voice_settings", "update_voice_settings",
  "get_strategy", "update_strategy", "get_niche",
  // generation
  "generate_post", "generate_reply", "send_feedback",
  // drafts
  "list_drafts", "get_draft", "create_draft", "update_draft", "delete_draft",
  // publishing
  "publish_post", "publish_thread", "publish_reply", "schedule_post",
  // queue
  "list_queue", "cancel_scheduled", "list_published",
  // analysis
  "get_analytics", "get_best_times", "sync_analytics", "get_tweet", "search_tweets",
  // patterns & inspiration
  "list_patterns", "toggle_pattern", "list_inspiration", "add_inspiration",
];

interface FakeApi {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  lastCredits: CreditsInfo;
}

function makeFakeApi(): FakeApi {
  return {
    get: vi.fn(async () => ({ ok: true })),
    post: vi.fn(async () => ({ ok: true })),
    patch: vi.fn(async () => ({ ok: true })),
    put: vi.fn(async () => ({ ok: true })),
    del: vi.fn(async () => ({ ok: true })),
    lastCredits: {},
  };
}

async function connectedClient(api: FakeApi): Promise<Client> {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerTools(server, api as unknown as ApiClient);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

let api: FakeApi;
let client: Client;

beforeEach(async () => {
  api = makeFakeApi();
  client = await connectedClient(api);
});

describe("tool registry", () => {
  it("registers exactly the expected tool set", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
    expect(names).toHaveLength(32);
  });

  it("metered tools state their credit cost in the description", async () => {
    const { tools } = await client.listTools();
    const byName = new Map(tools.map((t) => [t.name, t.description ?? ""]));
    expect(byName.get("generate_post")).toMatch(/3 credits/);
    expect(byName.get("publish_post")).toMatch(/30 if the text contains a URL/);
    expect(byName.get("publish_thread")).toMatch(/3 credits per tweet/);
    expect(byName.get("schedule_post")).toMatch(/refunded if cancelled/);
    expect(byName.get("get_tweet")).toMatch(/1 credit/);
    expect(byName.get("search_tweets")).toMatch(/1 credit per result/);
    expect(byName.get("sync_analytics")).toMatch(/15 credits/);
    expect(byName.get("add_inspiration")).toMatch(/3 credits/);
  });

  it("publish tools warn about irreversibility", async () => {
    const { tools } = await client.listTools();
    for (const name of ["publish_post", "publish_thread", "publish_reply"]) {
      const tool = tools.find((t) => t.name === name);
      expect(tool?.description).toMatch(/irreversible/i);
      expect(tool?.description).toMatch(/confirm/i);
    }
  });
});

describe("schema hardening", () => {
  it("rejects an invalid draft status enum", async () => {
    const result = await client.callTool({
      name: "list_drafts",
      arguments: { status: "NOT_A_STATUS" },
    });
    expect(result.isError).toBe(true);
    expect(api.get).not.toHaveBeenCalled();
  });

  it("rejects create_draft content that is neither text nor tweets", async () => {
    const result = await client.callTool({
      name: "create_draft",
      arguments: { type: "X_POST", content: { junk: 1 } },
    });
    expect(result.isError).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
  });

  it("accepts create_draft with thread content", async () => {
    const result = await client.callTool({
      name: "create_draft",
      arguments: { type: "X_THREAD", content: { tweets: ["one", "two"] } },
    });
    expect(result.isError).toBeFalsy();
    expect(api.post).toHaveBeenCalledWith("/api/v1/drafts", {
      type: "X_THREAD",
      content: { tweets: ["one", "two"] },
      topic: undefined,
      metadata: undefined,
    });
  });

  it("rejects empty ids", async () => {
    const result = await client.callTool({
      name: "get_draft",
      arguments: { id: "" },
    });
    expect(result.isError).toBe(true);
  });

  it("rejects a publish_post over 280 chars", async () => {
    const result = await client.callTool({
      name: "publish_post",
      arguments: { text: "x".repeat(281) },
    });
    expect(result.isError).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
  });

  it("schedule_post requires text or tweets", async () => {
    const result = await client.callTool({
      name: "schedule_post",
      arguments: { scheduledFor: "2030-01-01T00:00:00Z" },
    });
    expect(result.isError).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
  });

  it("schedule_post rejects an empty tweets array", async () => {
    const result = await client.callTool({
      name: "schedule_post",
      arguments: { tweets: [], scheduledFor: "2030-01-01T00:00:00Z" },
    });
    expect(result.isError).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe("call routing", () => {
  it("publish_reply posts the right payload", async () => {
    await client.callTool({
      name: "publish_reply",
      arguments: { text: "nice post", inReplyToId: "12345" },
    });
    expect(api.post).toHaveBeenCalledWith("/api/v1/publish/now", {
      contentType: "X_REPLY",
      payload: { text: "nice post", inReplyToId: "12345" },
      draftId: undefined,
    });
  });

  it("toggle_pattern patches the pattern endpoint", async () => {
    await client.callTool({
      name: "toggle_pattern",
      arguments: { id: "abc", isEnabled: false },
    });
    expect(api.patch).toHaveBeenCalledWith("/api/v1/patterns/abc", {
      is_enabled: false,
    });
  });

  it("update_strategy puts the full strategy", async () => {
    await client.callTool({
      name: "update_strategy",
      arguments: {
        posts_per_week: 5,
        threads_per_week: 1,
        replies_per_week: 10,
        pillar_targets: [{ pillar: "AI", posts_per_week: 2 }],
      },
    });
    expect(api.put).toHaveBeenCalledWith("/api/v1/strategy", {
      posts_per_week: 5,
      threads_per_week: 1,
      replies_per_week: 10,
      pillar_targets: [{ pillar: "AI", posts_per_week: 2 }],
    });
  });

  it("get_tweet URL-encodes the id", async () => {
    await client.callTool({
      name: "get_tweet",
      arguments: { idOrUrl: "https://x.com/user/status/123" },
    });
    expect(api.get).toHaveBeenCalledWith(
      `/api/v1/tweets/${encodeURIComponent("https://x.com/user/status/123")}`
    );
  });
});

describe("error & credits surfacing", () => {
  it("surfaces ApiError with hint as a model-readable error result", async () => {
    api.get.mockRejectedValueOnce(
      new ApiError(402, "INSUFFICIENT_CREDITS", "Insufficient credits", "Top up in Settings.")
    );
    const result = await client.callTool({
      name: "get_analytics",
      arguments: {},
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toContain("402 INSUFFICIENT_CREDITS");
    expect(text).toContain("Hint: Top up in Settings.");
  });

  it("appends a credits trailer when the call was metered", async () => {
    api.post.mockImplementationOnce(async () => {
      api.lastCredits = { charged: 3, remaining: 42 };
      return { posted: true };
    });
    const result = await client.callTool({
      name: "publish_post",
      arguments: { text: "hello world" },
    });
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toContain("credits: charged 3, remaining 42");
  });
});
