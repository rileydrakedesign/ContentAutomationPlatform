"use client";

import { UserVoiceExample } from "@/types/voice";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface ExampleCardProps {
  example: UserVoiceExample;
  onPin?: () => void;
  onUnpin?: () => void;
  onExclude?: () => void;
  onRestore?: () => void;
  showDragHandle?: boolean;
}

export function ExampleCard({
  example,
  onPin,
  onUnpin,
  onExclude,
  onRestore,
  showDragHandle = false,
}: ExampleCardProps) {
  const isPinned = example.source === "pinned";
  const isExcluded = example.is_excluded;

  const formatMetric = (value: number | undefined) => {
    if (!value) return "0";
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toString();
  };

  const metrics = example.metrics_snapshot;

  return (
    <Card className={`p-4 ${isExcluded ? "opacity-60" : ""}`}>
      <CardContent>
        <div className="flex gap-3">
          {showDragHandle && (
            <div className="flex items-center text-slate-600 cursor-grab">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Badge variant={isPinned ? "primary" : "default"}>
                  {isPinned ? "Pinned" : "Auto"}
                </Badge>
                <Badge variant="secondary">{example.content_type}</Badge>
                {example.selection_reason && !isPinned && (
                  <span className="text-xs text-slate-500">{example.selection_reason}</span>
                )}
              </div>
            </div>

            <p className="text-white text-sm leading-relaxed mb-3 whitespace-pre-wrap">
              {example.content_text}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-slate-500">
                {metrics.likes !== undefined && (
                  <span>{formatMetric(metrics.likes)} likes</span>
                )}
                {metrics.retweets !== undefined && (
                  <span>{formatMetric(metrics.retweets)} RTs</span>
                )}
                {metrics.replies !== undefined && (
                  <span>{formatMetric(metrics.replies)} replies</span>
                )}
                <span className="text-slate-600">
                  Score: {example.engagement_score.toFixed(0)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isExcluded ? (
                  <button
                    onClick={onRestore}
                    className="text-xs text-amber-400 hover:text-amber-300 transition"
                  >
                    Restore
                  </button>
                ) : (
                  <>
                    {isPinned ? (
                      <button
                        onClick={onUnpin}
                        className="text-xs text-slate-400 hover:text-white transition"
                      >
                        Unpin
                      </button>
                    ) : (
                      <button
                        onClick={onPin}
                        className="text-xs text-amber-400 hover:text-amber-300 transition"
                      >
                        Pin
                      </button>
                    )}
                    <button
                      onClick={onExclude}
                      className="text-xs text-red-400 hover:text-red-300 transition"
                    >
                      Exclude
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
