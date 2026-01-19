"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { InspirationPost } from "@/types/inspiration";
import type { PreprocessResult, TranscriptSegment } from "@/lib/openai";

type Source = {
  id: string;
  type: "VOICE_MEMO" | "INSPIRATION" | "NEWS";
  raw_content: string | null;
  source_url: string | null;
  created_at: string;
};

type DraftType = "X_POST" | "X_THREAD" | "REEL_SCRIPT";
type ApplyAs = "voice_and_format" | "voice_only" | "format_only";

// Workflow steps
type Step = "select_source" | "preprocess" | "select_segments" | "configure_style";

export default function GenerateDraftPage() {
  const router = useRouter();

  // Workflow state
  const [step, setStep] = useState<Step>("select_source");

  // Content sources
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  // Preprocessing
  const [preprocessResult, setPreprocessResult] = useState<PreprocessResult | null>(null);
  const [selectedSegments, setSelectedSegments] = useState<TranscriptSegment[]>([]);
  const [preprocessing, setPreprocessing] = useState(false);

  // Style references
  const [inspirations, setInspirations] = useState<InspirationPost[]>([]);
  const [selectedInspirations, setSelectedInspirations] = useState<string[]>([]);
  const [applyAs, setApplyAs] = useState<ApplyAs>("voice_and_format");

  // Other state
  const [draftType, setDraftType] = useState<DraftType>("X_POST");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [sourcesRes, inspirationsRes] = await Promise.all([
          fetch("/api/sources"),
          fetch("/api/inspiration"),
        ]);
        const sourcesData = await sourcesRes.json();
        const inspirationsData = await inspirationsRes.json();

        // Filter sources to only show voice memos and news
        const filteredSources = sourcesData.filter(
          (s: Source) => s.type === "VOICE_MEMO" || s.type === "NEWS"
        );
        setSources(filteredSources);
        setInspirations(inspirationsData);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  function selectSource(id: string) {
    setSelectedSource(id);
    setPreprocessResult(null);
    setSelectedSegments([]);
    setError(null);
  }

  async function handlePreprocess() {
    if (!selectedSource) return;

    const source = sources.find((s) => s.id === selectedSource);
    if (!source) return;

    // Only preprocess voice memos
    if (source.type !== "VOICE_MEMO") {
      // Skip preprocessing for non-voice-memo sources
      setStep("configure_style");
      return;
    }

    setPreprocessing(true);
    setError(null);

    try {
      const res = await fetch("/api/sources/preprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: selectedSource }),
      });

      if (res.ok) {
        const result: PreprocessResult = await res.json();
        setPreprocessResult(result);

        // Auto-select all segments by default
        setSelectedSegments(result.segments);

        // If single idea or proceed directly recommended, skip segment selection
        if (
          result.structure === "single_idea" ||
          result.recommendations.suggestedAction === "proceed_directly"
        ) {
          setStep("configure_style");
        } else {
          setStep("select_segments");
        }
      } else {
        const data = await res.json();
        setError(data.error || "Failed to preprocess");
      }
    } catch {
      setError("Failed to preprocess transcript");
    } finally {
      setPreprocessing(false);
    }
  }

  function toggleSegment(segment: TranscriptSegment) {
    setSelectedSegments((prev) =>
      prev.find((s) => s.id === segment.id)
        ? prev.filter((s) => s.id !== segment.id)
        : [...prev, segment]
    );
  }

  function toggleInspiration(id: string) {
    setSelectedInspirations((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleGenerate() {
    if (!selectedSource) {
      setError("Select a content source");
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      // If we have segments, generate from each selected segment
      const segmentsToGenerate =
        selectedSegments.length > 0 ? selectedSegments : null;

      if (segmentsToGenerate && segmentsToGenerate.length > 1) {
        // Generate multiple drafts (one per segment)
        const results = await Promise.all(
          segmentsToGenerate.map(async (segment) => {
            const body: Record<string, unknown> = {
              sourceIds: [selectedSource],
              draftType: segment.suggestedType === "X_THREAD" ? "X_THREAD" : draftType,
              segment,
            };

            if (selectedInspirations.length > 0) {
              body.styleReference = {
                inspirationIds: selectedInspirations,
                applyAs,
              };
            }

            const res = await fetch("/api/drafts/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });

            return res.json();
          })
        );

        // Navigate to drafts list to see all generated
        router.push("/drafts");
      } else {
        // Generate single draft
        const body: Record<string, unknown> = {
          sourceIds: [selectedSource],
          draftType,
        };

        // If single segment selected, use it
        if (segmentsToGenerate && segmentsToGenerate.length === 1) {
          body.segment = segmentsToGenerate[0];
        }

        if (selectedInspirations.length > 0) {
          body.styleReference = {
            inspirationIds: selectedInspirations,
            applyAs,
          };
        }

        const res = await fetch("/api/drafts/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const draft = await res.json();
          router.push(`/drafts/${draft.id}`);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to generate draft");
        }
      }
    } catch {
      setError("Failed to generate draft");
    } finally {
      setGenerating(false);
    }
  }

  const typeColors = {
    VOICE_MEMO: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    NEWS: "bg-green-500/10 text-green-400 border-green-500/20",
  };

  const typeLabels = {
    VOICE_MEMO: "Voice Memo",
    NEWS: "News",
  };

  const structureLabels = {
    single_idea: "Single Idea",
    multi_post_series: "Multi-Post Series",
    thread_outline: "Thread Outline",
    idea_dump: "Idea Dump",
  };

  const depthColors = {
    shallow: "text-yellow-400",
    medium: "text-blue-400",
    deep: "text-green-400",
  };

  const analyzedInspirations = inspirations.filter(
    (i) => i.analysis_status === "completed"
  );

  const selectedSourceData = sources.find((s) => s.id === selectedSource);

  return (
    <div className="space-y-6">
      {/* Header with breadcrumb */}
      <div className="flex items-center gap-4">
        <Link href="/drafts" className="text-zinc-400 hover:text-white">
          &larr; Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Generate Draft</h1>
          <p className="text-zinc-400 mt-1">
            {step === "select_source" && "Select content source"}
            {step === "preprocess" && "Analyzing transcript..."}
            {step === "select_segments" && "Review detected segments"}
            {step === "configure_style" && "Configure style and generate"}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {["select_source", "select_segments", "configure_style"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                step === s
                  ? "bg-blue-600 text-white"
                  : i < ["select_source", "select_segments", "configure_style"].indexOf(step)
                  ? "bg-green-600 text-white"
                  : "bg-zinc-700 text-zinc-400"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={
                step === s ? "text-white" : "text-zinc-500"
              }
            >
              {s === "select_source" && "Source"}
              {s === "select_segments" && "Segments"}
              {s === "configure_style" && "Style & Generate"}
            </span>
            {i < 2 && <span className="text-zinc-600 mx-2">→</span>}
          </div>
        ))}
      </div>

      {/* Step 1: Select Source */}
      {step === "select_source" && (
        <div className="space-y-6">
          {/* Draft Type Selection */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Content Type</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { type: "X_POST" as DraftType, label: "X Post", desc: "Single post, any length" },
                { type: "X_THREAD" as DraftType, label: "X Thread", desc: "Multi-post thread" },
                { type: "REEL_SCRIPT" as DraftType, label: "Reel Script", desc: "25-40s video script" },
              ].map(({ type, label, desc }) => (
                <button
                  key={type}
                  onClick={() => setDraftType(type)}
                  className={`p-4 rounded-lg border text-left transition ${
                    draftType === type
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
                  }`}
                >
                  <div className="font-medium">{label}</div>
                  <div className="text-sm text-zinc-400 mt-1">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Source Selection */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Select Content Source</h2>
            {loading ? (
              <div className="text-center py-8 text-zinc-400">Loading...</div>
            ) : sources.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-zinc-400 mb-4">No sources available</p>
                <Link href="/sources" className="text-blue-400 hover:text-blue-300">
                  Add sources first
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {sources.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => selectSource(source.id)}
                    className={`w-full p-3 rounded-lg border text-left transition ${
                      selectedSource === source.id
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${typeColors[source.type as keyof typeof typeColors]}`}
                      >
                        {typeLabels[source.type as keyof typeof typeLabels]}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {new Date(source.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300 line-clamp-2">
                      {source.raw_content || source.source_url || "No content"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handlePreprocess}
              disabled={!selectedSource || preprocessing}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-md transition"
            >
              {preprocessing ? "Analyzing..." : "Analyze & Continue"}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select Segments */}
      {step === "select_segments" && preprocessResult && (
        <div className="space-y-6">
          {/* Analysis Summary */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Transcript Analysis</h2>
                <p className="text-sm text-zinc-500">{preprocessResult.summary}</p>
              </div>
              <span className="px-3 py-1 rounded bg-zinc-800 text-sm">
                {structureLabels[preprocessResult.structure]}
              </span>
            </div>
            <div className="p-3 bg-zinc-800 rounded-lg text-sm">
              <span className="text-zinc-400">Recommendation: </span>
              <span className="text-white">{preprocessResult.recommendations.message}</span>
            </div>
          </div>

          {/* Segment Selection */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Detected Segments ({preprocessResult.segments.length})
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedSegments(preprocessResult.segments)}
                  className="text-xs px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedSegments([])}
                  className="text-xs px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {preprocessResult.segments.map((segment) => (
                <div
                  key={segment.id}
                  onClick={() => toggleSegment(segment)}
                  className={`p-4 rounded-lg border cursor-pointer transition ${
                    selectedSegments.find((s) => s.id === segment.id)
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!selectedSegments.find((s) => s.id === segment.id)}
                        onChange={() => toggleSegment(segment)}
                        className="rounded border-zinc-600"
                      />
                      <span className="font-medium">{segment.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded bg-zinc-700 ${depthColors[segment.estimatedDepth]}`}
                      >
                        {segment.estimatedDepth}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-700 text-zinc-300">
                        {segment.suggestedType}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400 line-clamp-3">{segment.content}</p>
                  {segment.keyTopics.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {segment.keyTopics.map((topic) => (
                        <span
                          key={topic}
                          className="text-xs px-2 py-0.5 rounded bg-zinc-700/50 text-zinc-400"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setStep("select_source")}
              className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-md transition"
            >
              Back
            </button>
            <button
              onClick={() => setStep("configure_style")}
              disabled={selectedSegments.length === 0}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-md transition"
            >
              Continue ({selectedSegments.length} selected)
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Configure Style & Generate */}
      {step === "configure_style" && (
        <div className="space-y-6">
          {/* Summary of what will be generated */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Generation Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Source:</span>
                <span className="text-white">
                  {selectedSourceData?.type === "VOICE_MEMO" ? "Voice Memo" : "News"}
                </span>
              </div>
              {selectedSegments.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Segments to generate:</span>
                  <span className="text-white">{selectedSegments.length}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-400">Default type:</span>
                <span className="text-white">{draftType}</span>
              </div>
            </div>
            {selectedSegments.length > 1 && (
              <div className="mt-4 p-3 bg-zinc-800 rounded-lg text-sm text-zinc-300">
                {selectedSegments.length} separate drafts will be created, one for each segment.
              </div>
            )}
          </div>

          {/* Style Reference */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Style Reference</h2>
                <p className="text-sm text-zinc-500">Apply voice and format from inspirations (optional)</p>
              </div>
              <span className="text-sm text-zinc-400">
                {selectedInspirations.length} selected
              </span>
            </div>

            {/* Apply As toggle */}
            {selectedInspirations.length > 0 && (
              <div className="mb-4 p-3 bg-zinc-800 rounded-lg">
                <div className="text-xs text-zinc-400 mb-2">Apply as:</div>
                <div className="flex gap-2">
                  {[
                    { value: "voice_and_format" as ApplyAs, label: "Voice + Format" },
                    { value: "voice_only" as ApplyAs, label: "Voice Only" },
                    { value: "format_only" as ApplyAs, label: "Format Only" },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setApplyAs(value)}
                      className={`px-3 py-1.5 rounded text-xs transition ${
                        applyAs === value
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-center py-8 text-zinc-400">Loading...</div>
            ) : analyzedInspirations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-zinc-400 mb-4">No analyzed inspirations</p>
                <Link href="/inspiration" className="text-blue-400 hover:text-blue-300">
                  Add inspiration posts
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {analyzedInspirations.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => toggleInspiration(post.id)}
                    className={`w-full p-3 rounded-lg border text-left transition ${
                      selectedInspirations.includes(post.id)
                        ? "border-purple-500 bg-purple-500/10"
                        : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded border bg-purple-500/10 text-purple-400 border-purple-500/20">
                        Inspiration
                      </span>
                      {post.author_handle && (
                        <span className="text-xs text-zinc-500">{post.author_handle}</span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-300 line-clamp-2">
                      {post.raw_content}
                    </p>
                    {post.voice_analysis && (
                      <div className="mt-2 text-xs text-zinc-500">
                        Tone: {post.voice_analysis.tone.slice(0, 3).join(", ")}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() =>
                preprocessResult && preprocessResult.segments.length > 1
                  ? setStep("select_segments")
                  : setStep("select_source")
              }
              className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-md transition"
            >
              Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-md transition"
            >
              {generating
                ? "Generating..."
                : selectedSegments.length > 1
                ? `Generate ${selectedSegments.length} Drafts`
                : "Generate Draft"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
