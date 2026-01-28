"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { TopicInput } from "./TopicInput";
import { PatternSelector } from "./PatternSelector";
import { DraftsList } from "./DraftsList";
import { Sparkles, FileText, List, Loader2 } from "lucide-react";

type DraftType = "X_POST" | "X_THREAD";

interface GeneratedDraft {
  id: string;
  content: {
    text?: string;
    posts?: string[];
  };
  topic: string;
  metadata?: {
    hook_type?: string;
    patterns_applied?: string[];
  };
}

export function CreatePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get("tab") === "drafts" ? "drafts" : "new";

  const [topic, setTopic] = useState("");
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
  const [draftType, setDraftType] = useState<DraftType>("X_POST");
  const [generating, setGenerating] = useState(false);
  const [generatedDrafts, setGeneratedDrafts] = useState<GeneratedDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim() || topic.length < 3) {
      setError("Please enter a topic (at least 3 characters)");
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedDrafts([]);

    try {
      const res = await fetch("/api/drafts/generate-from-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          draftType,
          patternIds: selectedPatterns,
          generateCount: 3,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate drafts");
      }

      const data = await res.json();
      setGeneratedDrafts(data.drafts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  const handleUseDraft = (draft: GeneratedDraft) => {
    router.push(`/drafts/${draft.id}`);
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-white">Create</h1>
        <p className="text-slate-500 mt-1">Generate content from topics using your patterns</p>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="new">New Draft</TabsTrigger>
          <TabsTrigger value="drafts">All Drafts</TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          <div className="max-w-2xl space-y-6">
            {/* Topic Input */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
              <TopicInput value={topic} onChange={setTopic} />
            </div>

            {/* Pattern Selection */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
              <PatternSelector
                selectedPatterns={selectedPatterns}
                onSelectionChange={setSelectedPatterns}
              />
            </div>

            {/* Format Selection */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
              <label className="block text-sm font-medium text-slate-200 mb-3">
                Format:
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setDraftType("X_POST")}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                    draftType === "X_POST"
                      ? "bg-violet-500/10 border-violet-500 text-violet-400"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span className="font-medium">Single Post</span>
                </button>
                <button
                  onClick={() => setDraftType("X_THREAD")}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                    draftType === "X_THREAD"
                      ? "bg-violet-500/10 border-violet-500 text-violet-400"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  <List className="w-4 h-4" />
                  <span className="font-medium">Thread</span>
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={generating || !topic.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-violet-500 hover:bg-violet-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Generate Drafts</span>
                </>
              )}
            </button>

            {/* Generated Drafts */}
            {generatedDrafts.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white">
                  Generated Drafts ({generatedDrafts.length})
                </h3>
                {generatedDrafts.map((draft, index) => (
                  <div
                    key={draft.id}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-slate-400">
                            Option {index + 1}
                          </span>
                          {draft.metadata?.hook_type && (
                            <span className="px-2 py-0.5 bg-violet-500/10 text-violet-400 rounded-full text-xs">
                              {draft.metadata.hook_type}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-200 whitespace-pre-wrap">
                          {draftType === "X_THREAD"
                            ? (draft.content.posts || []).join("\n\n---\n\n")
                            : draft.content.text || ""}
                        </p>
                      </div>
                      <button
                        onClick={() => handleUseDraft(draft)}
                        className="flex-shrink-0 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Edit & Use
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="drafts">
          <DraftsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
