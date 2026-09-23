export type RoutingPoint = {
  latitude: number;
  longitude: number;
};

export type RoutingCandidate<TEnvironment = string> = {
  point: RoutingPoint;
  name: string;
  stop: boolean;
  environment: TEnvironment;
};

function distance(a: RoutingPoint, b: RoutingPoint) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.latitude - a.latitude) * r) / 2) ** 2 +
    Math.cos(a.latitude * r) *
      Math.cos(b.latitude * r) *
      Math.sin(((b.longitude - a.longitude) * r) / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function bearing(a: RoutingPoint, b: RoutingPoint) {
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

/**
 * Pure candidate ranking for Pocket. Network routing still validates the
 * actual walkable path later; this function only orders nearby candidates.
 */
export function rankPocketPlaces<T extends RoutingCandidate>(
  places: T[],
  current: RoutingPoint,
  origin: RoutingPoint,
  trace: RoutingPoint[],
  closing: boolean,
  elapsed: number,
  random = Math.random,
) {
  const previous = trace.length > 2 ? trace[trace.length - 3] : undefined;
  const heading =
    previous && distance(previous, current) > 8
      ? bearing(previous, current)
      : undefined;

  return places
    .filter(
      (place) =>
        distance(current, place.point) > 45 &&
        distance(current, place.point) < (closing ? 400 : 650) &&
        (!closing || place.stop),
    )
    .map((place) => {
      const turn =
        heading === undefined
          ? 0
          : Math.abs(angle(bearing(current, place.point), heading));
      const repeated = trace
        .slice(0, -3)
        .some((tracePoint) => distance(tracePoint, place.point) < 35);
      const rubberBand = Math.max(
        0,
        distance(origin, place.point) - (elapsed > 300 ? 350 : 500),
      );
      return {
        place,
        score:
          (closing
            ? distance(current, place.point)
            : Math.abs(distance(current, place.point) - 150)) +
          (turn > 120 ? 600 : turn * 0.3) +
          (repeated ? 450 : 0) +
          rubberBand * 2 +
          random() * 40,
      };
    })
    .sort((a, b) => a.score - b.score)
    .map(({ place }) => place);
}

export function isImmediatePocketUTurn(
  previous: RoutingPoint | undefined,
  current: RoutingPoint,
  ahead: RoutingPoint | undefined,
) {
  if (
    !previous ||
    !ahead ||
    distance(previous, current) <= 8 ||
    distance(current, ahead) <= 8
  )
    return false;

  return (
    Math.abs(
      angle(
        bearing(current, ahead),
        bearing(previous, current),
      ),
    ) > 125
  );
}
