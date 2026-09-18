import type { GeoPoint } from './journey-engine';

export type MovementSample = {
  movedMeters: number;
  sampleSeconds: number;
};

/**
 * Applies the GPS jitter guard used by the live trace. Keeping this policy
 * pure makes it testable without mounting the location watcher or mocking
 * Expo Location.
 */
export function measureMovementSample(args: {
  previous: GeoPoint;
  next: GeoPoint;
  previousSampleAt: number | null;
  sampleAt: number;
  distanceMeters: (from: GeoPoint, to: GeoPoint) => number;
}): MovementSample | null {
  const movedMeters = args.distanceMeters(args.previous, args.next);
  if (movedMeters < 4 || movedMeters > 80) return null;

  const sampleSeconds =
    args.previousSampleAt === null
      ? 0
      : Math.max(
          0,
          Math.min(10, (args.sampleAt - args.previousSampleAt) / 1000)
        );

  return { movedMeters, sampleSeconds };
}
