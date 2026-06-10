"use client";

const PADDING = 8; // px around the target element
const RADIUS = 12; // border-radius of the cutout

interface TourOverlayProps {
  targetRect: DOMRect | null;
  transitioning: boolean;
}

export function TourOverlay({ targetRect, transitioning }: TourOverlayProps) {
  if (!targetRect) {
    // No target — render a full backdrop
    return (
      <div
        className="fixed inset-0 bg-black/60 animate-fade-in"
        style={{ zIndex: 45, pointerEvents: "auto" }}
      />
    );
  }

  return (
    <>
      {/* Clickable backdrop that covers the whole screen */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 44, pointerEvents: "auto" }}
      />
      {/* Spotlight cutout over the target */}
      <div
        style={{
          position: "fixed",
          zIndex: 45,
          top: targetRect.top - PADDING,
          left: targetRect.left - PADDING,
          width: targetRect.width + PADDING * 2,
          height: targetRect.height + PADDING * 2,
          borderRadius: RADIUS,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
          transition: transitioning ? "all 300ms ease-in-out" : "none",
          pointerEvents: "none",
        }}
      />
    </>
  );
}
