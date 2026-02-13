"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { formatNumber } from "@/lib/utils/formatting";
import { weightedEngagement } from "@/lib/utils/engagement";
import type { PostAnalytics } from "@/types/analytics";

const SVG_W = 600;
const SVG_H = 200;
const PAD = { top: 10, right: 10, bottom: 24, left: 44 };
const PLOT_W = SVG_W - PAD.left - PAD.right;
const PLOT_H = SVG_H - PAD.top - PAD.bottom;

interface DayData {
  date: string; // YYYY-MM-DD
  avgImpressions: number;
  avgEngagement: number;
}

function rollingAvg(
  dayMap: Map<string, { impressions: number[]; engagement: number[] }>,
  sortedDates: string[],
  window: number
): DayData[] {
  const result: DayData[] = [];

  for (let i = 0; i < sortedDates.length; i++) {
    const windowStart = Math.max(0, i - window + 1);
    let impSum = 0, impCount = 0;
    let engSum = 0, engCount = 0;

    for (let j = windowStart; j <= i; j++) {
      const day = dayMap.get(sortedDates[j]);
      if (day) {
        for (const v of day.impressions) { impSum += v; impCount++; }
        for (const v of day.engagement) { engSum += v; engCount++; }
      }
    }

    result.push({
      date: sortedDates[i],
      avgImpressions: impCount > 0 ? impSum / impCount : 0,
      avgEngagement: engCount > 0 ? engSum / engCount : 0,
    });
  }

  return result;
}

function buildPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
}

function buildAreaPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  const line = buildPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L${last.x},${PAD.top + PLOT_H} L${first.x},${PAD.top + PLOT_H} Z`;
}

function formatDateLabel(d: string): string {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface Props {
  posts: PostAnalytics[];
}

export function GrowthTrendChart({ posts }: Props) {
  const [window, setWindow] = useState<7 | 14>(7);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { data, impPoints, engPoints, yTicks, xLabels, uniqueDates } = useMemo(() => {
    const nonReplies = posts.filter((p) => !p.is_reply);
    const dayMap = new Map<string, { impressions: number[]; engagement: number[] }>();

    for (const p of nonReplies) {
      const d = p.date.slice(0, 10); // YYYY-MM-DD
      if (!dayMap.has(d)) dayMap.set(d, { impressions: [], engagement: [] });
      const entry = dayMap.get(d)!;
      entry.impressions.push(p.impressions);
      entry.engagement.push(weightedEngagement(p as unknown as Record<string, number>));
    }

    const sortedDates = Array.from(dayMap.keys()).sort();
    if (sortedDates.length < 3) {
      return { data: [], impPoints: [], engPoints: [], yTicks: [], xLabels: [], uniqueDates: 0 };
    }

    const avg = rollingAvg(dayMap, sortedDates, window);

    const maxImp = Math.max(...avg.map((d) => d.avgImpressions), 1);
    const maxEng = Math.max(...avg.map((d) => d.avgEngagement), 1);
    const yMax = Math.max(maxImp, 1);

    // Scale points
    const toX = (i: number) => PAD.left + (i / (avg.length - 1)) * PLOT_W;
    const toYImp = (v: number) => PAD.top + PLOT_H - (v / yMax) * PLOT_H;

    // For engagement, scale relative to its own max but map into same pixel space
    const engScale = maxEng > 0 ? yMax / maxEng : 1;

    const impPts = avg.map((d, i) => ({ x: toX(i), y: toYImp(d.avgImpressions) }));
    const engPts = avg.map((d, i) => ({ x: toX(i), y: toYImp(d.avgEngagement * engScale) }));

    // Y ticks (3-4 marks)
    const tickCount = 4;
    const yTickVals: number[] = [];
    for (let i = 0; i <= tickCount; i++) {
      yTickVals.push(Math.round((yMax / tickCount) * i));
    }

    // X labels (~5)
    const labelCount = Math.min(5, avg.length);
    const xlabels: { label: string; x: number }[] = [];
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.round((i / (labelCount - 1)) * (avg.length - 1));
      xlabels.push({ label: formatDateLabel(avg[idx].date), x: toX(idx) });
    }

    return {
      data: avg,
      impPoints: impPts,
      engPoints: engPts,
      yTicks: yTickVals,
      xLabels: xlabels,
      uniqueDates: sortedDates.length,
    };
  }, [posts, window]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || data.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * SVG_W;
      const relX = mouseX - PAD.left;
      const idx = Math.round((relX / PLOT_W) * (data.length - 1));
      setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
    },
    [data]
  );

  if (uniqueDates < 3) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Growth Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Need posts from at least 3 different days to show trends
          </p>
        </CardContent>
      </Card>
    );
  }

  const hoverData = hoverIdx !== null ? data[hoverIdx] : null;
  const hoverX = hoverIdx !== null ? impPoints[hoverIdx]?.x : null;

  return (
    <Card className="h-full">
      <CardHeader
        action={
          <div className="flex gap-1">
            {([7, 14] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className="text-xs px-2 py-0.5 rounded transition-colors"
                style={{
                  backgroundColor: window === w ? "rgba(99,102,241,0.2)" : "transparent",
                  color: window === w ? "rgb(129,140,248)" : "var(--color-text-tertiary)",
                }}
              >
                {w}d
              </button>
            ))}
          </div>
        }
      >
        <CardTitle>Growth Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ position: "relative" }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            width="100%"
            style={{ display: "block" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* Gradient fill for impressions */}
            <defs>
              <linearGradient id="impGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(99,102,241)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="rgb(99,102,241)" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Y-axis grid lines + labels */}
            {yTicks.map((tick) => {
              const y = PAD.top + PLOT_H - (tick / Math.max(...yTicks, 1)) * PLOT_H;
              return (
                <g key={tick}>
                  <line
                    x1={PAD.left}
                    y1={y}
                    x2={SVG_W - PAD.right}
                    y2={y}
                    stroke="var(--color-border-default)"
                    strokeWidth={0.5}
                    opacity={0.5}
                  />
                  <text
                    x={PAD.left - 6}
                    y={y + 3}
                    textAnchor="end"
                    fontSize={10}
                    fill="var(--color-text-tertiary)"
                  >
                    {formatNumber(tick)}
                  </text>
                </g>
              );
            })}

            {/* X-axis labels */}
            {xLabels.map((l) => (
              <text
                key={l.label + l.x}
                x={l.x}
                y={SVG_H - 4}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-text-tertiary)"
              >
                {l.label}
              </text>
            ))}

            {/* Area fill */}
            <path d={buildAreaPath(impPoints)} fill="url(#impGradient)" />

            {/* Impressions line */}
            <path
              d={buildPath(impPoints)}
              fill="none"
              stroke="rgb(99,102,241)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Engagement line (dashed) */}
            <path
              d={buildPath(engPoints)}
              fill="none"
              stroke="rgb(45,212,191)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Hover crosshair */}
            {hoverX !== null && (
              <line
                x1={hoverX}
                y1={PAD.top}
                x2={hoverX}
                y2={PAD.top + PLOT_H}
                stroke="var(--color-text-tertiary)"
                strokeWidth={1}
                strokeDasharray="2 2"
                opacity={0.6}
              />
            )}

            {/* Hover dots */}
            {hoverIdx !== null && impPoints[hoverIdx] && (
              <>
                <circle
                  cx={impPoints[hoverIdx].x}
                  cy={impPoints[hoverIdx].y}
                  r={4}
                  fill="rgb(99,102,241)"
                  stroke="var(--color-bg-surface)"
                  strokeWidth={2}
                />
                <circle
                  cx={engPoints[hoverIdx].x}
                  cy={engPoints[hoverIdx].y}
                  r={3}
                  fill="rgb(45,212,191)"
                  stroke="var(--color-bg-surface)"
                  strokeWidth={2}
                />
              </>
            )}
          </svg>

          {/* Tooltip */}
          {hoverData && hoverX !== null && (
            <div
              style={{
                position: "absolute",
                left: `${(hoverX / SVG_W) * 100}%`,
                top: 0,
                transform: "translateX(-50%)",
                pointerEvents: "none",
                zIndex: 10,
              }}
            >
              <div
                className="rounded-lg text-xs"
                style={{
                  backgroundColor: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border-default)",
                  padding: "6px 10px",
                  whiteSpace: "nowrap",
                }}
              >
                <p className="font-medium text-[var(--color-text-primary)]">
                  {formatDateLabel(hoverData.date)}
                </p>
                <p style={{ color: "rgb(129,140,248)" }}>
                  Imp: {formatNumber(Math.round(hoverData.avgImpressions))}
                </p>
                <p style={{ color: "rgb(45,212,191)" }}>
                  Eng: {formatNumber(Math.round(hoverData.avgEngagement))}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div style={{ width: 16, height: 2, backgroundColor: "rgb(99,102,241)", borderRadius: 1 }} />
            <span className="text-[10px] text-[var(--color-text-tertiary)]">Impressions ({window}d avg)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 16, height: 2, backgroundColor: "rgb(45,212,191)", borderRadius: 1, backgroundImage: "repeating-linear-gradient(90deg, rgb(45,212,191) 0 4px, transparent 4px 7px)" }} />
            <span className="text-[10px] text-[var(--color-text-tertiary)]">Engagement ({window}d avg)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
