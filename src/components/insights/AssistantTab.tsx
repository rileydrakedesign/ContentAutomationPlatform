"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Turn = { role: "user" | "assistant"; content: string };

type ChatResponse = { answer: string; sources_used: string[] };

export function AssistantTab() {
  const [history, setHistory] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<string[]>([]);

  async function ask() {
    const q = question.trim();
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
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-heading text-base font-semibold text-[var(--color-text-primary)]">Assistant</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Ask questions based on your captured posts, patterns, and inspiration.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col md:flex-row gap-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder='e.g. "when is the best time for me to post?"'
              onKeyDown={(e) => {
                if (e.key === "Enter") ask();
              }}
            />
            <Button onClick={ask} loading={loading} variant="primary" glow>
              Ask
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setQuestion("when is the best time for me to post?")}
              className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] border border-[var(--color-border-default)]"
            >
              best time to post
            </button>
            <button
              onClick={() => setQuestion("what patterns are working for me right now?")}
              className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] border border-[var(--color-border-default)]"
            >
              what patterns work
            </button>
            <button
              onClick={() => setQuestion("summarize my last 20 inspirations and what they have in common")}
              className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] border border-[var(--color-border-default)]"
            >
              summarize inspirations
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No messages yet.</p>
          ) : (
            <div className="space-y-3">
              {history.map((t, idx) => (
                <div
                  key={idx}
                  className={
                    t.role === "user"
                      ? "p-3 rounded-xl bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                      : "p-3 rounded-xl bg-[var(--color-primary-500)]/10 text-[var(--color-text-primary)] border border-[var(--color-primary-500)]/15"
                  }
                >
                  <div className="text-xs text-[var(--color-text-muted)] mb-1">
                    {t.role === "user" ? "You" : "Assistant"}
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{t.content}</div>
                </div>
              ))}
            </div>
          )}

          {sources.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--color-border-default)]">
              <div className="text-xs text-[var(--color-text-muted)] mb-2">Sources used</div>
              <ul className="text-xs text-[var(--color-text-secondary)] space-y-1 list-disc pl-4">
                {sources.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
