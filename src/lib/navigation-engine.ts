import type { GeoPoint } from './journey-engine';

export type NavigationTurn =
  | 'start'
  | 'continue'
  | 'slight-left'
  | 'slight-right'
  | 'left'
  | 'right'
  | 'arrive';

export type NavigationBeat = {
  id: string;
  point: GeoPoint;
  turn: NavigationTurn;
  bearingDegrees: number;
  segmentDistanceMeters: number;
  segmentCoordinates: GeoPoint[];
  instruction: string;
  hint: string;
  missionIndex?: number;
};

export type NavigationRoute = {
  coordinates: GeoPoint[];
  beats: NavigationBeat[];
  totalDistanceMeters: number;
  durationSeconds?: number;
  source: 'real' | 'prototype';
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

export function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

export function signedAngle(value: number) {
  const normalized = normalizeDegrees(value);
  return normalized > 180 ? normalized - 360 : normalized;
}

export function distanceBetween(a: GeoPoint, b: GeoPoint) {
  const radius = 6371000;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function bearingBetween(a: GeoPoint, b: GeoPoint) {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) *
      Math.cos(lat2) *
      Math.cos(dLon);

  return normalizeDegrees(
    toDegrees(Math.atan2(y, x))
  );
}

export function offsetPoint(
  point: GeoPoint,
  distanceMeters: number,
  bearingDegrees: number
): GeoPoint {
  const radius = 6371000;
  const angularDistance = distanceMeters / radius;
  const bearing = toRadians(bearingDegrees);
  const lat1 = toRadians(point.latitude);
  const lon1 = toRadians(point.longitude);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) *
        Math.sin(angularDistance) *
        Math.cos(bearing)
  );

  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) *
        Math.sin(angularDistance) *
        Math.cos(lat1),
      Math.cos(angularDistance) -
        Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    latitude: toDegrees(lat2),
    longitude: toDegrees(lon2),
  };
}

export function moveToward(
  from: GeoPoint,
  to: GeoPoint,
  distanceMeters: number
): GeoPoint {
  const total = distanceBetween(from, to);

  if (total <= distanceMeters || total < 0.5) {
    return to;
  }

  return offsetPoint(
    from,
    distanceMeters,
    bearingBetween(from, to)
  );
}

function polylineDistance(points: GeoPoint[]) {
  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    total += distanceBetween(
      points[index - 1],
      points[index]
    );
  }

  return total;
}

function turnFromDelta(delta: number): NavigationTurn {
  const angle = signedAngle(delta);

  if (angle >= 70) return 'right';
  if (angle >= 24) return 'slight-right';
  if (angle <= -70) return 'left';
  if (angle <= -24) return 'slight-left';

  return 'continue';
}

function copyForTurn(
  turn: NavigationTurn,
  isLast: boolean,
  isFirst: boolean
) {
  if (isLast) {
    return {
      instruction: '最後一小段。',
      hint: '抵達後，DETOUR 才會告訴你這裡是什麼。',
    };
  }

  if (isFirst) {
    return {
      instruction: '先走第一小段。',
      hint: '只看眼前這個方向。',
    };
  }

  if (turn === 'left') {
    return {
      instruction: '往左邊續走。',
      hint: '不用想終點，只處理下一小段。',
    };
  }

  if (turn === 'right') {
    return {
      instruction: '往右邊續走。',
      hint: '不用想終點，只處理下一小段。',
    };
  }

  if (turn === 'slight-left') {
    return {
      instruction: '往左前方續走。',
      hint: '走到下一個節點就好。',
    };
  }

  if (turn === 'slight-right') {
    return {
      instruction: '往右前方續走。',
      hint: '走到下一個節點就好。',
    };
  }

  return {
    instruction: '沿這個方向繼續。',
    hint: '走到下一個節點就好。',
  };
}

function buildMissionMap(
  beatCount: number,
  missionCount: number,
  missionIndexOffset = 0
) {
  const result = new Map<number, number>();

  if (missionCount <= 0) return result;

  for (
    let missionIndex = 0;
    missionIndex < missionCount;
    missionIndex += 1
  ) {
    const fraction =
      (missionIndex + 1) / (missionCount + 1);

    let beatIndex = Math.max(
      0,
      Math.min(
        beatCount - 2,
        Math.round(
          fraction * (beatCount - 1)
        ) - 1
      )
    );

    while (
      result.has(beatIndex) &&
      beatIndex < beatCount - 2
    ) {
      beatIndex += 1;
    }

    result.set(
      beatIndex,
      missionIndex + missionIndexOffset
    );
  }

  return result;
}

