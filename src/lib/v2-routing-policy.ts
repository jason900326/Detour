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
