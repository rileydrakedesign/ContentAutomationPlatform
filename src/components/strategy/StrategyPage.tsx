"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Minus, Plus, FileText, MessageSquare, Layers, AlertCircle, X as XIcon, Plus as PlusIcon } from "lucide-react";

type PillarTarget = { pillar: string; posts_per_week: number };

type Strategy = {
  posts_per_week: number;
  threads_per_week: number;
  replies_per_week: number;
  pillar_targets: PillarTarget[];
};

type NicheProfile = {
  content_pillars: string[];
  niche_summary: string | null;
};

function NumberStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        className="w-7 h-7 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-center justify-center hover:bg-[var(--color-bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Minus size={12} className="text-[var(--color-text-secondary)]" />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10);
          onChange(isNaN(parsed) ? 0 : Math.max(0, parsed));
        }}
        className="w-12 h-7 text-center text-sm font-semibold text-[var(--color-text-primary)] font-mono tabular-nums bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg outline-none focus:border-[var(--color-primary-500)] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        min={0}
      />
      <button
        onClick={() => onChange(value + 1)}
        className="w-7 h-7 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-center justify-center hover:bg-[var(--color-bg-hover)] transition-colors"
      >
        <Plus size={12} className="text-[var(--color-text-secondary)]" />
      </button>
    </div>
  );
}

export function StrategyPage() {
  const [strategy, setStrategy] = useState<Strategy>({
    posts_per_week: 5,
    threads_per_week: 1,
    replies_per_week: 10,
    pillar_targets: [],
  });
  const [nicheProfile, setNicheProfile] = useState<NicheProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/strategy").then((r) => r.json()),
      fetch("/api/niche/profile").then((r) => r.json()),
    ])
      .then(([strategyData, nicheData]) => {
        if (strategyData.strategy) setStrategy(strategyData.strategy);
        if (nicheData.profile) setNicheProfile(nicheData.profile);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback((updated: Strategy) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch("/api/strategy", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
      } catch (e) {
        console.error("Failed to save strategy:", e);
      } finally {
        setSaving(false);
      }
    }, 600);
  }, []);

  const update = useCallback(
    (patch: Partial<Strategy>) => {
      setStrategy((prev) => {
        const next = { ...prev, ...patch };
        save(next);
        return next;
      });
    },
    [save]
  );

  const updatePillarTarget = useCallback(
    (pillar: string, posts_per_week: number) => {
      setStrategy((prev) => {
        const targets = [...prev.pillar_targets];
        const idx = targets.findIndex((t) => t.pillar === pillar);
        if (idx >= 0) {
          targets[idx] = { ...targets[idx], posts_per_week };
        } else {
          targets.push({ pillar, posts_per_week });
        }
        const next = { ...prev, pillar_targets: targets };
        save(next);
        return next;
      });
    },
    [save]
  );

  const removePillarTarget = useCallback(
    (pillar: string) => {
      setStrategy((prev) => {
        const targets = prev.pillar_targets.filter((t) => t.pillar !== pillar);
        const next = { ...prev, pillar_targets: targets };
        save(next);
        return next;
      });
    },
    [save]
  );

  const addCustomTopic = useCallback(() => {
    const trimmed = newTopic.trim();
    if (!trimmed) return;
    if (strategy.pillar_targets.some((t) => t.pillar.toLowerCase() === trimmed.toLowerCase())) return;
    updatePillarTarget(trimmed, 1);
    setNewTopic("");
  }, [newTopic, strategy.pillar_targets, updatePillarTarget]);

  // Suggested pillars from niche profile that aren't already added
  const suggestedPillars = (nicheProfile?.content_pillars || []).filter(
    (p) => !strategy.pillar_targets.some((t) => t.pillar.toLowerCase() === p.toLowerCase())
  );

  const totalFormatTarget = strategy.posts_per_week + strategy.threads_per_week;
  const totalPillarTarget = strategy.pillar_targets.reduce((s, t) => s + t.posts_per_week, 0);
  const pillarMismatch = strategy.pillar_targets.length > 0 && totalPillarTarget !== totalFormatTarget;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 animate-fade-in">
        <div className="h-7 skeleton w-40 mb-2" />
        <div className="h-4 skeleton w-64 mb-8" />
        <div className="space-y-4">
          <div className="h-48 skeleton" />
          <div className="h-48 skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
            Content Strategy
          </h1>
          {saving && (
            <span className="text-xs text-[var(--color-text-muted)] animate-pulse">
              Saving...
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Set your weekly posting targets to stay consistent
        </p>
      </div>

      {/* Weekly Targets by Format */}
      <Card className="mb-4">
        <CardContent>
          <h2 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">
            Weekly targets
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <FileText size={18} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">Posts</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Single posts per week</p>
                </div>
              </div>
              <NumberStepper
                value={strategy.posts_per_week}
                onChange={(v) => update({ posts_per_week: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Layers size={18} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">Threads</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Multi-tweet threads per week</p>
                </div>
              </div>
              <NumberStepper
                value={strategy.threads_per_week}
                onChange={(v) => update({ threads_per_week: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <MessageSquare size={18} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">Replies</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Replies per week</p>
                </div>
              </div>
              <NumberStepper
                value={strategy.replies_per_week}
                onChange={(v) => update({ replies_per_week: v })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Topic Distribution */}
      <Card>
        <CardContent>
          <h2 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
            Topic distribution
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            Allocate your {totalFormatTarget} posts + threads across topics
          </p>

          {/* Active topic targets */}
          {strategy.pillar_targets.length > 0 && (
            <div className="space-y-3 mb-4">
              {strategy.pillar_targets.map((pt) => (
                <div key={pt.pillar} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      onClick={() => removePillarTarget(pt.pillar)}
                      className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-500/20 transition-colors flex-shrink-0"
                      title="Remove topic"
                    >
                      <XIcon size={12} className="text-[var(--color-text-muted)] hover:text-red-400" />
                    </button>
                    <span className="text-sm text-[var(--color-text-primary)] truncate">
                      {pt.pillar}
                    </span>
                  </div>
                  <NumberStepper
                    value={pt.posts_per_week}
                    onChange={(v) => updatePillarTarget(pt.pillar, v)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Suggested pillars from niche profile */}
          {suggestedPillars.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-[var(--color-text-muted)] mb-2">Suggested from your niche</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedPillars.map((pillar) => (
                  <button
                    key={pillar}
                    onClick={() => updatePillarTarget(pillar, 1)}
                    className="text-xs px-2.5 py-1 rounded-full border border-dashed border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-500)] hover:text-[var(--color-primary-400)] transition-colors flex items-center gap-1"
                  >
                    <PlusIcon size={10} />
                    {pillar}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add custom topic */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustomTopic();
              }}
              placeholder="Add a custom topic..."
              className="flex-1 h-8 px-3 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary-500)] transition-colors"
            />
            <button
              onClick={addCustomTopic}
              disabled={!newTopic.trim()}
              className="h-8 px-3 text-xs font-medium bg-[var(--color-primary-500)]/10 text-[var(--color-primary-400)] rounded-lg hover:bg-[var(--color-primary-500)]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>

          {pillarMismatch && (
            <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertCircle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-300">
                Topic targets sum to {totalPillarTarget} but you have {totalFormatTarget} posts + threads per week.
                Consider adjusting so they match.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
