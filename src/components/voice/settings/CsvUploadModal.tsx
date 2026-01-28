"use client";

import { useState, useRef } from "react";
import { X, Upload, Check, FileText } from "lucide-react";
import { ParsedCsvPost, VoiceType } from "@/types/voice";

interface CsvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  voiceType: VoiceType;
  onImport: (posts: ParsedCsvPost[]) => Promise<void>;
}

export function CsvUploadModal({ isOpen, onClose, voiceType, onImport }: CsvUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [posts, setPosts] = useState<ParsedCsvPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("voice_type", voiceType);

      const res = await fetch("/api/voice/csv-upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to parse CSV");
      }

      const data = await res.json();
      setPosts(data.posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const togglePostSelection = (id: string) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === id ? { ...post, selected: !post.selected } : post
      )
    );
  };

  const handleImport = async () => {
    const selectedPosts = posts.filter((p) => p.selected);
    if (selectedPosts.length === 0) return;

    setImporting(true);
    try {
      await onImport(selectedPosts);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import examples");
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = posts.filter((p) => p.selected).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">
            Import from X Analytics
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* Upload area */}
          {posts.length === 0 && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
                loading
                  ? "border-slate-700 bg-slate-800/50"
                  : "border-slate-700 hover:border-violet-500 hover:bg-slate-800/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-slate-400">Parsing CSV...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-300">
                    Drop your X Analytics CSV here or click to browse
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Download from X Analytics {">"} Export data
                  </p>
                </>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Posts list */}
          {posts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">
                  Top {voiceType === "reply" ? "replies" : "posts"} by engagement
                </span>
                <span className="text-violet-400">{selectedCount} selected</span>
              </div>

              <div className="space-y-2 max-h-96 overflow-auto">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => togglePostSelection(post.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition ${
                      post.selected
                        ? "bg-violet-500/10 border-violet-500/30"
                        : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          post.selected
                            ? "bg-violet-500 text-white"
                            : "bg-slate-700 text-transparent"
                        }`}
                      >
                        <Check className="w-3 h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-300 line-clamp-2">
                          {post.text}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                          <span>{post.likes} likes</span>
                          <span>{post.reposts} reposts</span>
                          <span>{post.replies} replies</span>
                          <span className="text-violet-400">
                            Score: {Math.round(post.engagementScore)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {posts.length > 0 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-800">
            <button
              onClick={() => {
                setFile(null);
                setPosts([]);
                setError(null);
              }}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
            >
              Choose different file
            </button>
            <button
              onClick={handleImport}
              disabled={selectedCount === 0 || importing}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {importing ? "Importing..." : `Import ${selectedCount} examples`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
