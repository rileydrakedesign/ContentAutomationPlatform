import { describe, it, expect, vi, beforeEach } from "vitest";

const getAnalyzablePosts = vi.fn();
const createAdminClient = vi.fn();
vi.mock("@/lib/analysis/posts-pool", () => ({
  getAnalyzablePosts: (...a: unknown[]) => getAnalyzablePosts(...a),
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => createAdminClient(),
}));

import { getPublicVoiceReport } from "./public-voice-report";

function fakeSupabase(tableData: Record<string, { data: unknown }>) {
  function builder(table: string) {
    const result = tableData[table] ?? { data: null };
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      order: () => b,
      limit: () => Promise.resolve(result),
      maybeSingle: () => Promise.resolve(result),
      then: (onF: (v: unknown) => unknown) => Promise.resolve(result).then(onF),
    };
    return b;
  }
  return { from: (table: string) => builder(table) };
}

describe("getPublicVoiceReport — curated, opt-in shareable artifact", () => {
  beforeEach(() => {
    getAnalyzablePosts.mockReset();
    createAdminClient.mockReset();
  });

  it("returns null for an unknown token", async () => {
    createAdminClient.mockReturnValue(fakeSupabase({ user_niche_profile: { data: null } }));
    expect(await getPublicVoiceReport("x".repeat(20))).toBeNull();
  });

  it("returns null for a too-short token without hitting the DB", async () => {
    expect(await getPublicVoiceReport("short")).toBeNull();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("maps handle, pattern provenance, and top post into the public shape", async () => {
    createAdminClient.mockReturnValue(
      fakeSupabase({
        user_niche_profile: {
          data: {
            user_id: "u1",
            niche_summary: "Build-in-public devtools founder",
            positioning: { positioning_statement: "Ship in public, share the receipts" },
            content_pillars: ["devtools", "growth"],
          },
        },
        x_connections: { data: { x_username: "founder" } },
        extracted_patterns: {
          data: [
            {
              pattern_name: "Receipts hook",
              pattern_value: "Open with a concrete number",
              multiplier: 2.4,
              sample_count: 6,
              source_post_examples: [{ text: "Hit $10k MRR by posting daily", engagement_score: 900 }],
            },
          ],
        },
      })
    );
    getAnalyzablePosts.mockResolvedValue([
      { text: "shipping in public is the cheat code", engagement_score: 1234.6 },
    ]);

    const report = await getPublicVoiceReport("t".repeat(20));
    expect(report).not.toBeNull();
    expect(report!.handle).toBe("founder");
    expect(report!.positioning_statement).toBe("Ship in public, share the receipts");
    expect(report!.patterns[0]).toMatchObject({
      pattern_name: "Receipts hook",
      multiplier: 2.4,
      example: "Hit $10k MRR by posting daily",
    });
    expect(report!.top_post).toEqual({
      text: "shipping in public is the cheat code",
      engagement_score: 1235,
    });
  });
});
