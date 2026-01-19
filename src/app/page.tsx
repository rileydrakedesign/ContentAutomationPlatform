import Link from "next/link";
import { createAuthClient } from "@/lib/supabase/server";

async function getStats() {
  const supabase = await createAuthClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [sourcesRes, draftsRes, capturedRes, inspirationRes] = await Promise.all([
    supabase.from("sources").select("id, type", { count: "exact" }),
    supabase.from("drafts").select("id, status", { count: "exact" }),
    supabase.from("captured_posts").select("id, inbox_status, triaged_as", { count: "exact" }),
    supabase.from("inspiration_posts").select("id", { count: "exact" }),
  ]);

  const sources = sourcesRes.data || [];
  const drafts = draftsRes.data || [];
  const captured = capturedRes.data || [];
  const inspirations = inspirationRes.data || [];

  return {
    totalSources: sources.length,
    voiceMemos: sources.filter((s) => s.type === "VOICE_MEMO").length,
    totalDrafts: drafts.length,
    pending: drafts.filter((d) => d.status === "PENDING").length,
    generated: drafts.filter((d) => d.status === "GENERATED").length,
    approved: drafts.filter((d) => d.status === "APPROVED").length,
    inboxCount: captured.filter((c) => c.inbox_status === "inbox").length,
    myPostsCount: captured.filter((c) => c.triaged_as === "my_post").length,
    inspirationCount: inspirations.length,
  };
}

export default async function Home() {
  const stats = await getStats();

  if (!stats) {
    return null; // Middleware will redirect to login
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-zinc-400 mt-1">Manage your content pipeline</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Inbox Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Inbox</h2>
            <Link
              href="/inbox"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              View all
            </Link>
          </div>
          <div className="text-4xl font-bold mb-2">{stats.inboxCount}</div>
          <p className="text-sm text-zinc-500">posts to triage</p>
        </div>

        {/* My Posts Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">My Posts</h2>
            <Link
              href="/my-posts"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              View all
            </Link>
          </div>
          <div className="text-4xl font-bold mb-2">{stats.myPostsCount}</div>
          <p className="text-sm text-zinc-500">posts captured</p>
        </div>

        {/* Inspiration Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Inspiration</h2>
            <Link
              href="/inspiration"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              View all
            </Link>
          </div>
          <div className="text-4xl font-bold mb-2">{stats.inspirationCount}</div>
          <p className="text-sm text-zinc-500">posts analyzed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sources Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Sources</h2>
            <Link
              href="/sources"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              View all
            </Link>
          </div>
          <div className="text-4xl font-bold mb-4">{stats.totalSources}</div>
          <div className="text-sm text-zinc-400">
            {stats.voiceMemos} voice memo{stats.voiceMemos !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Drafts Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Drafts</h2>
            <Link
              href="/drafts"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              View all
            </Link>
          </div>
          <div className="text-4xl font-bold mb-4">{stats.totalDrafts}</div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-zinc-400">Pending</div>
              <div className="font-medium">{stats.pending}</div>
            </div>
            <div>
              <div className="text-zinc-400">Generated</div>
              <div className="font-medium">{stats.generated}</div>
            </div>
            <div>
              <div className="text-zinc-400">Approved</div>
              <div className="font-medium">{stats.approved}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/inbox"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-sm transition"
          >
            Triage Inbox
          </Link>
          <Link
            href="/sources?add=voice"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-sm transition"
          >
            Upload Voice Memo
          </Link>
          <Link
            href="/drafts/generate"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-sm transition"
          >
            Generate Draft
          </Link>
          <Link
            href="/settings"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-sm transition"
          >
            Configure X Handles
          </Link>
        </div>
      </div>
    </div>
  );
}
