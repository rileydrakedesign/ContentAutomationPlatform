"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PromptPreviewResponse } from "@/types/voice";

export function PromptPreviewTab() {
  const [preview, setPreview] = useState<PromptPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  const fetchPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/voice/prompt-preview");
      if (!res.ok) throw new Error("Failed to fetch prompt preview");

      const data = await res.json();
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load preview");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreview();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-slate-800 rounded w-48"></div>
            <div className="h-4 bg-slate-800 rounded w-96"></div>
            <div className="h-32 bg-slate-800 rounded"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="space-y-4">
        <Card className="p-4">
          <div className="text-center py-8">
            <p className="text-red-400">{error || "Failed to load preview"}</p>
            <button
              onClick={fetchPreview}
              className="mt-2 text-sm text-amber-400 hover:text-amber-300 underline"
            >
              Try again
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const { assembled, settings, examples, inspirations } = preview;

  return (
    <div className="space-y-4">
      {/* Token Breakdown */}
      <Card className="p-4">
        <CardHeader className="mb-4">
          <CardTitle>Token Budget</CardTitle>
          <CardDescription>
            How tokens are allocated in your prompt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-xl font-semibold text-white">
                {assembled.total_tokens.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-1">Total Tokens</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-xl font-semibold text-amber-400">
                {assembled.breakdown.base_prompt_tokens.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-1">Base Prompt</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-xl font-semibold text-teal-400">
                {assembled.breakdown.voice_examples_tokens.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-1">Voice Examples</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-xl font-semibold text-purple-400">
                {assembled.breakdown.inspiration_tokens.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-1">Inspiration</p>
            </div>
            {assembled.breakdown.feedback_tokens > 0 && (
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-xl font-semibold text-rose-400">
                  {assembled.breakdown.feedback_tokens.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">Feedback</p>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-4 text-sm text-slate-400">
            <span>
              Examples: {assembled.examples_included} included
              {assembled.examples_omitted > 0 && `, ${assembled.examples_omitted} omitted`}
            </span>
            <span>
              Inspiration: {assembled.inspirations_included} included
              {assembled.inspirations_omitted > 0 && `, ${assembled.inspirations_omitted} omitted`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Current Settings Summary */}
      <Card className="p-4">
        <CardHeader className="mb-4">
          <CardTitle>Active Settings</CardTitle>
          <CardDescription>
            Current control knob values being applied.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">Length: {settings.length_mode}</Badge>
            <Badge variant="default">Directness: {settings.directness_mode}</Badge>
            <Badge variant="default">Humor: {settings.humor_mode}</Badge>
            <Badge variant="default">Emoji: {settings.emoji_mode}</Badge>
            <Badge variant="default">Questions: {settings.question_rate}</Badge>
            <Badge variant="default">Disagreement: {settings.disagreement_mode}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Examples Used */}
      <Card className="p-4">
        <CardHeader className="mb-4">
          <CardTitle>Examples Included</CardTitle>
          <CardDescription>
            Voice examples that will be sent to the model.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {examples.filter(e => !e.is_excluded).length === 0 ? (
            <p className="text-slate-500 text-sm">No examples included. Refresh or pin some examples.</p>
          ) : (
            <div className="space-y-2">
              {examples
                .filter(e => !e.is_excluded)
                .slice(0, assembled.examples_included)
                .map((example, index) => (
                  <div key={example.id} className="flex items-start gap-2 py-2 border-b border-slate-800 last:border-0">
                    <span className="text-xs text-slate-600 font-mono w-4">{index + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm text-white line-clamp-2">{example.content_text}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant={example.source === "pinned" ? "primary" : "secondary"} className="text-xs">
                          {example.source}
                        </Badge>
                        <span className="text-xs text-slate-500">~{example.token_count} tokens</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Prompt */}
      <Card className="p-4">
        <CardHeader className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Full System Prompt</CardTitle>
              <CardDescription>
                The exact prompt sent to the model.
              </CardDescription>
            </div>
            <button
              onClick={() => setShowFullPrompt(!showFullPrompt)}
              className="text-sm text-slate-400 hover:text-white transition"
            >
              {showFullPrompt ? "Hide" : "Show"}
            </button>
          </div>
        </CardHeader>
        {showFullPrompt && (
          <CardContent>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">
                {assembled.system_prompt}
              </pre>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(assembled.system_prompt)}
              className="mt-2 text-sm text-amber-400 hover:text-amber-300 transition"
            >
              Copy to clipboard
            </button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
