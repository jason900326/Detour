import type { GeoPoint } from '../journey-engine';

export type HybridDirection = 'left' | 'straight' | 'right';

export type HybridDecision = {
  direction: HybridDirection;
  bearingDegrees: number;
  reason: 'avoid-repeat' | 'explore';
};

type HybridRoute = {
  coordinates: GeoPoint[];
  distanceMeters: number;
  durationSeconds: number;
};

export type HybridRouteCandidate = {
  direction: HybridDirection;
  bearingDegrees: number;
  route: HybridRoute;
};

export type HybridRouteDecision = HybridDecision & {
  route: HybridRoute;
  score: number;
  overlapRatio: number;
};

const DIRECTION_OFFSETS: Record<HybridDirection, number> = {
  left: -90,
  straight: 0,
  right: 90,
};

const ROUTE_OVERLAP_DISTANCE_METERS = 28;
const TARGET_SEGMENT_METERS = 120;

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function rotate<T>(items: readonly T[], amount: number) {
  if (items.length === 0) return [];

  const offset = ((amount % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function distanceBetween(a: GeoPoint, b: GeoPoint) {
  const radians = Math.PI / 180;
  const radius = 6371000;
  const lat1 = a.latitude * radians;
  const lat2 = b.latitude * radians;
  const dLat = (b.latitude - a.latitude) * radians;
  const dLon = (b.longitude - a.longitude) * radians;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function routeOverlapRatio(
  route: GeoPoint[],
  recentRoutes: readonly GeoPoint[][]
) {
  if (route.length < 3 || recentRoutes.length === 0) return 0;

  const usable = route.slice(2);
  const samples = usable.filter(
    (_, index) => index % Math.max(1, Math.floor(usable.length / 24)) === 0
  );
  if (samples.length === 0) return 0;

  const historical = recentRoutes
    .filter((item) => item.length >= 3)
    .slice(-6)
    .flatMap((item) => {
      const usableHistory = item.slice(2);
      const step = Math.max(1, Math.floor(usableHistory.length / 80));
      return usableHistory.filter((_, index) => index % step === 0);
    });

  if (historical.length === 0) return 0;

  const overlapping = samples.filter((point) =>
    historical.some(
      (oldPoint) =>
        distanceBetween(point, oldPoint) <= ROUTE_OVERLAP_DISTANCE_METERS
    )
  ).length;

  return overlapping / samples.length;
}

export function bearingForDirection(
  headingDegrees: number,
  direction: HybridDirection
) {
  return normalizeDegrees(
    headingDegrees + DIRECTION_OFFSETS[direction]
  );
}

export function getHybridDirectionCandidates(args: {
  headingDegrees?: number | null;
  recentDirections?: readonly HybridDirection[];
  step: number;
}): HybridDecision[] {
  const heading = Number.isFinite(args.headingDegrees)
    ? Number(args.headingDegrees)
    : 0;
  const recent = args.recentDirections ?? [];
  const lastDirection = recent[recent.length - 1];
  const order = rotate(
    ['straight', 'right', 'left'] as const,
    args.step
  );

  return order.map((direction) => ({
    direction,
    bearingDegrees: bearingForDirection(heading, direction),
    reason:
      lastDirection && direction !== lastDirection
        ? 'avoid-repeat'
        : 'explore',
  }));
}

export function chooseHybridDirection(args: {
  headingDegrees?: number | null;
  recentDirections?: readonly HybridDirection[];
  step: number;
}): HybridDecision {
  const recent = args.recentDirections ?? [];
  const recentWindow = recent.slice(-2);
  const ordered = getHybridDirectionCandidates(args);
  const selected =
    ordered.find((candidate) =>
      !recentWindow.includes(candidate.direction)
    ) ??
    ordered.find(
      (candidate) => candidate.direction !== recent[recent.length - 1]
    ) ??
    ordered[0];

  return selected;
}

export function chooseHybridRouteCandidate(args: {
  headingDegrees?: number | null;
  recentDirections?: readonly HybridDirection[];
  recentRoutes?: readonly GeoPoint[][];
  step: number;
  candidates: readonly HybridRouteCandidate[];
}): HybridRouteDecision | null {
  if (args.candidates.length === 0) return null;

  const recent = args.recentDirections ?? [];
  const recentWindow = recent.slice(-2);
  const directionOrder = getHybridDirectionCandidates(args);
  const directionRank = new Map(
    directionOrder.map((candidate, index) => [
      candidate.direction,
      index,
    ])
  );

  const ranked = args.candidates
    .map((candidate) => {
      const overlapRatio = routeOverlapRatio(
        candidate.route.coordinates,
        args.recentRoutes ?? []
      );
      const repeatedDirection = recentWindow.includes(candidate.direction);
      const distancePenalty =
        Math.abs(candidate.route.distanceMeters - TARGET_SEGMENT_METERS) /
        TARGET_SEGMENT_METERS;
      const score =
        overlapRatio * 7 +
        (repeatedDirection ? 3.2 : 0) +
        distancePenalty * 0.45 +
        (directionRank.get(candidate.direction) ?? 3) * 0.08;

      return {
        ...candidate,
        overlapRatio,
        score,
      };
    })
    .sort((a, b) => a.score - b.score);

  const selected = ranked[0];
  const lastDirection = recent[recent.length - 1];

  return {
    direction: selected.direction,
    bearingDegrees: selected.bearingDegrees,
    reason:
      lastDirection && selected.direction !== lastDirection
        ? 'avoid-repeat'
        : 'explore',
    route: selected.route,
    score: selected.score,
    overlapRatio: selected.overlapRatio,
  };
}
