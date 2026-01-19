"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type Source = {
  id: string;
  type: "VOICE_MEMO" | "INSPIRATION" | "NEWS";
  raw_content: string | null;
  source_url: string | null;
  audio_path: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type AddFormType = "inspiration" | "news" | "voice" | null;

function SourceCard({ source }: { source: Source }) {
  const typeColors = {
    VOICE_MEMO: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    INSPIRATION: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    NEWS: "bg-green-500/10 text-green-400 border-green-500/20",
  };

  const typeLabels = {
    VOICE_MEMO: "Voice Memo",
    INSPIRATION: "Inspiration",
    NEWS: "News",
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <span
          className={`text-xs px-2 py-1 rounded border ${typeColors[source.type]}`}
        >
          {typeLabels[source.type]}
        </span>
        <span className="text-xs text-zinc-500">
          {new Date(source.created_at).toLocaleDateString()}
        </span>
      </div>
      {source.raw_content && (
        <p className="text-sm text-zinc-300 line-clamp-3">{source.raw_content}</p>
      )}
      {source.source_url && (
        <a
          href={source.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-400 hover:underline block mt-2 truncate"
        >
          {source.source_url}
        </a>
      )}
      {source.audio_path && (
        <p className="text-sm text-zinc-400 mt-2">Audio: {source.audio_path}</p>
      )}
    </div>
  );
}

function AddInspirationForm({ onSuccess }: { onSuccess: () => void }) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text && !url) return;

    setLoading(true);
    try {
      const res = await fetch("/api/sources/inspiration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, url, platform }),
      });
      if (res.ok) {
        setText("");
        setUrl("");
        setPlatform("");
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Content</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the inspiring content here..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-zinc-600"
          rows={4}
        />
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">URL (optional)</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-zinc-600"
        />
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Platform</label>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-zinc-600"
        >
          <option value="">Select platform</option>
          <option value="X">X (Twitter)</option>
          <option value="Instagram">Instagram</option>
          <option value="LinkedIn">LinkedIn</option>
          <option value="Blog">Blog</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={loading || (!text && !url)}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed px-4 py-2 rounded-md text-sm transition"
      >
        {loading ? "Adding..." : "Add Inspiration"}
      </button>
    </form>
  );
}

function AddNewsForm({ onSuccess }: { onSuccess: () => void }) {
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content && !url) return;

    setLoading(true);
    try {
      const res = await fetch("/api/sources/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, url, title }),
      });
      if (res.ok) {
        setContent("");
        setUrl("");
        setTitle("");
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Article title..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-zinc-600"
        />
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste the article content or summary..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-zinc-600"
          rows={4}
        />
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">URL (optional)</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-zinc-600"
        />
      </div>
      <button
        type="submit"
        disabled={loading || (!content && !url)}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed px-4 py-2 rounded-md text-sm transition"
      >
        {loading ? "Adding..." : "Add News"}
      </button>
    </form>
  );
}

function AddVoiceMemoForm({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<"transcript" | "audio">("transcript");
  const [transcript, setTranscript] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "transcript" && !transcript.trim()) return;
    if (mode === "audio" && !file) return;

    setLoading(true);
    try {
      if (mode === "transcript") {
        const res = await fetch("/api/sources/transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript }),
        });
        if (res.ok) {
          setTranscript("");
          onSuccess();
        }
      } else {
        const formData = new FormData();
        formData.append("file", file!);
        const res = await fetch("/api/sources/voice-memo", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          setFile(null);
          onSuccess();
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2 p-1 bg-zinc-800 rounded-md w-fit">
        <button
          type="button"
          onClick={() => setMode("transcript")}
          className={`px-3 py-1.5 rounded text-sm transition ${
            mode === "transcript"
              ? "bg-zinc-700 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Paste Transcript
        </button>
        <button
          type="button"
          onClick={() => setMode("audio")}
          className={`px-3 py-1.5 rounded text-sm transition ${
            mode === "audio"
              ? "bg-zinc-700 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Upload Audio
        </button>
      </div>

      {mode === "transcript" ? (
        <div>
          <label className="block text-sm text-zinc-400 mb-1">
            Transcript (paste from Voice Memos app)
          </label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste your voice memo transcript here..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-zinc-600"
            rows={6}
          />
        </div>
      ) : (
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Audio File</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-zinc-600 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-zinc-700 file:text-zinc-300"
          />
          {file && (
            <p className="text-sm text-zinc-400 mt-2">Selected: {file.name}</p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || (mode === "transcript" ? !transcript.trim() : !file)}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed px-4 py-2 rounded-md text-sm transition"
      >
        {loading ? "Saving..." : mode === "transcript" ? "Save Transcript" : "Upload Audio"}
      </button>
    </form>
  );
}

function SourcesContent() {
  const searchParams = useSearchParams();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeForm, setActiveForm] = useState<AddFormType>(null);

  useEffect(() => {
    const add = searchParams.get("add") as AddFormType;
    if (add) setActiveForm(add);
  }, [searchParams]);

  async function fetchSources() {
    try {
      const res = await fetch("/api/sources");
      const data = await res.json();
      setSources(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSources();
  }, []);

  function handleSuccess() {
    fetchSources();
    setActiveForm(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sources</h1>
          <p className="text-zinc-400 mt-1">Raw materials for content generation</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveForm(activeForm === "inspiration" ? null : "inspiration")}
            className={`px-3 py-1.5 rounded-md text-sm transition ${
              activeForm === "inspiration"
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 hover:bg-zinc-700"
            }`}
          >
            + Inspiration
          </button>
          <button
            onClick={() => setActiveForm(activeForm === "news" ? null : "news")}
            className={`px-3 py-1.5 rounded-md text-sm transition ${
              activeForm === "news"
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 hover:bg-zinc-700"
            }`}
          >
            + News
          </button>
          <button
            onClick={() => setActiveForm(activeForm === "voice" ? null : "voice")}
            className={`px-3 py-1.5 rounded-md text-sm transition ${
              activeForm === "voice"
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 hover:bg-zinc-700"
            }`}
          >
            + Voice Memo
          </button>
        </div>
      </div>

      {activeForm && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {activeForm === "inspiration" && "Add Inspiration"}
              {activeForm === "news" && "Add News"}
              {activeForm === "voice" && "Upload Voice Memo"}
            </h2>
            <button
              onClick={() => setActiveForm(null)}
              className="text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
          {activeForm === "inspiration" && <AddInspirationForm onSuccess={handleSuccess} />}
          {activeForm === "news" && <AddNewsForm onSuccess={handleSuccess} />}
          {activeForm === "voice" && <AddVoiceMemoForm onSuccess={handleSuccess} />}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Loading sources...</div>
      ) : sources.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          No sources yet. Add your first source above.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SourcesPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-zinc-400">Loading...</div>}>
      <SourcesContent />
    </Suspense>
  );
}
