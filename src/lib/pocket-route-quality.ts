import { angle, bearing, distance, type Point } from "./pocket-engine";
import { distanceToPolyline } from "./navigation-engine";

export type PocketRouteQualityMetrics = {
  novelStreetRatio: number;
  currentJourneyOverlapRatio: number;
  recentJourneyOverlapRatio: number;
  backtrackRatio: number;
  rerouteCount: number;
};

function ratio(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10_000) / 10_000;
}

function overlapsAny(
  point: Point,
  routes: Point[][],
  thresholdMeters: number,
) {
  return routes.some(
    (route) =>
      route.length > 1 &&
      distanceToPolyline(point, route) < thresholdMeters,
  );
}

/**
 * Approximate overlap using GPS polyline proximity. This intentionally does
 * not claim to know exact street segments: it only answers whether sampled
 * points are near previously walked polylines.
 */
export function recentJourneyOverlapRatio(
  trace: Point[],
  recentRoutes: Point[][],
  thresholdMeters = 18,
) {
  if (trace.length < 2 || !recentRoutes.some((route) => route.length > 1))
    return 0;
  const samples = trace.slice(1);
  const overlapping = samples.filter((point) =>
    overlapsAny(point, recentRoutes, thresholdMeters),
  ).length;
  return ratio(overlapping, samples.length);
}

/**
 * Measures self-overlap while ignoring the immediately adjacent part of the
 * current trace, which would otherwise make every point look repeated.
 */
export function currentJourneyOverlapRatio(
  trace: Point[],
  thresholdMeters = 18,
) {
  if (trace.length < 4) return 0;
  let eligible = 0;
  let overlapping = 0;
  for (let index = 3; index < trace.length; index++) {
    const previousTrace = trace.slice(0, index - 1);
    if (previousTrace.length < 2) continue;
    eligible += 1;
    if (distanceToPolyline(trace[index], previousTrace) < thresholdMeters)
      overlapping += 1;
  }
  return ratio(overlapping, eligible);
}

/**
 * Immediate reversal is a useful approximation for backtracking even though
 * GPS traces are not authoritative street graphs.
 */
export function backtrackRatio(trace: Point[]) {
  if (trace.length < 3) return 0;
  let totalMeters = 0;
  let backtrackMeters = 0;
  for (let index = 1; index < trace.length; index++) {
    const segmentMeters = distance(trace[index - 1], trace[index]);
    totalMeters += segmentMeters;
    if (index < 2 || segmentMeters === 0) continue;
    const previousMeters = distance(trace[index - 2], trace[index - 1]);
    if (previousMeters < 3 || segmentMeters < 3) continue;
    const turn = Math.abs(
      angle(
        bearing(trace[index - 1], trace[index]),
        bearing(trace[index - 2], trace[index - 1]),
      ),
    );
    if (turn >= 135) backtrackMeters += segmentMeters;
  }
  return ratio(backtrackMeters, totalMeters);
}

export function novelStreetRatio(
  trace: Point[],
  recentRoutes: Point[][],
  thresholdMeters = 18,
) {
  if (trace.length < 2) return 0;
  let novel = 0;
  let eligible = 0;
  for (let index = 1; index < trace.length; index++) {
    eligible += 1;
    const currentHistory =
      index >= 3 ? [trace.slice(0, index - 1)] : [];
    const repeated =
      overlapsAny(trace[index], currentHistory, thresholdMeters) ||
      overlapsAny(trace[index], recentRoutes, thresholdMeters);
    if (!repeated) novel += 1;
  }
  return ratio(novel, eligible);
}

export function computePocketRouteQuality(
  trace: Point[],
  recentRoutes: Point[][],
  rerouteCount: number,
): PocketRouteQualityMetrics {
  return {
    novelStreetRatio: novelStreetRatio(trace, recentRoutes),
    currentJourneyOverlapRatio: currentJourneyOverlapRatio(trace),
    recentJourneyOverlapRatio: recentJourneyOverlapRatio(trace, recentRoutes),
    backtrackRatio: backtrackRatio(trace),
    rerouteCount: Math.max(0, Math.round(rerouteCount)),
  };
}
