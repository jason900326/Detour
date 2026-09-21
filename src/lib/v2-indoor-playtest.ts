import type { GeoPoint } from './journey-engine';
import {
  bearingBetween,
  distanceBetween,
  moveToward,
  offsetPoint,
} from './navigation-engine';
import type { WalkingRoute } from './routing-engine';

export type IndoorRoutePurpose = 'exploration' | 'closing';

/**
 * The indoor harness never asks for GPS or a network route. This stable point
 * keeps the map useful while the tester can drive the whole Journey indoors.
 */
export const INDOOR_START_POINT: GeoPoint = {
  latitude: 25.033964,
  longitude: 121.564468,
};

function polylineDistance(points: GeoPoint[]) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distanceBetween(points[index - 1], points[index]);
  }
  return total;
}

function routePoints(
  origin: GeoPoint,
  purpose: IndoorRoutePurpose,
  seed: number,
  fixedDestination?: GeoPoint
) {
  if (fixedDestination) {
    const bearing = bearingBetween(origin, fixedDestination);
    const distance = distanceBetween(origin, fixedDestination);
    const bend = Math.max(35, Math.min(85, distance * 0.35));
    const middle = offsetPoint(
      origin,
      bend,
      bearing + (Math.floor(seed) % 2 === 0 ? 24 : -24)
    );
    return [origin, middle, fixedDestination];
  }

  const baseBearing = ((Math.floor(seed) * 47) % 360 + 360) % 360;
  const offsets =
    purpose === 'closing'
      ? [0, 34, -28]
      : [0, 18, -42, 24];
  const distances =
    purpose === 'closing'
      ? [62, 55, 72]
      : [55, 62, 48, 70];

  const points = [origin];
  let cursor = origin;

  for (let index = 0; index < distances.length; index += 1) {
    cursor = offsetPoint(
      cursor,
      distances[index],
      baseBearing + offsets[index] + index * 3
    );
    points.push(cursor);
  }

  return points;
}

export function createIndoorWalkingRoute(
  origin: GeoPoint,
  purpose: IndoorRoutePurpose,
  seed: number,
  fixedDestination?: GeoPoint
): WalkingRoute {
  const coordinates = routePoints(origin, purpose, seed, fixedDestination);
  const distanceMeters = polylineDistance(coordinates);

  return {
    coordinates,
    distanceMeters,
    durationSeconds: Math.max(30, Math.round(distanceMeters / 1.25)),
    quality: {
      turnCount: Math.max(1, coordinates.length - 2),
      unnamedDistanceRatio: 0,
      localShortcutRatio: 1,
    },
  };
}

export function indoorClosingDestination(
  origin: GeoPoint,
  seed: number,
  distanceMeters = 190
) {
  return offsetPoint(
    origin,
    Math.max(120, distanceMeters),
    ((Math.floor(seed) * 61) % 360 + 360) % 360
  );
}

export function pointAlongPolyline(
  coordinates: GeoPoint[],
  distanceMeters: number
) {
  if (coordinates.length === 0) return null;
  if (coordinates.length === 1 || distanceMeters <= 0) return coordinates[0];

  let remaining = distanceMeters;

  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1];
    const end = coordinates[index];
    const segmentDistance = distanceBetween(start, end);

    if (remaining <= segmentDistance) {
      return moveToward(start, end, remaining);
    }

    remaining -= segmentDistance;
  }

  return coordinates[coordinates.length - 1];
}

export function indoorDeviationPoint(
  origin: GeoPoint,
  routeBearing: number,
  distanceMeters = 100
) {
  return offsetPoint(origin, distanceMeters, routeBearing + 90);
}
