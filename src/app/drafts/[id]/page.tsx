"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Draft = {
  id: string;
  type: "X_POST" | "X_THREAD" | "REEL_SCRIPT";
  status: "PENDING" | "GENERATED" | "APPROVED" | "REJECTED";
  content: Record<string, unknown>;
  source_ids: string[] | null;
  edited_content: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function XPostEditor({
  content,
  onChange,
}: {
  content: { text: string };
  onChange: (content: { text: string }) => void;
}) {
  // Defensive: ensure text exists
  const text = content?.text ?? "";
  const charCount = text.length;
  const maxChars = 25000;
  const isOverLimit = charCount > maxChars;

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => onChange({ text: e.target.value })}
        className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-slate-600 min-h-[200px]"
      />
      <div className={`text-sm ${isOverLimit ? "text-red-400" : "text-slate-400"}`}>
        {charCount.toLocaleString()}/{maxChars.toLocaleString()} characters
      </div>
    </div>
  );
}

function XThreadEditor({
  content,
  onChange,
}: {
  content: { tweets: string[] };
  onChange: (content: { tweets: string[] }) => void;
}) {
  // Defensive: ensure tweets array exists
  const tweets = content?.tweets ?? [""];

  function updateTweet(index: number, value: string) {
    const newTweets = [...tweets];
    newTweets[index] = value;
    onChange({ tweets: newTweets });
  }

  function addTweet() {
    onChange({ tweets: [...tweets, ""] });
  }

  function removeTweet(index: number) {
    const newTweets = tweets.filter((_, i) => i !== index);
    onChange({ tweets: newTweets });
  }

  return (
    <div className="space-y-4">
      {tweets.map((tweet, index) => (
        <div key={index} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Tweet {index + 1}</span>
            {tweets.length > 1 && (
              <button
                onClick={() => removeTweet(index)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            )}
          </div>
          <textarea
            value={tweet}
            onChange={(e) => updateTweet(index, e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-slate-600"
            rows={3}
          />
          <div className={`text-xs ${tweet.length > 25000 ? "text-red-400" : "text-slate-500"}`}>
            {tweet.length.toLocaleString()}/25,000
          </div>
        </div>
      ))}
      {tweets.length < 6 && (
        <button
          onClick={addTweet}
          className="text-sm text-amber-400 hover:text-amber-300"
        >
          + Add Tweet
        </button>
      )}
    </div>
  );
}

type ReelScriptContent = {
  hook: string;
  body: string;
  callToAction: string;
  estimatedDuration: string;
};

function ReelScriptEditor({
  content,
  onChange,
}: {
  content: ReelScriptContent;
  onChange: (content: ReelScriptContent) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-slate-400 mb-1">Hook (3-5 seconds)</label>
        <textarea
          value={content.hook}
          onChange={(e) => onChange({ ...content, hook: e.target.value })}
          className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-slate-600"
          rows={2}
        />
      </div>
      <div>
        <label className="block text-sm text-slate-400 mb-1">Body</label>
        <textarea
          value={content.body}
          onChange={(e) => onChange({ ...content, body: e.target.value })}
          className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-slate-600"
          rows={4}
        />
      </div>
      <div>
        <label className="block text-sm text-slate-400 mb-1">Call to Action</label>
        <textarea
          value={content.callToAction}
          onChange={(e) => onChange({ ...content, callToAction: e.target.value })}
          className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-slate-600"
          rows={2}
        />
      </div>
      <div>
        <label className="block text-sm text-slate-400 mb-1">Estimated Duration</label>
        <input
          type="text"
          value={content.estimatedDuration}
          onChange={(e) => onChange({ ...content, estimatedDuration: e.target.value })}
          className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-slate-600"
        />
      </div>
    </div>
  );
}

export default function DraftEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editedContent, setEditedContent] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchDraft() {
      try {
        const res = await fetch(`/api/drafts/${id}`);
        if (res.ok) {
          const data = await res.json();
          setDraft(data);
          setEditedContent(data.edited_content || data.content);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchDraft();
  }, [id]);

  async function updateStatus(status: "APPROVED" | "REJECTED") {
    setSaving(true);
    try {
      const res = await fetch(`/api/drafts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, editedContent }),
      });
      if (res.ok) {
        router.push("/drafts");
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveEdits() {
    setSaving(true);
    try {
      const res = await fetch(`/api/drafts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedContent }),
      });
      if (res.ok) {
        const data = await res.json();
        setDraft(data);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading draft...</div>;
  }

  if (!draft) {
    return <div className="text-center py-12 text-slate-400">Draft not found</div>;
  }

  const typeLabels = {
    X_POST: "X Post",
    X_THREAD: "X Thread",
    REEL_SCRIPT: "Reel Script",
  };

  const statusColors = {
    PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    GENERATED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    APPROVED: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/drafts" className="text-slate-400 hover:text-white">
            &larr; Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300">
              {typeLabels[draft.type]}
            </span>
            <span
              className={`text-xs px-2 py-1 rounded border ${statusColors[draft.status]}`}
            >
              {draft.status}
            </span>
          </div>
        </div>
        <div className="text-sm text-slate-400">
          Created {new Date(draft.created_at).toLocaleString()}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-4">Edit Content</h2>

        {draft.type === "X_POST" && editedContent && (
          <XPostEditor
            content={editedContent as { text: string }}
            onChange={setEditedContent}
          />
        )}

        {draft.type === "X_THREAD" && editedContent && (
          <XThreadEditor
            content={editedContent as { tweets: string[] }}
            onChange={setEditedContent}
          />
        )}

        {draft.type === "REEL_SCRIPT" && editedContent && (
          <ReelScriptEditor
            content={editedContent as ReelScriptContent}
            onChange={setEditedContent}
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={saveEdits}
          disabled={saving}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 rounded-md text-sm transition"
        >
          {saving ? "Saving..." : "Save Edits"}
        </button>

        <div className="flex gap-3">
          <button
            onClick={() => updateStatus("REJECTED")}
            disabled={saving}
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-md text-sm transition"
          >
            Reject
          </button>
          <button
            onClick={() => updateStatus("APPROVED")}
            disabled={saving}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-md text-sm transition"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