function splitPolyline(
  coordinates: GeoPoint[],
  targetSegmentMeters: number
) {
  if (coordinates.length < 2) {
    return [];
  }

  const segments: GeoPoint[][] = [];
  let currentSegment: GeoPoint[] = [
    coordinates[0],
  ];
  let accumulated = 0;

  for (
    let index = 1;
    index < coordinates.length;
    index += 1
  ) {
    let edgeStart =
      currentSegment[currentSegment.length - 1];
    const edgeEnd = coordinates[index];
    let edgeDistance = distanceBetween(
      edgeStart,
      edgeEnd
    );

    while (
      accumulated + edgeDistance >=
      targetSegmentMeters
    ) {
      const needed =
        targetSegmentMeters - accumulated;

      const splitPoint = moveToward(
        edgeStart,
        edgeEnd,
        needed
      );

      currentSegment.push(splitPoint);
      segments.push(currentSegment);

      currentSegment = [splitPoint];
      edgeStart = splitPoint;
      edgeDistance = distanceBetween(
        edgeStart,
        edgeEnd
      );
      accumulated = 0;

      if (edgeDistance < 0.5) break;
    }

    if (edgeDistance >= 0.5) {
      currentSegment.push(edgeEnd);
      accumulated += edgeDistance;
    }
  }

  if (currentSegment.length >= 2) {
    const finalDistance =
      polylineDistance(currentSegment);

    if (
      segments.length > 0 &&
      finalDistance < targetSegmentMeters * 0.38
    ) {
      const previous = segments.pop() ?? [];
      const merged = [
        ...previous,
        ...currentSegment.slice(1),
      ];
      segments.push(merged);
    } else {
      segments.push(currentSegment);
    }
  }

  return segments;
}

function firstUsefulBearing(points: GeoPoint[]) {
  for (let index = 1; index < points.length; index += 1) {
    const distance = distanceBetween(
      points[0],
      points[index]
    );

    if (distance >= 4) {
      return bearingBetween(
        points[0],
        points[index]
      );
    }
  }

  return points.length >= 2
    ? bearingBetween(
        points[0],
        points[points.length - 1]
      )
    : 0;
}

export function buildNavigationRouteFromPolyline(args: {
  coordinates: GeoPoint[];
  totalDistanceMeters: number;
  durationSeconds?: number;
  sideMissionCount: number;
  missionIndexOffset?: number;
}): NavigationRoute {
  const minimumBeatCount =
    args.sideMissionCount + 3;

  const distanceBeatCount = Math.max(
    5,
    Math.ceil(
      args.totalDistanceMeters / 58
    )
  );

  const desiredBeatCount = Math.min(
    15,
    Math.max(
      minimumBeatCount,
      distanceBeatCount
    )
  );

  const targetSegmentMeters = Math.max(
    32,
    Math.min(
      78,
      args.totalDistanceMeters /
        desiredBeatCount
    )
  );

  let segments = splitPolyline(
    args.coordinates,
    targetSegmentMeters
  );

  // Ensure there are enough hooks for missions.
  if (
    segments.length <
    minimumBeatCount
  ) {
    segments = splitPolyline(
      args.coordinates,
      Math.max(
        24,
        args.totalDistanceMeters /
          minimumBeatCount
      )
    );
  }

  const missionMap = buildMissionMap(
    segments.length,
    args.sideMissionCount,
    args.missionIndexOffset ?? 0
  );

  const beats: NavigationBeat[] = [];
  let previousBearing: number | null = null;

  segments.forEach((segment, index) => {
    const isLast =
      index === segments.length - 1;
    const bearing =
      firstUsefulBearing(segment);

    const turn =
      index === 0
        ? 'start'
        : isLast
          ? 'arrive'
          : turnFromDelta(
              bearing -
                (previousBearing ?? bearing)
            );

    const copy = copyForTurn(
      turn,
      isLast,
      index === 0
    );

    beats.push({
      id: `beat-${index + 1}`,
      point: segment[segment.length - 1],
      turn,
      bearingDegrees: bearing,
      segmentDistanceMeters:
        polylineDistance(segment),
      segmentCoordinates: segment,
      instruction: copy.instruction,
      hint: copy.hint,
      missionIndex: missionMap.get(index),
    });

    previousBearing = bearing;
  });

  return {
    coordinates: args.coordinates,
    beats,
    totalDistanceMeters:
      args.totalDistanceMeters,
    durationSeconds: args.durationSeconds,
    source: 'real',
  };
}

type SegmentProjection = {
  distanceMeters: number;
  t: number;
  point: GeoPoint;
};

