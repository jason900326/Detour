export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export type PocketRouteQualityMetrics = {
  novelStreetRatio: number;
  currentJourneyOverlapRatio: number;
  recentJourneyOverlapRatio: number;
  backtrackRatio: number;
  rerouteCount: number;
};

const EARTH_METERS_PER_DEGREE = 111_320;

function ratio(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10_000) / 10_000;
}

function distance(a: RoutePoint, b: RoutePoint) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.latitude - a.latitude) * r) / 2) ** 2 +
    Math.cos(a.latitude * r) *
      Math.cos(b.latitude * r) *
      Math.sin(((b.longitude - a.longitude) * r) / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function bearing(a: RoutePoint, b: RoutePoint) {
  const r = Math.PI / 180;
  const deltaLongitude = (b.longitude - a.longitude) * r;
  return (
    (Math.atan2(
      Math.sin(deltaLongitude) * Math.cos(b.latitude * r),
      Math.cos(a.latitude * r) * Math.sin(b.latitude * r) -
        Math.sin(a.latitude * r) *
          Math.cos(b.latitude * r) *
          Math.cos(deltaLongitude),
    ) /
      r +
      360) %
    360
  );
}

function angle(a: number, b: number) {
  return ((a - b + 540) % 360) - 180;
}

function distanceToSegment(
  point: RoutePoint,
  start: RoutePoint,
  end: RoutePoint,
) {
  const latitudeRadians = (point.latitude * Math.PI) / 180;
  const cosLatitude = Math.max(0.1, Math.cos(latitudeRadians));
  const toLocal = (value: RoutePoint) => ({
    x:
      (value.longitude - point.longitude) *
      EARTH_METERS_PER_DEGREE *
      cosLatitude,
    y:
      (value.latitude - point.latitude) *
      EARTH_METERS_PER_DEGREE,
  });
  const a = toLocal(start);
  const b = toLocal(end);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const denominator = dx * dx + dy * dy;
  if (!denominator) return Math.hypot(a.x, a.y);
  const projection = Math.max(
    0,
    Math.min(1, -(a.x * dx + a.y * dy) / denominator),
  );
  return Math.hypot(a.x + projection * dx, a.y + projection * dy);
}

function distanceToPolyline(point: RoutePoint, line: RoutePoint[]) {
  if (!line.length) return Number.POSITIVE_INFINITY;
  if (line.length === 1) return distance(point, line[0]);
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < line.length; index++) {
    best = Math.min(
      best,
      distanceToSegment(point, line[index - 1], line[index]),
    );
  }
  return best;
}

function overlapsAny(
  point: RoutePoint,
  routes: RoutePoint[][],
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
  trace: RoutePoint[],
  recentRoutes: RoutePoint[][],
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
  trace: RoutePoint[],
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
export function backtrackRatio(trace: RoutePoint[]) {
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
  trace: RoutePoint[],
  recentRoutes: RoutePoint[][],
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
  trace: RoutePoint[],
  recentRoutes: RoutePoint[][],
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
