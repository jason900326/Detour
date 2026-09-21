import type { GeoPoint } from './journey-engine';
import {
  bearingBetween,
  distanceBetween,
  signedAngle,
  type NavigationRoute,
} from './navigation-engine';
import { offsetPoint } from './geo-utils';
import type { WalkingRoute } from './routing-engine';

export function closingStopPriority(kind: string) {
  const priority: Record<string, number> = {
    'green-space': 0,
    square: 1,
    pedestrian: 2,
    fountain: 3,
    viewpoint: 4,
    footbridge: 5,
  };
  return priority[kind] ?? 99;
}

export type V2RouteOption = {
  origin: GeoPoint;
  destination: GeoPoint;
  walkingRoute: WalkingRoute;
  navigationRoute: NavigationRoute;
  purpose: 'exploration' | 'closing';
  label?: string;
};

export function buildShortRouteDestinations(
  start: GeoPoint,
  seed: number,
  previousBearing: number | null,
  journeyAnchor?: GeoPoint | null
) {
  let base = previousBearing ?? ((seed * 73) % 360);
  let offsets = previousBearing === null ? [0, 90, 180, 270] : [-60, 12, 72, 138];

  if (journeyAnchor && distanceBetween(start, journeyAnchor) > 420) {
    const anchorBearing = bearingBetween(start, journeyAnchor);
    if (previousBearing === null) {
      base = anchorBearing;
      offsets = [-45, 0, 45, 90];
    } else {
      const correction = signedAngle(anchorBearing - previousBearing);
      // Never snap back toward the anchor. Bend at most 75° per short segment
      // so deviation feels accepted while the journey gradually stays bounded.
      const boundedCorrection = Math.max(-75, Math.min(75, correction));
      base = previousBearing + boundedCorrection;
      offsets = [-34, 0, 34, 68];
    }
  }

  const distances = [150, 175, 205, 230];

  return offsets.map((offset, index) =>
    offsetPoint(start, distances[index], base + offset)
  );
}

function routeBearing(route: WalkingRoute, origin: GeoPoint) {
  for (const point of route.coordinates) {
    if (distanceBetween(origin, point) >= 8) return bearingBetween(origin, point);
  }
  return bearingBetween(origin, route.coordinates[route.coordinates.length - 1] ?? origin);
}

function routeOverlapRatio(route: WalkingRoute, previousRoutes: GeoPoint[][]) {
  const samples = route.coordinates.filter((_, index) => index % 3 === 0).slice(1, 32);
  if (samples.length === 0 || previousRoutes.length === 0) return 0;

  let overlap = 0;
  for (const sample of samples) {
    const isRepeated = previousRoutes.some((previous) =>
      previous.some((point) => distanceBetween(sample, point) <= 28)
    );
    if (isRepeated) overlap += 1;
  }
  return overlap / samples.length;
}

export function chooseBestV2Route(
  options: V2RouteOption[],
  previousRoutes: GeoPoint[][],
  previousBearing: number | null,
  purpose: 'exploration' | 'closing'
) {
  if (options.length === 0) return null;

  const targetDistance = purpose === 'closing' ? 190 : 175;
  const scored = options
    .map((option) => {
      const bearing = routeBearing(option.walkingRoute, option.origin);
      const turnDelta = previousBearing === null
        ? 0
        : Math.abs(signedAngle(bearing - previousBearing));
      const overlap = routeOverlapRatio(option.walkingRoute, previousRoutes);
      const distancePenalty = Math.abs(option.walkingRoute.distanceMeters - targetDistance);
      const uTurnPenalty = turnDelta > 125 ? 1000 : turnDelta > 100 ? 180 : 0;
      const repeatPenalty = overlap * 420;
      const shortPenalty = option.walkingRoute.distanceMeters < 85 ? 1200 : 0;
      return {
        option,
        score: distancePenalty + uTurnPenalty + repeatPenalty + shortPenalty,
      };
    })
    .sort((a, b) => a.score - b.score);

  return scored[0]?.option ?? null;
}
