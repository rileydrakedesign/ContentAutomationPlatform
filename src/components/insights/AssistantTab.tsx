"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Turn = { role: "user" | "assistant"; content: string };

type ChatResponse = { answer: string; sources_used: string[] };

function Bubble({ role, content }: { role: Turn["role"]; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl px-4 py-3 bg-[var(--color-primary-500)]/15 border border-[var(--color-primary-500)]/20 text-[var(--color-text-primary)]"
            : "max-w-[85%] rounded-2xl px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] text-[var(--color-text-primary)]"
        }
      >
        <div className="text-sm whitespace-pre-wrap leading-relaxed">{content}</div>
      </div>
    </div>
  );
}

export function AssistantTab() {
  const [history, setHistory] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<string[]>([]);

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [history, loading]);

  async function ask(text?: string) {
    const q = (text ?? question).trim();
    if (!q || loading) return;

    setLoading(true);
    setSources([]);

    const nextHistory: Turn[] = [...history, { role: "user", content: q }];
    setHistory(nextHistory);
    setQuestion("");

    try {
      const res = await fetch("/api/insights-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history: nextHistory }),
      });

      const data = (await res.json()) as ChatResponse;
      const answer = res.ok ? data.answer : (data as any).error || "Failed";

      setHistory((h) => [...h, { role: "assistant", content: answer }]);
      setSources(Array.isArray(data.sources_used) ? data.sources_used : []);
    } catch {
      setHistory((h) => [...h, { role: "assistant", content: "Failed to answer." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--color-border-default)] bg-[var(--color-bg-card)]">
          <h2 className="text-heading text-base font-semibold text-[var(--color-text-primary)]">Assistant</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Ask questions based on your captured posts, patterns, and inspiration.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={async () => {
                setHistory((h) => [...h, { role: "user", content: "show my best times to post" }]);
                setLoading(true);
                try {
                  const res = await fetch("/api/analytics/best-times");
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "failed");

                  if (!data?.hasEnoughData) {
                    setHistory((h) => [...h, { role: "assistant", content: `Not enough data yet. Posts analyzed: ${data?.totalPostsAnalyzed || 0}.` }]);
                  } else {
                    const top = (data.bestTimes || []).slice(0, 3);
                    const lines = top.map((t: any, i: number) => `${i + 1}) ${t.dayName} ${t.timeDisplay} (${t.confidence}) — avg ${t.avgEngagement}`);
                    setHistory((h) => [...h, { role: "assistant", content: `Best times (top 3):\n${lines.join("\n")}` }]);
                  }
                } catch {
                  setHistory((h) => [...h, { role: "assistant", content: "Couldn’t load best-times." }]);
                } finally {
                  setLoading(false);
                }
              }}
              className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] border border-[var(--color-border-default)]"
            >
              best times (deterministic)
            </button>

            <button
              onClick={async () => {
                setHistory((h) => [...h, { role: "user", content: "show my top enabled patterns" }]);
                setLoading(true);
                try {
                  const res = await fetch("/api/patterns");
                  const data = await res.json();
                  const patterns = Array.isArray(data.patterns) ? data.patterns : [];
                  const enabled = patterns.filter((p: any) => p.is_enabled);
                  const top = enabled.sort((a: any, b: any) => (b.multiplier || 1) - (a.multiplier || 1)).slice(0, 5);
                  if (top.length === 0) {
                    setHistory((h) => [...h, { role: "assistant", content: "No enabled patterns yet. Extract patterns first." }]);
                  } else {
                    const lines = top.map((p: any) => `- [${p.pattern_type}] ${p.pattern_name} (x${(p.multiplier || 1).toFixed(2)})`);
                    setHistory((h) => [...h, { role: "assistant", content: `Top enabled patterns:\n${lines.join("\n")}` }]);
                  }
                } catch {
                  setHistory((h) => [...h, { role: "assistant", content: "Couldn’t load patterns." }]);
                } finally {
                  setLoading(false);
                }
              }}
              className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] border border-[var(--color-border-default)]"
            >
              top patterns (deterministic)
            </button>

            <button
              onClick={async () => {
                setHistory((h) => [...h, { role: "user", content: "what should i do next" }]);
                setLoading(true);
                try {
                  const res = await fetch("/api/patterns/suggestions");
                  const data = await res.json();
                  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
                  const top = suggestions.slice(0, 5);
                  if (top.length === 0) {
                    setHistory((h) => [...h, { role: "assistant", content: "No suggestions yet." }]);
                  } else {
                    const lines = top.map((s: any) => `- ${s.title} (${s.impact})`);
                    setHistory((h) => [...h, { role: "assistant", content: `Next actions:\n${lines.join("\n")}` }]);
                  }
                } catch {
                  setHistory((h) => [...h, { role: "assistant", content: "Couldn’t load suggestions." }]);
                } finally {
                  setLoading(false);
                }
              }}
              className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] border border-[var(--color-border-default)]"
            >
              next actions (deterministic)
            </button>

            <button
              onClick={() => ask("summarize my last 20 inspirations and what they have in common")}
              className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] border border-[var(--color-border-default)]"
            >
              summarize inspirations
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollerRef}
          className="px-5 py-5 space-y-3 h-[520px] overflow-y-auto bg-[var(--color-bg-default)]"
        >
          {history.length === 0 ? (
            <div className="text-sm text-[var(--color-text-muted)]">
              Ask a question to get started.
            </div>
          ) : (
            history.map((t, idx) => (
              <Bubble key={idx} role={t.role} content={t.content} />
            ))
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] text-sm">
                Thinking…
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="px-5 py-4 border-t border-[var(--color-border-default)] bg-[var(--color-bg-card)]">
          <div className="flex flex-col md:flex-row gap-2 items-stretch">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder='Ask something like “when should i post?”'
              onKeyDown={(e) => {
                if (e.key === "Enter") ask();
              }}
            />
            <Button onClick={() => ask()} loading={loading} variant="primary" glow>
              Send
            </Button>
          </div>

          {sources.length > 0 && (
            <div className="mt-3 text-xs text-[var(--color-text-muted)]">
              sources used: {sources.join(" · ")}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