function projectPointToSegment(
  point: GeoPoint,
  start: GeoPoint,
  end: GeoPoint
): SegmentProjection {
  const radius = 6371000;
  const originLat = toRadians(point.latitude);

  const toXY = (value: GeoPoint) => ({
    x:
      toRadians(value.longitude - point.longitude) *
      Math.cos(originLat) *
      radius,
    y:
      toRadians(value.latitude - point.latitude) *
      radius,
  });

  const a = toXY(start);
  const b = toXY(end);
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const lengthSquared =
    abX * abX + abY * abY;

  const rawT =
    lengthSquared <= 0.0001
      ? 0
      : -(
          a.x * abX +
          a.y * abY
        ) / lengthSquared;

  const t = Math.max(
    0,
    Math.min(1, rawT)
  );

  const projectedX =
    a.x + abX * t;
  const projectedY =
    a.y + abY * t;

  const projectedPoint: GeoPoint = {
    latitude:
      point.latitude +
      toDegrees(projectedY / radius),
    longitude:
      point.longitude +
      toDegrees(
        projectedX /
          (radius * Math.cos(originLat))
      ),
  };

  return {
    distanceMeters: Math.hypot(
      projectedX,
      projectedY
    ),
    t,
    point: projectedPoint,
  };
}

function closestPolylinePosition(
  point: GeoPoint,
  coordinates: GeoPoint[]
) {
  if (coordinates.length < 2) {
    return {
      segmentIndex: 0,
      projection: {
        distanceMeters: Infinity,
        t: 0,
        point:
          coordinates[0] ?? point,
      } satisfies SegmentProjection,
    };
  }

  let bestIndex = 0;
  let best = projectPointToSegment(
    point,
    coordinates[0],
    coordinates[1]
  );

  for (
    let index = 1;
    index < coordinates.length - 1;
    index += 1
  ) {
    const projection =
      projectPointToSegment(
        point,
        coordinates[index],
        coordinates[index + 1]
      );

    if (
      projection.distanceMeters <
      best.distanceMeters
    ) {
      best = projection;
      bestIndex = index;
    }
  }

  return {
    segmentIndex: bestIndex,
    projection: best,
  };
}

export function distanceToPolyline(
  point: GeoPoint,
  coordinates: GeoPoint[]
) {
  return closestPolylinePosition(
    point,
    coordinates
  ).projection.distanceMeters;
}

export function remainingDistanceOnPolyline(
  point: GeoPoint,
  coordinates: GeoPoint[]
) {
  if (coordinates.length < 2) return 0;

  const closest =
    closestPolylinePosition(
      point,
      coordinates
    );

  let total = distanceBetween(
    closest.projection.point,
    coordinates[
      closest.segmentIndex + 1
    ]
  );

  for (
    let index =
      closest.segmentIndex + 2;
    index < coordinates.length;
    index += 1
  ) {
    total += distanceBetween(
      coordinates[index - 1],
      coordinates[index]
    );
  }

  return total;
}

export function guidanceBearingOnPolyline(
  point: GeoPoint,
  coordinates: GeoPoint[],
  lookAheadMeters = 18
) {
  if (coordinates.length < 2) {
    return 0;
  }

  const closest =
    closestPolylinePosition(
      point,
      coordinates
    );

  let cursor =
    closest.projection.point;
  let remainingLookAhead =
    lookAheadMeters;

  for (
    let index =
      closest.segmentIndex + 1;
    index < coordinates.length;
    index += 1
  ) {
    const target =
      coordinates[index];

    const distance =
      distanceBetween(
        cursor,
        target
      );

    if (
      distance >=
      remainingLookAhead
    ) {
      const lookAheadPoint =
        moveToward(
          cursor,
          target,
          remainingLookAhead
        );

      return bearingBetween(
        point,
        lookAheadPoint
      );
    }

    remainingLookAhead -= distance;
    cursor = target;
  }

  return bearingBetween(
    point,
    coordinates[
      coordinates.length - 1
    ]
  );
}

export function relativeArrowDegrees(
  routeBearingDegrees: number,
  deviceHeadingDegrees: number
) {
  return signedAngle(
    routeBearingDegrees -
      deviceHeadingDegrees
  );
}

// Kept only as a development fallback utility.
export function buildPrototypeNavigationRoute(args: {
  start: GeoPoint;
  totalDistanceMeters: number;
  sideMissionCount: number;
  seed?: number;
}): NavigationRoute {
  const points: GeoPoint[] = [args.start];
  let cursor = args.start;
  const count = Math.max(
    args.sideMissionCount + 3,
    6
  );

  for (let index = 0; index < count; index += 1) {
    cursor = offsetPoint(
      cursor,
      args.totalDistanceMeters / count,
      (args.seed ?? 20) + index * 28
    );
    points.push(cursor);
  }

  return buildNavigationRouteFromPolyline({
    coordinates: points,
    totalDistanceMeters:
      args.totalDistanceMeters,
    sideMissionCount:
      args.sideMissionCount,
  });
}
