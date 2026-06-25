import { describe, it, expect } from "vitest";
import {
  cosine,
  normalize,
  centroid,
  mapCosineToScore,
  accumulateCalibration,
  type Calibration,
} from "./vectors";

describe("vectors — cosine / normalize / centroid", () => {
  it("cosine is 1 for identical, 0 for orthogonal, -1 for opposite", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1, 6);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 6);
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1, 6);
  });

  it("cosine is scale-invariant and safe on degenerate input", () => {
    expect(cosine([2, 0], [5, 0])).toBeCloseTo(1, 6);
    expect(cosine([0, 0], [1, 1])).toBe(0);
    expect(cosine([], [])).toBe(0);
  });

  it("normalize returns a unit vector (or the zero vector unchanged)", () => {
    const n = normalize([3, 4]);
    expect(Math.hypot(n[0], n[1])).toBeCloseTo(1, 6);
    expect(normalize([0, 0])).toEqual([0, 0]);
  });

  it("centroid averages then normalizes; [] for empty input", () => {
    expect(centroid([])).toEqual([]);
    const c = centroid([
      [1, 0],
      [0, 1],
    ]);
    expect(Math.hypot(c[0], c[1])).toBeCloseTo(1, 6);
    expect(c[0]).toBeCloseTo(c[1], 6); // symmetric inputs → 45°
  });
});

describe("vectors — calibration map", () => {
  it("default affine map: ~0.55→~40, ~0.85→~95, clamped", () => {
    expect(mapCosineToScore(0.55)).toBe(40);
    expect(mapCosineToScore(0.85)).toBe(95);
    expect(mapCosineToScore(0.1)).toBe(0); // clamped low
    expect(mapCosineToScore(0.99)).toBe(100); // clamped high
    // monotonic in between
    expect(mapCosineToScore(0.7)).toBeGreaterThan(mapCosineToScore(0.6));
  });

  it("uses the per-user linear fit once there are enough pairs", () => {
    // Feed a perfect linear relationship score = 100·cosine.
    let calib: Calibration | null = null;
    for (const cos of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
      calib = accumulateCalibration(calib, cos, 100 * cos);
    }
    expect(calib!.n).toBe(9);
    // With ≥8 pairs the fit (slope≈100, intercept≈0) overrides the default map.
    expect(mapCosineToScore(0.5, calib)).toBeCloseTo(50, 0);
    expect(mapCosineToScore(0.3, calib)).toBeCloseTo(30, 0);
  });

  it("falls back to the default map below the minimum pair count", () => {
    let calib: Calibration | null = null;
    for (const cos of [0.1, 0.9, 0.5]) calib = accumulateCalibration(calib, cos, 100 * cos);
    // n=3 (< 8) → default map, not the (here would-be perfect) fit.
    expect(mapCosineToScore(0.55, calib)).toBe(40);
  });

  it("forgets old samples once it grows large (bounded accumulators)", () => {
    let calib: Calibration = { n: 200, sx: 100, sy: 5000, sxx: 60, sxy: 3000 };
    calib = accumulateCalibration(calib, 0.5, 50);
    // Halved (forgetting) then +1 sample → n ≈ 101, not 201.
    expect(calib.n).toBeCloseTo(101, 6);
  });
});
