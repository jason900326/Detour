export type RerouteCheck = {
  thresholdMeters: number;
  nextOffRouteCount: number;
  shouldReroute: boolean;
};

/**
 * Pure policy for turning noisy GPS distance samples into a reroute request.
 * Network work and state mutation remain in the controller.
 */
export function evaluateReroute(args: {
  offRouteDistanceMeters: number;
  gpsAccuracyMeters: number;
  offRouteCount: number;
  rerouteInFlight: boolean;
}): RerouteCheck {
  const thresholdMeters = Math.max(
    45,
    Math.min(70, args.gpsAccuracyMeters + 30)
  );
  const nextOffRouteCount =
    args.offRouteDistanceMeters > thresholdMeters
      ? args.offRouteCount + 1
      : 0;

  return {
    thresholdMeters,
    nextOffRouteCount,
    shouldReroute: nextOffRouteCount >= 3 && !args.rerouteInFlight,
  };
}
