import type { GeoPoint, LightContext } from './journey-engine';
import type { SceneCandidate } from './scene-engine';

export type WalkingRoute = {
  coordinates: GeoPoint[];
  distanceMeters: number;
  durationSeconds: number;
  quality: RouteQualitySignals;
};

export type RouteQualitySignals = {
  turnCount: number;
  unnamedDistanceRatio: number;
  localShortcutRatio: number;
};

export type RoutedScene = {
  scene: SceneCandidate;
  route: WalkingRoute;
};

type OsrmRoute = {
  distance: number;
  duration: number;
  geometry?: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  legs?: Array<{
    steps?: Array<{
      distance?: number;
      name?: string;
      maneuver?: {
        type?: string;
        modifier?: string;
      };
    }>;
  }>;
};

type OsrmResponse = {
  code?: string;
  routes?: OsrmRoute[];
  waypoints?: Array<{
    distance?: number;
  }>;
};

type RouteRequestPurpose = 'prewarm' | 'interactive';

type InFlightWalkingRoute = {
  promise: Promise<WalkingRoute>;
  purpose: RouteRequestPurpose;
  startedAt: number;
};

const FOOT_ROUTER =
  'https://routing.openstreetmap.de/routed-foot/route/v1/driving';

let lastRoutingRequestAt = 0;
const WALKING_ROUTE_CACHE_TTL = 5 * 60 * 1000;
const ROUTE_REQUEST_SPACING_MS = 1100;
const PREWARM_ROUTE_TIMEOUT_MS = 2600;
const PREWARM_TICKET_GRACE_MS = 200;
const TICKET_ROUTING_BUDGET_MS = 3600;
const TICKET_ROUTE_TIMEOUT_MS = 2200;
const MAX_TICKET_NETWORK_ATTEMPTS = 2;
const ROUTE_REPEAT_MATCH_METERS = 18;
const ROUTE_REPEAT_START_IGNORE_METERS = 55;
const ROUTE_OVERLAP_PREFERRED_MAX = 0.12;
const ROUTE_OVERLAP_FALLBACK_MAX = 0.22;
const ROUTE_OVERLAP_EMERGENCY_MAX = 0.42;
const ROUTE_DIRECTNESS_PREFERRED_MAX = 1.85;
const ROUTE_DIRECTNESS_FALLBACK_MAX = 2.2;
const ROUTE_DIRECTNESS_EMERGENCY_MAX = 2.7;
const LOCAL_SHORTCUT_PREFERRED_MAX = 1.38;
const LOCAL_SHORTCUT_FALLBACK_MAX = 1.58;
const LOCAL_SHORTCUT_EMERGENCY_MAX = 1.82;
const NIGHT_ALTERNATIVE_DISTANCE_MAX = 1.1;
const NIGHT_ALTERNATIVE_DURATION_MAX = 1.12;

const walkingRouteCache = new Map<
  string,
  { expiresAt: number; route: WalkingRoute }
>();
const walkingRouteInFlight = new Map<string, InFlightWalkingRoute>();

function walkingRouteCacheKey(
  start: GeoPoint,
  destination: GeoPoint,
  context: LightContext = 'day'
) {
  const round = (value: number) => value.toFixed(5);
  const profile = context === 'night' ? 'night' : 'day';
  return `${profile}:${round(start.latitude)},${round(start.longitude)}>${round(destination.latitude)},${round(destination.longitude)}`;
}

function getCachedWalkingRoute(
  start: GeoPoint,
  destination: GeoPoint,
  context: LightContext = 'day'
): WalkingRoute | null {
  const cacheKey = walkingRouteCacheKey(start, destination, context);
  const cached = walkingRouteCache.get(cacheKey);

  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    walkingRouteCache.delete(cacheKey);
    return null;
  }

  return cached.route;
}

function getInFlightWalkingRoute(
  start: GeoPoint,
  destination: GeoPoint,
  context: LightContext = 'day'
) {
  return walkingRouteInFlight.get(
    walkingRouteCacheKey(start, destination, context)
  ) ?? null;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitForInFlightWalkingRoute(
  start: GeoPoint,
  destination: GeoPoint,
  waitMs: number,
  context: LightContext = 'day'
): Promise<WalkingRoute | null> {
  const inFlight = getInFlightWalkingRoute(start, destination, context);
  if (!inFlight || waitMs <= 0) return null;

  return await new Promise<WalkingRoute | null>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (route: WalkingRoute | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(route);
    };

    timer = setTimeout(
      () => finish(null),
      waitMs
    );

    void inFlight.promise
      .then((route) => finish(route))
      .catch(() => finish(null));
  });
}

