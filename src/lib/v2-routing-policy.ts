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

function signedAngle(value: number) {
  const normalized = ((value % 360) + 360) % 360;
  return normalized > 180 ? normalized - 360 : normalized;
}

export function rubberBandCorrectionDegrees(
  previousBearing: number,
  anchorBearing: number,
  maxCorrectionDegrees = 75
) {
  const correction = signedAngle(anchorBearing - previousBearing);
  return Math.max(
    -maxCorrectionDegrees,
    Math.min(maxCorrectionDegrees, correction)
  );
}

export function closingRouteTargetDistanceMeters(elapsedSeconds: number) {
  const secondsBeforeEightMinutes = Math.max(0, 8 * 60 - elapsedSeconds);
  const adaptiveDistance = 190 + secondsBeforeEightMinutes * 0.9;
  return Math.round(Math.max(190, Math.min(480, adaptiveDistance)));
}

export function isTrustedV2GpsAccuracy(accuracyMeters: number | null | undefined) {
  return (accuracyMeters ?? Number.POSITIVE_INFINITY) <= 60;
}

export function isSpatiallyConsistentOffRouteSample(args: {
  previous: { latitude: number; longitude: number } | null;
  current: { latitude: number; longitude: number };
  distanceMeters: (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => number;
  maxSeparationMeters?: number;
}) {
  if (!args.previous) return false;
  return (
    args.distanceMeters(args.previous, args.current) <=
    (args.maxSeparationMeters ?? 55)
  );
}

export function isUsableV2StartAccuracy(accuracyMeters: number | null | undefined) {
  return (accuracyMeters ?? Number.POSITIVE_INFINITY) <= 70;
}

export function isPlausibleV2MovementSample(args: {
  distanceMeters: number;
  elapsedSeconds: number;
  indoor?: boolean;
}) {
  if (args.indoor) return true;
  const elapsedSeconds = Math.max(0.25, args.elapsedSeconds);
  const generousWalkingLimit = 25 + elapsedSeconds * 8;
  return args.distanceMeters <= generousWalkingLimit;
}
