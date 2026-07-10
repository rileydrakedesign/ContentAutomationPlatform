"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QueueFilter, RadarTarget, SkipReason, TriageState, Watch } from "./types";

interface ApiQueueItem {
  id: string;
  state: TriageState;
  score: number | string;
  reasons: string[];
  skip_reason: string | null;
  updated_at: string;
  watch_label: string | null;
  post: {
    post_id: string;
    text: string;
    author_username: string | null;
    author_name: string | null;
    author_followers: number | null;
    posted_at: string | null;
    metrics: RadarTarget["metrics"];
  };
}

export interface SweepOutcome {
  ok: boolean;
  message: string;
  seededWatches: number;
  queued: number;
}

function toTarget(i: ApiQueueItem): RadarTarget {
  return {
    key: i.id,
    queueId: i.id,
    postId: i.post.post_id,
    text: i.post.text,
    authorUsername: i.post.author_username,
    authorName: i.post.author_name,
    authorFollowers: i.post.author_followers,
    postedAt: i.post.posted_at,
    metrics: i.post.metrics ?? null,
    score: Number(i.score) || 0,
    reasons: Array.isArray(i.reasons) ? i.reasons : [],
    watchLabel: i.watch_label,
    state: i.state,
    skipReason: (i.skip_reason as SkipReason | null) ?? null,
  };
}

/**
 * The Radar desk's data layer: server-backed queue (user_target_queue via
 * GET/PATCH /api/radar/queue) with optimistic triage transitions, plus
 * client-only "hunt" targets from the manual search (queueId null — their
 * state never leaves the browser).
 */
export function useRadarQueue() {
  const [targets, setTargets] = useState<RadarTarget[]>([]);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [lastSweptAt, setLastSweptAt] = useState<string | null>(null);
  const [unitsPaused, setUnitsPaused] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [notBeta, setNotBeta] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);
  // Hunt targets live outside refetches so a queue reload doesn't drop them.
  const huntRef = useRef<RadarTarget[]>([]);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/radar/queue?states=new,snoozed,replied");
      if (res.status === 403) {
        setNotBeta(true);
        return;
      }
      if (!res.ok) {
        setLoadError("Couldn't load your queue.");
        return;
      }
      const data = await res.json();
      const serverTargets: RadarTarget[] = Array.isArray(data.items)
        ? data.items.map(toTarget)
        : [];
      const serverPostIds = new Set(serverTargets.map((t) => t.postId));
      setTargets([
        ...serverTargets,
        ...huntRef.current.filter((h) => !serverPostIds.has(h.postId)),
      ]);
      setWatches(Array.isArray(data.watches) ? data.watches : []);
      setLastSweptAt(data.last_swept_at ?? null);
      setUnitsPaused(data.units_paused ?? 0);
      setLoadError(null);
    } catch {
      setLoadError("Couldn't load your queue.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  /** Optimistic triage transition; hunt targets (no queueId) stay client-only. */
  const setState = useCallback(
    (target: RadarTarget, state: TriageState, skipReason?: SkipReason) => {
      setTargets((prev) =>
        prev.map((t) =>
          t.key === target.key ? { ...t, state, skipReason: skipReason ?? null } : t
        )
      );
      if (target.queueId === null) {
        huntRef.current = huntRef.current.map((t) =>
          t.key === target.key ? { ...t, state, skipReason: skipReason ?? null } : t
        );
        return;
      }
      fetch(`/api/radar/queue/${target.queueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          state === "skipped" ? { state, skip_reason: skipReason ?? null } : { state }
        ),
      }).catch(() => {
        // A refetch reconciles on the next load; the ritual should feel instant.
      });
    },
    []
  );

  const toggleWatch = useCallback((watch: Watch) => {
    const enabled = !watch.enabled;
    setWatches((prev) => prev.map((w) => (w.id === watch.id ? { ...w, enabled } : w)));
    fetch(`/api/radar/watches/${watch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }).catch(() => {
      setWatches((prev) => prev.map((w) => (w.id === watch.id ? { ...w, enabled: !enabled } : w)));
    });
  }, []);

  const sweep = useCallback(async (): Promise<SweepOutcome> => {
    setSweeping(true);
    try {
      const res = await fetch("/api/radar/sweep", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          ok: false,
          message: data.error || "Sweep failed.",
          seededWatches: 0,
          queued: 0,
        };
      }
      const s = data.summary || {};
      await fetchQueue();
      return {
        ok: true,
        message:
          s.queued > 0
            ? `Swept ${s.units_swept} watch${s.units_swept === 1 ? "" : "es"} — ${s.queued} new target${s.queued === 1 ? "" : "s"}.`
            : `Swept ${s.units_swept} watch${s.units_swept === 1 ? "" : "es"} — nothing new since last sweep.`,
        seededWatches: s.seeded_watches ?? 0,
        queued: s.queued ?? 0,
      };
    } catch {
      return { ok: false, message: "Sweep failed.", seededWatches: 0, queued: 0 };
    } finally {
      setSweeping(false);
    }
  }, [fetchQueue]);

  /** Merge manual-hunt results into the rail (dedup by post id, any state). */
  const mergeHunt = useCallback((incoming: RadarTarget[]) => {
    setTargets((prev) => {
      const seen = new Set(prev.map((t) => t.postId));
      const fresh = incoming.filter((t) => !seen.has(t.postId));
      huntRef.current = [
        ...huntRef.current.filter((h) => !fresh.some((f) => f.postId === h.postId)),
        ...fresh,
      ];
      return [...prev, ...fresh];
    });
  }, []);

  const counts = useMemo<Record<QueueFilter, number>>(
    () => ({
      new: targets.filter((t) => t.state === "new").length,
      snoozed: targets.filter((t) => t.state === "snoozed").length,
      replied: targets.filter((t) => t.state === "replied").length,
    }),
    [targets]
  );

  return {
    targets,
    watches,
    counts,
    lastSweptAt,
    unitsPaused,
    loaded,
    notBeta,
    loadError,
    sweeping,
    fetchQueue,
    setState,
    toggleWatch,
    sweep,
    mergeHunt,
  };
}