async function throttleRouter(deadlineAt?: number) {
  const elapsed = Date.now() - lastRoutingRequestAt;
  const waitFor = Math.max(0, ROUTE_REQUEST_SPACING_MS - elapsed);

  if (
    deadlineAt !== undefined &&
    Date.now() + waitFor >= deadlineAt
  ) {
    throw new Error('Routing deadline reached before request');
  }

  if (waitFor > 0) await wait(waitFor);
  lastRoutingRequestAt = Date.now();
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Detects a locally dominated dog-leg: a short section whose walked shape is
 * much longer than the chord between the same two points. This is deliberately
 * local (roughly one to four city blocks), so a sensible trip-level arc is not
 * mistaken for the kind of visible triangle shortcut that makes navigation
 * feel broken.
 */
export function measureLocalShortcutRatio(coordinates: GeoPoint[]) {
  if (coordinates.length < 3) return 1;

  const cumulative = [0];
  for (let index = 1; index < coordinates.length; index += 1) {
    cumulative.push(
      cumulative[index - 1] +
        distanceBetweenPoints(coordinates[index - 1], coordinates[index])
    );
  }

  const stride = Math.max(1, Math.floor((coordinates.length - 1) / 72));
  let worst = 1;

  for (let start = 0; start < coordinates.length - 2; start += stride) {
    for (let end = start + 2; end < coordinates.length; end += stride) {
      const walked = cumulative[end] - cumulative[start];
      if (walked < 120) continue;
      if (walked > 460) break;

      const direct = distanceBetweenPoints(
        coordinates[start],
        coordinates[end]
      );
      if (direct < 80) continue;

      worst = Math.max(worst, walked / direct);
    }
  }

  return worst;
}

function routeQualitySignals(route: OsrmRoute, coordinates: GeoPoint[]) {
  const steps = route.legs?.flatMap((leg) => leg.steps ?? []) ?? [];
  const stepDistance = steps.reduce(
    (sum, step) => sum + Math.max(0, step.distance ?? 0),
    0
  );
  const unnamedDistance = steps.reduce(
    (sum, step) =>
      String(step.name ?? '').trim()
        ? sum
        : sum + Math.max(0, step.distance ?? 0),
    0
  );
  const turnCount = steps.filter((step) => {
    const type = step.maneuver?.type ?? '';
    const modifier = step.maneuver?.modifier ?? '';
    if (['depart', 'arrive', 'notification'].includes(type)) return false;
    if (type === 'continue' && (!modifier || modifier === 'straight')) {
      return false;
    }
    return true;
  }).length;

  return {
    turnCount,
    // A missing steps payload is unknown, not proof of a dark/unnamed route.
    unnamedDistanceRatio:
      stepDistance > 0 ? unnamedDistance / stepDistance : 0.45,
    localShortcutRatio: measureLocalShortcutRatio(coordinates),
  } satisfies RouteQualitySignals;
}

function normalizeOsrmRoute(route: OsrmRoute): WalkingRoute | null {
  if (!route.geometry?.coordinates?.length) return null;

  const coordinates = route.geometry.coordinates.map(
    ([longitude, latitude]) => ({ latitude, longitude })
  );

  return {
    coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    quality: routeQualitySignals(route, coordinates),
  };
}

export function chooseWalkingRouteForContext(
  routes: WalkingRoute[],
  context: LightContext
) {
  if (routes.length === 0) return null;

  const byDuration = [...routes].sort(
    (a, b) => a.durationSeconds - b.durationSeconds
  );
  if (context !== 'night') return byDuration[0];

  const shortest = byDuration[0];
  const eligible = byDuration.filter(
    (route) =>
      route.distanceMeters <=
        shortest.distanceMeters * NIGHT_ALTERNATIVE_DISTANCE_MAX &&
      route.durationSeconds <=
        shortest.durationSeconds * NIGHT_ALTERNATIVE_DURATION_MAX
  );

  return eligible.sort((a, b) => {
    const score = (route: WalkingRoute) => {
      const distanceOverhead =
        route.distanceMeters / Math.max(1, shortest.distanceMeters) - 1;
      const turnDensity =
        route.quality.turnCount /
        Math.max(0.4, route.distanceMeters / 1000);

      return (
        route.quality.unnamedDistanceRatio * 620 +
        turnDensity * 11 +
        Math.max(0, route.quality.localShortcutRatio - 1.2) * 360 +
        Math.max(0, distanceOverhead) * 900
      );
    };

    return score(a) - score(b);
  })[0];
}

export async function fetchWalkingRoute(
  start: GeoPoint,
  destination: GeoPoint,
  timeoutMs = 12000,
  options?: {
    purpose?: RouteRequestPurpose;
    deadlineAt?: number;
    context?: LightContext;
  }
): Promise<WalkingRoute> {
  const context = options?.context ?? 'day';
  const cacheKey = walkingRouteCacheKey(start, destination, context);
  const cached = getCachedWalkingRoute(start, destination, context);
  if (cached) return cached;

  // Normal callers still share identical work. Ticket selection itself avoids
  // awaiting a prewarm request by checking in-flight state before calling here.
  const inFlight = walkingRouteInFlight.get(cacheKey);
  if (inFlight) return inFlight.promise;

  const purpose = options?.purpose ?? 'interactive';
  let request!: Promise<WalkingRoute>;

  request = (async () => {
    await throttleRouter(options?.deadlineAt);

    const deadlineRemaining =
      options?.deadlineAt === undefined
        ? timeoutMs
        : options.deadlineAt - Date.now();
    const effectiveTimeout = Math.min(
      timeoutMs,
      deadlineRemaining
    );

    if (effectiveTimeout < 300) {
      throw new Error('Routing deadline reached before fetch');
    }

    const coordinates = [
      `${start.longitude},${start.latitude}`,
      `${destination.longitude},${destination.latitude}`,
    ].join(';');

    const url =
      `${FOOT_ROUTER}/${coordinates}` +
      `?overview=full&geometries=geojson&steps=true&alternatives=${
        context === 'night' ? '2' : 'false'
      }`;
    const response = await fetchWithTimeout(url, effectiveTimeout);

    if (!response.ok) throw new Error(`Walking router ${response.status}`);

    const data = (await response.json()) as OsrmResponse;
    const routes = (data.routes ?? [])
      .map(normalizeOsrmRoute)
      .filter((route): route is WalkingRoute => route !== null);
    const route = chooseWalkingRouteForContext(routes, context);

    if (data.code !== 'Ok' || !route) {
      throw new Error('No walking route');
    }

    walkingRouteCache.set(cacheKey, {
      expiresAt: Date.now() + WALKING_ROUTE_CACHE_TTL,
      route,
    });

    return route;
  })().finally(() => {
    const current = walkingRouteInFlight.get(cacheKey);
    if (current?.promise === request) {
      walkingRouteInFlight.delete(cacheKey);
    }
  });

  walkingRouteInFlight.set(cacheKey, {
    promise: request,
    purpose,
    startedAt: Date.now(),
  });

  return request;
}

export type SlowWalkingRoute = {
  route: WalkingRoute;
  directRoute: WalkingRoute;
  extended: boolean;
};

function slowRouteTargetSeconds(
  minutes: number,
  sideMissionCount: number
) {
  const arrivalSeconds = minutes <= 15 ? 90 : 120;
  return Math.max(
    60,
    (minutes * 60 * 0.96 - sideMissionCount * 75 - arrivalSeconds) / 1.18
  );
}

export function buildSlowRouteArcWaypoints(
  start: GeoPoint,
  destination: GeoPoint,
  targetDistanceMeters: number,
  side: -1 | 1
) {
  const midpointLatitude = (start.latitude + destination.latitude) / 2;
  const latitudeMeters = 111320;
  const longitudeMeters =
    Math.cos((midpointLatitude * Math.PI) / 180) * latitudeMeters;
  const dx = (destination.longitude - start.longitude) * longitudeMeters;
  const dy = (destination.latitude - start.latitude) * latitudeMeters;
  const direct = Math.max(1, Math.hypot(dx, dy));
  const third = direct / 3;
  const requested = Math.max(direct * 1.08, targetDistanceMeters);
  const halfBentLength = Math.max(third, (requested - third) / 2);
  const solvedOffset = Math.sqrt(
    Math.max(0, halfBentLength ** 2 - third ** 2)
  );
  const offset = Math.min(solvedOffset, direct * 0.7, 900);
  const normalX = (-dy / direct) * offset * side;
  const normalY = (dx / direct) * offset * side;

  const pointAt = (fraction: number): GeoPoint => ({
    latitude:
      start.latitude + (dy * fraction + normalY) / latitudeMeters,
    longitude:
      start.longitude + (dx * fraction + normalX) / longitudeMeters,
  });

  return [pointAt(1 / 3), pointAt(2 / 3)];
}

export function measureRouteSelfOverlapRatio(coordinates: GeoPoint[]) {
  if (coordinates.length < 8) return 0;

  const cumulative = [0];
  for (let index = 1; index < coordinates.length; index += 1) {
    cumulative.push(
      cumulative[index - 1] +
        distanceBetweenPoints(coordinates[index - 1], coordinates[index])
    );
  }

  const stride = Math.max(1, Math.floor(coordinates.length / 72));
  let checked = 0;
  let repeated = 0;

  for (let index = stride; index < coordinates.length; index += stride) {
    checked += 1;
    const currentProgress = cumulative[index];

    for (let previous = 0; previous < index; previous += stride) {
      if (currentProgress - cumulative[previous] < 150) continue;
      if (
        distanceBetweenPoints(coordinates[index], coordinates[previous]) <=
        ROUTE_REPEAT_MATCH_METERS
      ) {
        repeated += 1;
        break;
      }
    }
  }

  return checked > 0 ? repeated / checked : 0;
}

function slowRouteScore(
  route: WalkingRoute,
  targetSeconds: number,
  context: LightContext
) {
  const selfOverlap = measureRouteSelfOverlapRatio(route.coordinates);
  const localShortcut = route.quality.localShortcutRatio;
  const nightPenalty =
    context === 'night'
      ? route.quality.unnamedDistanceRatio * 700 +
        route.quality.turnCount * 9
      : 0;

  return (
    Math.abs(route.durationSeconds - targetSeconds) +
    selfOverlap * 1800 +
    Math.max(0, localShortcut - 1.24) * 900 +
    nightPenalty
  );
}

export function chooseSlowWalkingRoute(args: {
  directRoute: WalkingRoute;
  candidates: WalkingRoute[];
  targetSeconds: number;
  maximumSeconds: number;
  context: LightContext;
}) {
  const qualified = args.candidates.filter((route) => {
    const selfOverlap = measureRouteSelfOverlapRatio(route.coordinates);
    const shortcutLimit = args.context === 'night' ? 1.45 : 1.58;

    return (
      route.durationSeconds >= args.directRoute.durationSeconds * 1.08 &&
      route.durationSeconds <= args.maximumSeconds &&
      selfOverlap <= 0.08 &&
      route.quality.localShortcutRatio <= shortcutLimit
    );
  });

  if (qualified.length === 0) return args.directRoute;

  return [...qualified].sort(
    (a, b) =>
      slowRouteScore(a, args.targetSeconds, args.context) -
      slowRouteScore(b, args.targetSeconds, args.context)
  )[0];
}

async function fetchWalkingRouteThrough(
  points: GeoPoint[],
  timeoutMs: number,
  context: LightContext
) {
  await throttleRouter();

  const coordinates = points
    .map((point) => `${point.longitude},${point.latitude}`)
    .join(';');
  const url =
    `${FOOT_ROUTER}/${coordinates}` +
    '?overview=full&geometries=geojson&steps=true&alternatives=false&continue_straight=true';
  const response = await fetchWithTimeout(url, timeoutMs);

  if (!response.ok) throw new Error(`Walking router ${response.status}`);

  const data = (await response.json()) as OsrmResponse;
  const route = data.routes?.[0]
    ? normalizeOsrmRoute(data.routes[0])
    : null;
  const middleWaypoints = (data.waypoints ?? []).slice(1, -1);
  const snappedTooFar = middleWaypoints.some(
    (waypoint) => (waypoint.distance ?? Number.POSITIVE_INFINITY) > 100
  );

  if (data.code !== 'Ok' || !route || snappedTooFar) {
    throw new Error('No natural walking arc');
  }

  if (context === 'night' && route.quality.unnamedDistanceRatio > 0.82) {
    throw new Error('Night arc is not legible enough');
  }

  return route;
}

export async function resolveSlowWalkingRoute(args: {
  start: GeoPoint;
  destination: GeoPoint;
  minutes: number;
  sideMissionCount: number;
  context?: LightContext;
  avoidRoutes?: GeoPoint[][];
}): Promise<SlowWalkingRoute> {
  const context = args.context ?? 'day';
  const directRoute = await fetchWalkingRoute(
    args.start,
    args.destination,
    5000,
    { purpose: 'interactive', context }
  );
  const targetSeconds = slowRouteTargetSeconds(
    args.minutes,
    args.sideMissionCount
  );

  if (directRoute.durationSeconds > targetSeconds * 1.12) {
    const directMinutes = Math.ceil(
      estimatedJourneySeconds(
        directRoute,
        args.sideMissionCount,
        args.minutes
      ) / 60
    );
    throw new Error(
      `最快也大約需要 ${directMinutes} 分鐘，請把時間調長一點。`
    );
  }

  if (
    targetSeconds <= directRoute.durationSeconds * 1.12 ||
    directRoute.distanceMeters < 180
  ) {
    return { route: directRoute, directRoute, extended: false };
  }

  const paceMetersPerSecond =
    directRoute.distanceMeters / Math.max(60, directRoute.durationSeconds);
  const targetDistance = Math.min(
    directRoute.distanceMeters * 2.2,
    targetSeconds * paceMetersPerSecond
  );
  const candidates: WalkingRoute[] = [];

  for (const side of [-1, 1] as const) {
    const waypoints = buildSlowRouteArcWaypoints(
      args.start,
      args.destination,
      targetDistance,
      side
    );

    try {
      candidates.push(
        await fetchWalkingRouteThrough(
          [args.start, ...waypoints, args.destination],
          3200,
          context
        )
      );
    } catch {
      // One side may be a river, rail yard, private block or simply lack a
      // natural road arc. The other side and the direct route remain valid.
    }
  }

  const route = chooseSlowWalkingRoute({
    directRoute,
    candidates: candidates.filter(
      (candidate) =>
        routeOverlapRatio(
          candidate.coordinates,
          args.avoidRoutes ?? []
        ) <= ROUTE_OVERLAP_FALLBACK_MAX
    ),
    targetSeconds,
    maximumSeconds: targetSeconds * 1.1,
    context,
  });

  return {
    route,
    directRoute,
    extended: route !== directRoute,
  };
}

function targetDistance(minutes: number) {
  const safeMinutes = Math.max(5, Math.min(90, Math.round(minutes / 5) * 5));

  if (safeMinutes <= 5) return 220;
  if (safeMinutes <= 10) return 420;
  if (safeMinutes <= 15) return 680;
  if (safeMinutes <= 30) return Math.round(680 + (safeMinutes - 15) * 28);
  if (safeMinutes <= 45) return Math.round(1100 + (safeMinutes - 30) * 22);
  if (safeMinutes <= 60) return Math.round(1430 + (safeMinutes - 45) * 18);

  // Long Detours reserve more of the time budget for finding and taking
  // photos instead of stretching the destination proportionally farther.
  return Math.round(1700 + (safeMinutes - 60) * (400 / 30));
}

function routeDistanceProfile(minutes: number, distanceScale = 1) {
  const target = targetDistance(minutes) * distanceScale;

  return {
    target,
    min: Math.max(120, target * 0.68),
    max: target * 1.28,
  };
}

function routingShortlist(
  candidates: SceneCandidate[],
  minutes: number,
  distanceScale: number,
  limit: number
) {
  const straightTarget = targetDistance(minutes) * distanceScale * 0.74;

  return candidates
    .slice(0, 18)
    .sort(
      (a, b) =>
        Math.abs(a.straightDistanceMeters - straightTarget) -
        Math.abs(b.straightDistanceMeters - straightTarget)
    )
    .slice(0, Math.max(0, limit));
}

export async function prewarmWalkingRoutes(
  start: GeoPoint,
  candidates: SceneCandidate[],
  limit = 1,
  minutes = 15,
  distanceScale = 1,
  context: LightContext = 'day'
) {
  const startedAt = Date.now();

  // Warm only the most likely winner. A second speculative OSRM request has
  // not earned its latency/throttle cost yet and must never compete with Go.
  const likely = routingShortlist(
    candidates,
    minutes,
    distanceScale,
    Math.min(1, Math.max(0, limit))
  );

  if (likely.length === 0) {
    console.log('[DETOUR PREWARM] no route candidate to warm');
    return;
  }

  const scene = likely[0];

  if (getCachedWalkingRoute(start, scene.point, context)) {
    console.log(
      `[DETOUR PREWARM] cache already ready in ${Date.now() - startedAt}ms`
    );
    return;
  }

  try {
    await fetchWalkingRoute(
      start,
      scene.point,
      PREWARM_ROUTE_TIMEOUT_MS,
      { purpose: 'prewarm', context }
    );

    console.log(
      `[DETOUR PREWARM] top route ready in ${Date.now() - startedAt}ms`
    );
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : 'unknown';

    console.log(
      `[DETOUR PREWARM] top route missed in ${Date.now() - startedAt}ms: ${reason}`
    );
  }
}

function distanceBetweenPoints(a: GeoPoint, b: GeoPoint) {
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

function routeAfterInitialMeters(route: GeoPoint[], ignoreMeters: number) {
  if (route.length < 2 || ignoreMeters <= 0) return route;

  let walked = 0;
  for (let index = 1; index < route.length; index += 1) {
    walked += distanceBetweenPoints(route[index - 1], route[index]);
    if (walked >= ignoreMeters) {
      return route.slice(index);
    }
  }

  return route.slice(-1);
}

function routeOverlapRatio(route: GeoPoint[], avoidRoutes: GeoPoint[][]) {
  if (route.length < 4 || avoidRoutes.length === 0) return 0;

  // The first few metres out of the user's current position are often
  // unavoidable. Ignore a fixed walking distance, not a percentage of points,
  // then treat actual same-street reuse as expensive.
  const usable = routeAfterInitialMeters(
    route,
    ROUTE_REPEAT_START_IGNORE_METERS
  );
  const step = Math.max(1, Math.floor(usable.length / 24));
  const samples = usable
    .filter((_, index) => index % step === 0)
    .slice(0, 28);
  if (samples.length === 0) return 0;

  const historical = avoidRoutes
    .filter((item) => item.length >= 2)
    .slice(0, 6)
    .flatMap((item) => {
      const historyStep = Math.max(1, Math.floor(item.length / 110));
      return item.filter((_, index) => index % historyStep === 0);
    });

  if (historical.length === 0) return 0;

  let overlapping = 0;
  for (const point of samples) {
    if (
      historical.some(
        (oldPoint) =>
          distanceBetweenPoints(point, oldPoint) <= ROUTE_REPEAT_MATCH_METERS
      )
    ) {
      overlapping += 1;
    }
  }

  return overlapping / samples.length;
}

function estimatedJourneySeconds(
  route: WalkingRoute,
  sideMissionCount: number,
  minutes: number
) {
  // OSRM is optimistic in cities. Add crossings / hesitation, then reserve a
  // compact amount of time for each camera find and the final reveal.
  const cityWalking = route.durationSeconds * 1.18;
  const findAndPhoto = sideMissionCount * 75;
  const arrival = minutes <= 15 ? 90 : 120;
  return cityWalking + findAndPhoto + arrival;
}

type RouteAssessment = {
  score: number;
  preferred: boolean;
  fallback: boolean;
  emergency: boolean;
  overlapRatio: number;
  directnessRatio: number;
  localShortcutRatio: number;
};

function assessRoute(args: {
  route: WalkingRoute;
  profile: ReturnType<typeof routeDistanceProfile>;
  maxDistance: number;
  timeBudgetSeconds: number;
  sideMissionCount: number;
  minutes: number;
  avoidRoutes: GeoPoint[][];
  straightDistanceMeters: number;
  context: LightContext;
}): RouteAssessment {
  const overlap = routeOverlapRatio(args.route.coordinates, args.avoidRoutes);
  const estimatedSeconds = estimatedJourneySeconds(
    args.route,
    args.sideMissionCount,
    args.minutes
  );
  const overtimeSeconds = Math.max(0, estimatedSeconds - args.timeBudgetSeconds);
  const targetJourneySeconds = args.timeBudgetSeconds * 0.96;
  const timeDeltaSeconds = Math.abs(estimatedSeconds - targetJourneySeconds);
  const distanceDelta = Math.abs(args.route.distanceMeters - args.profile.target);
  const directnessRatio =
    args.route.distanceMeters / Math.max(80, args.straightDistanceMeters);

  // Detour should come from the destination, not from deliberately inefficient
  // routing. OSRM supplies the shortest foot leg; if that leg substantially
  // repeats recent walking or is very circuitous, prefer another Scene.
  const noveltyPenalty = overlap * args.profile.target * 2.4;
  const circuitPenalty =
    Math.max(0, directnessRatio - 1.45) * args.profile.target * 0.9;
  const overtimePenalty = overtimeSeconds * 1.4;
  const timeFitPenalty = timeDeltaSeconds * 0.55;
  const localShortcutRatio = args.route.quality.localShortcutRatio;
  const localShortcutPenalty =
    Math.max(0, localShortcutRatio - 1.22) * args.profile.target * 1.25;
  const nightLegibilityPenalty =
    args.context === 'night'
      ? (
          args.route.quality.unnamedDistanceRatio * args.profile.target * 0.7 +
          args.route.quality.turnCount * 16
        )
      : 0;
  const score =
    distanceDelta * 0.55 +
    timeFitPenalty +
    noveltyPenalty +
    circuitPenalty +
    overtimePenalty +
    localShortcutPenalty +
    nightLegibilityPenalty;

  const distanceFits =
    args.route.distanceMeters >= args.profile.min &&
    args.route.distanceMeters <= args.maxDistance;
  const minimumJourneySeconds = args.timeBudgetSeconds * 0.82;
  const preferredShortcutLimit =
    args.context === 'night'
      ? Math.min(LOCAL_SHORTCUT_PREFERRED_MAX, 1.34)
      : LOCAL_SHORTCUT_PREFERRED_MAX;

  return {
    score,
    preferred:
      distanceFits &&
      estimatedSeconds >= minimumJourneySeconds &&
      estimatedSeconds <= args.timeBudgetSeconds * 1.1 &&
      overlap <= ROUTE_OVERLAP_PREFERRED_MAX &&
      directnessRatio <= ROUTE_DIRECTNESS_PREFERRED_MAX &&
      localShortcutRatio <= preferredShortcutLimit,
    fallback:
      args.route.distanceMeters >= 70 &&
      estimatedSeconds <= args.timeBudgetSeconds * 1.12 &&
      overlap <= ROUTE_OVERLAP_FALLBACK_MAX &&
      directnessRatio <= ROUTE_DIRECTNESS_FALLBACK_MAX &&
      localShortcutRatio <= LOCAL_SHORTCUT_FALLBACK_MAX,
    emergency:
      args.route.distanceMeters >= 70 &&
      estimatedSeconds <= args.timeBudgetSeconds * 1.3 &&
      overlap <= ROUTE_OVERLAP_EMERGENCY_MAX &&
      directnessRatio <= ROUTE_DIRECTNESS_EMERGENCY_MAX &&
      localShortcutRatio <= LOCAL_SHORTCUT_EMERGENCY_MAX,
    overlapRatio: overlap,
    directnessRatio,
    localShortcutRatio,
  };
}

function assessRoutedScene(args: {
  scene: SceneCandidate;
  route: WalkingRoute;
  profile: ReturnType<typeof routeDistanceProfile>;
  maxDistance: number;
  timeBudgetSeconds: number;
  sideMissionCount: number;
  minutes: number;
  avoidRoutes: GeoPoint[][];
  context: LightContext;
}) {
  return {
    routed: {
      scene: args.scene,
      route: args.route,
    } satisfies RoutedScene,
    assessment: assessRoute({
      route: args.route,
      profile: args.profile,
      maxDistance: args.maxDistance,
      timeBudgetSeconds: args.timeBudgetSeconds,
      sideMissionCount: args.sideMissionCount,
      minutes: args.minutes,
      avoidRoutes: args.avoidRoutes,
      straightDistanceMeters:
        args.scene.straightDistanceMeters,
      context: args.context,
    }),
  };
}

export async function resolveRoutedScene(args: {
  start: GeoPoint;
  candidates: SceneCandidate[];
  minutes: number;
  maxDistanceMeters?: number;
  distanceScale?: number;
  sideMissionCount?: number;
  avoidRoutes?: GeoPoint[][];
  context?: LightContext;
}): Promise<RoutedScene> {
  const routingStartedAt = Date.now();
  const deadlineAt = routingStartedAt + TICKET_ROUTING_BUDGET_MS;
  const distanceScale = args.distanceScale ?? 1;
  const profile = routeDistanceProfile(args.minutes, distanceScale);
  const maxDistance = args.maxDistanceMeters ?? profile.max;
  const sideMissionCount = args.sideMissionCount ?? 0;
  const avoidRoutes = args.avoidRoutes ?? [];
  const context = args.context ?? 'day';
  const timeBudgetSeconds = Math.max(5, args.minutes) * 60;

  const shortlist = routingShortlist(
    args.candidates,
    args.minutes,
    distanceScale,
    4
  );

  let bestCached: RoutedScene | null = null;
  let bestCachedScore = Number.POSITIVE_INFINITY;
  let bestFallback: RoutedScene | null = null;
  let bestFallbackScore = Number.POSITIVE_INFINITY;
  let bestEmergency: RoutedScene | null = null;
  let bestEmergencyScore = Number.POSITIVE_INFINITY;

  // Finished prewarm data is free: inspect it synchronously before touching the
  // network. Emergency cache results are kept too instead of being discarded.
  for (const scene of shortlist) {
    const route = getCachedWalkingRoute(args.start, scene.point, context);
    if (!route) continue;

    const { routed, assessment } = assessRoutedScene({
      scene,
      route,
      profile,
      maxDistance,
      timeBudgetSeconds,
      sideMissionCount,
      minutes: args.minutes,
      avoidRoutes,
      context,
    });

    if (
      assessment.preferred &&
      assessment.score < bestCachedScore
    ) {
      bestCached = routed;
      bestCachedScore = assessment.score;
    }

    if (
      assessment.fallback &&
      assessment.score < bestFallbackScore
    ) {
      bestFallback = routed;
      bestFallbackScore = assessment.score;
    }

    if (
      assessment.emergency &&
      assessment.score < bestEmergencyScore
    ) {
      bestEmergency = routed;
      bestEmergencyScore = assessment.score;
    }
  }

  if (bestCached) {
    console.log(
      `[DETOUR ROUTE] cache hit in ${Date.now() - routingStartedAt}ms`
    );
    return bestCached;
  }

  // A running prewarm is only a hint. Give it one tiny grace window, then move
  // on. The ticket never inherits the prewarm's longer timeout/promise lifetime.
  const busySceneIds = new Set<string>();

  for (const scene of shortlist) {
    const inFlight = getInFlightWalkingRoute(args.start, scene.point, context);
    if (!inFlight) continue;

    const remaining = deadlineAt - Date.now();
    const graceMs = Math.min(
      PREWARM_TICKET_GRACE_MS,
      Math.max(0, remaining - 700)
    );

    console.log(
      `[DETOUR ROUTE] ${inFlight.purpose} in-flight; grace ${graceMs}ms`
    );

    const hintedRoute = await waitForInFlightWalkingRoute(
      args.start,
      scene.point,
      graceMs,
      context
    );

    if (hintedRoute) {
      const { routed, assessment } = assessRoutedScene({
        scene,
        route: hintedRoute,
        profile,
        maxDistance,
        timeBudgetSeconds,
        sideMissionCount,
        minutes: args.minutes,
        avoidRoutes,
        context,
      });

      if (assessment.preferred) {
        console.log(
          `[DETOUR ROUTE] fresh in-flight hint won in ${Date.now() - routingStartedAt}ms`
        );
        return routed;
      }

      if (
        assessment.fallback &&
        assessment.score < bestFallbackScore
      ) {
        bestFallback = routed;
        bestFallbackScore = assessment.score;
      }

      if (
        assessment.emergency &&
        assessment.score < bestEmergencyScore
      ) {
        bestEmergency = routed;
        bestEmergencyScore = assessment.score;
      }
    } else {
      busySceneIds.add(scene.id);
    }

    // Only one route is allowed to prewarm, so do not spend multiple grace
    // windows on unrelated background work.
    break;
  }

  let networkAttempts = 0;

  for (const scene of shortlist) {
    if (networkAttempts >= MAX_TICKET_NETWORK_ATTEMPTS) break;

    // If this exact leg is still being warmed, do not await it and do not fire
    // a duplicate request. Move to another candidate instead.
    if (
      busySceneIds.has(scene.id) &&
      getInFlightWalkingRoute(args.start, scene.point, context)
    ) {
      console.log('[DETOUR ROUTE] skipped busy prewarm candidate');
      continue;
    }

    // The prewarm may have finished after the grace window. Re-check cache for
    // free before spending a network attempt.
    const newlyCached = getCachedWalkingRoute(args.start, scene.point, context);
    if (newlyCached) {
      const { routed, assessment } = assessRoutedScene({
        scene,
        route: newlyCached,
        profile,
        maxDistance,
        timeBudgetSeconds,
        sideMissionCount,
        minutes: args.minutes,
        avoidRoutes,
        context,
      });

      if (assessment.preferred) {
        console.log(
          `[DETOUR ROUTE] fresh late cache hit in ${Date.now() - routingStartedAt}ms`
        );
        return routed;
      }

      if (
        assessment.fallback &&
        assessment.score < bestFallbackScore
      ) {
        bestFallback = routed;
        bestFallbackScore = assessment.score;
      }

      if (
        assessment.emergency &&
        assessment.score < bestEmergencyScore
      ) {
        bestEmergency = routed;
        bestEmergencyScore = assessment.score;
      }

      continue;
    }

    const remaining = deadlineAt - Date.now();
    if (remaining <= 500) break;

    networkAttempts += 1;
    const timeoutMs = Math.min(
      TICKET_ROUTE_TIMEOUT_MS,
      Math.max(300, remaining - 100)
    );

    console.log(
      `[DETOUR ROUTE] network attempt ${networkAttempts} timeout=${timeoutMs}ms`
    );

    try {
      const route = await fetchWalkingRoute(
        args.start,
        scene.point,
        timeoutMs,
        {
          purpose: 'interactive',
          deadlineAt,
          context,
        }
      );
      const { routed, assessment } = assessRoutedScene({
        scene,
        route,
        profile,
        maxDistance,
        timeBudgetSeconds,
        sideMissionCount,
        minutes: args.minutes,
        avoidRoutes,
        context,
      });

      if (assessment.preferred) {
        console.log(
          `[DETOUR ROUTE] preferred ${networkAttempts} in ${Date.now() - routingStartedAt}ms`
        );
        return routed;
      }

      if (
        assessment.fallback &&
        assessment.score < bestFallbackScore
      ) {
        bestFallback = routed;
        bestFallbackScore = assessment.score;
        console.log(
          `[DETOUR ROUTE] kept fallback ${networkAttempts}; checking for a fresher shortest leg`
        );
      }

      if (
        assessment.emergency &&
        assessment.score < bestEmergencyScore
      ) {
        bestEmergency = routed;
        bestEmergencyScore = assessment.score;
      }
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : 'unknown';

      console.log(
        `[DETOUR ROUTE] attempt ${networkAttempts} missed after ${Date.now() - routingStartedAt}ms: ${reason}`
      );
    }
  }

  if (bestFallback) {
    console.log(
      `[DETOUR ROUTE] best acceptable fallback in ${Date.now() - routingStartedAt}ms`
    );
    return bestFallback;
  }

  if (bestEmergency) {
    console.log(
      `[DETOUR ROUTE] emergency fallback in ${Date.now() - routingStartedAt}ms`
    );
    return bestEmergency;
  }

  console.log(
    `[DETOUR ROUTE] failed after ${Date.now() - routingStartedAt}ms; attempts=${networkAttempts}`
  );

  throw new Error(
    '附近有可探索的方向，但步行路線服務這次沒有及時回應。請再印一次。'
  );
}
