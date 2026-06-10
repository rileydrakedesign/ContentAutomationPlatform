"use client";

import { useState, useEffect, useRef } from "react";
import type { TourPlacement } from "./tourSteps";

const GAP = 14; // px between target and tooltip
const VIEWPORT_PADDING = 16; // px from viewport edges

interface PositionResult {
  targetRect: DOMRect | null;
  tooltipStyle: React.CSSProperties;
  arrowPlacement: "top" | "bottom" | "left" | "right";
}

const CENTERED_RESULT: PositionResult = {
  targetRect: null,
  tooltipStyle: {
    position: "fixed" as const,
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  },
  arrowPlacement: "top",
};

function computePosition(
  target: string | null,
  placement: TourPlacement
): PositionResult {
  if (!target) return CENTERED_RESULT;

  if (typeof document === "undefined") return CENTERED_RESULT;

  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return CENTERED_RESULT;

  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (rect.top < 0 || rect.bottom > vh) {
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const style: React.CSSProperties = { position: "fixed" };
  let arrow: PositionResult["arrowPlacement"] = "top";

  const tooltipW = 340;
  const tooltipH = 200;

  let resolvedPlacement = placement;

  if (resolvedPlacement === "bottom" && rect.bottom + GAP + tooltipH > vh) {
    resolvedPlacement = "top";
  } else if (resolvedPlacement === "top" && rect.top - GAP - tooltipH < 0) {
    resolvedPlacement = "bottom";
  } else if (resolvedPlacement === "right" && rect.right + GAP + tooltipW > vw) {
    resolvedPlacement = "left";
  } else if (resolvedPlacement === "left" && rect.left - GAP - tooltipW < 0) {
    resolvedPlacement = "right";
  }

  switch (resolvedPlacement) {
    case "bottom":
      style.top = rect.bottom + GAP;
      style.left = Math.max(
        VIEWPORT_PADDING,
        Math.min(rect.left + rect.width / 2 - tooltipW / 2, vw - tooltipW - VIEWPORT_PADDING)
      );
      arrow = "top";
      break;
    case "top":
      style.bottom = vh - rect.top + GAP;
      style.left = Math.max(
        VIEWPORT_PADDING,
        Math.min(rect.left + rect.width / 2 - tooltipW / 2, vw - tooltipW - VIEWPORT_PADDING)
      );
      arrow = "bottom";
      break;
    case "right":
      style.top = Math.max(
        VIEWPORT_PADDING,
        Math.min(rect.top + rect.height / 2 - tooltipH / 2, vh - tooltipH - VIEWPORT_PADDING)
      );
      style.left = rect.right + GAP;
      arrow = "left";
      break;
    case "left":
      style.top = Math.max(
        VIEWPORT_PADDING,
        Math.min(rect.top + rect.height / 2 - tooltipH / 2, vh - tooltipH - VIEWPORT_PADDING)
      );
      style.right = vw - rect.left + GAP;
      arrow = "right";
      break;
    case "center":
      style.top = "50%";
      style.left = "50%";
      style.transform = "translate(-50%, -50%)";
      arrow = "top";
      break;
  }

  return { targetRect: rect, tooltipStyle: style, arrowPlacement: arrow };
}

export function useTourPositioning(
  target: string | null,
  placement: TourPlacement
): PositionResult {
  const [result, setResult] = useState<PositionResult>(CENTERED_RESULT);
  const prevKey = useRef("");

  useEffect(() => {
    let attempts = 0;
    let rafId: number;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const update = () => {
      const next = computePosition(target, placement);
      // Only update state when values actually changed
      const key = next.targetRect
        ? `${Math.round(next.targetRect.top)},${Math.round(next.targetRect.left)},${Math.round(next.targetRect.width)},${Math.round(next.targetRect.height)},${next.arrowPlacement}`
        : `centered,${next.arrowPlacement}`;

      if (key !== prevKey.current) {
        prevKey.current = key;
        setResult(next);
      }
    };

    // Initial measurement
    update();

    // Retry until element is found (for async-rendered targets)
    if (target) {
      intervalId = setInterval(() => {
        attempts++;
        update();
        if (attempts >= 15 || document.querySelector(`[data-tour="${target}"]`)) {
          if (intervalId) clearInterval(intervalId);
          intervalId = null;
        }
      }, 150);
    }

    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    return () => {
      if (intervalId) clearInterval(intervalId);
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [target, placement]);

  return result;
}
