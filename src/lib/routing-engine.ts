import type { GeoPoint } from './journey-engine';
import type { SceneCandidate } from './scene-engine';

export type WalkingRoute = {
  coordinates: GeoPoint[];
  distanceMeters: number;
  durationSeconds: number;
};

export type RoutedScene = {
  scene: SceneCandidate;
  route: WalkingRoute;
};

type OsrmResponse = {
  code?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: {
      type: 'LineString';
      coordinates: [number, number][];
    };
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

const walkingRouteCache = new Map<
  string,
  { expiresAt: number; route: WalkingRoute }
>();
const walkingRouteInFlight = new Map<string, InFlightWalkingRoute>();

function walkingRouteCacheKey(start: GeoPoint, destination: GeoPoint) {
  const round = (value: number) => value.toFixed(5);
  return `${round(start.latitude)},${round(start.longitude)}>${round(destination.latitude)},${round(destination.longitude)}`;
}

function getCachedWalkingRoute(
  start: GeoPoint,
  destination: GeoPoint
): WalkingRoute | null {
  const cacheKey = walkingRouteCacheKey(start, destination);
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
  destination: GeoPoint
) {
  return walkingRouteInFlight.get(
    walkingRouteCacheKey(start, destination)
  ) ?? null;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitForInFlightWalkingRoute(
  start: GeoPoint,
  destination: GeoPoint,
  waitMs: number
): Promise<WalkingRoute | null> {
  const inFlight = getInFlightWalkingRoute(start, destination);
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

export async function fetchWalkingRoute(
  start: GeoPoint,
  destination: GeoPoint,
  timeoutMs = 12000,
  options?: {
    purpose?: RouteRequestPurpose;
    deadlineAt?: number;
  }
): Promise<WalkingRoute> {
  const cacheKey = walkingRouteCacheKey(start, destination);
  const cached = getCachedWalkingRoute(start, destination);
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
      '?overview=full&geometries=geojson&steps=true&alternatives=false';
    const response = await fetchWithTimeout(url, effectiveTimeout);

    if (!response.ok) throw new Error(`Walking router ${response.status}`);

    const data = (await response.json()) as OsrmResponse;
    const route = data.routes?.[0];

    if (data.code !== 'Ok' || !route || !route.geometry?.coordinates?.length) {
      throw new Error('No walking route');
    }

    const normalized: WalkingRoute = {
      coordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({
        latitude,
        longitude,
      })),
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };

    walkingRouteCache.set(cacheKey, {
      expiresAt: Date.now() + WALKING_ROUTE_CACHE_TTL,
      route: normalized,
    });

    return normalized;
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
  distanceScale = 1
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

  if (getCachedWalkingRoute(start, scene.point)) {
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
      { purpose: 'prewarm' }
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

function routeOverlapRatio(route: GeoPoint[], avoidRoutes: GeoPoint[][]) {
  if (route.length < 4 || avoidRoutes.length === 0) return 0;

  // Every Detour from the same starting point naturally shares its first few
  // metres. Novelty matters after the route has actually left the origin.
  const startIndex = Math.min(route.length - 1, Math.floor(route.length * 0.18));
  const usable = route.slice(startIndex);
  const step = Math.max(1, Math.floor(usable.length / 20));
  const samples = usable.filter((_, index) => index % step === 0).slice(0, 24);
  if (samples.length === 0) return 0;

  const historical = avoidRoutes
    .filter((item) => item.length >= 2)
    .slice(0, 6)
    .flatMap((item) => {
      const historyStep = Math.max(1, Math.floor(item.length / 90));
      return item.filter((_, index) => index % historyStep === 0);
    });

  if (historical.length === 0) return 0;

  let overlapping = 0;
  for (const point of samples) {
    if (historical.some((oldPoint) => distanceBetweenPoints(point, oldPoint) <= 35)) {
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
};

function assessRoute(args: {
  route: WalkingRoute;
  profile: ReturnType<typeof routeDistanceProfile>;
  maxDistance: number;
  timeBudgetSeconds: number;
  sideMissionCount: number;
  minutes: number;
  avoidRoutes: GeoPoint[][];
}): RouteAssessment {
  const overlap = routeOverlapRatio(args.route.coordinates, args.avoidRoutes);
  const estimatedSeconds = estimatedJourneySeconds(
    args.route,
    args.sideMissionCount,
    args.minutes
  );
  const overtimeSeconds = Math.max(0, estimatedSeconds - args.timeBudgetSeconds);
  const distanceDelta = Math.abs(args.route.distanceMeters - args.profile.target);

  // History overlap is a preference, never a blocker. A repeated route should
  // lose against an equally fast fresh route, but it must not stop ticket issue.
  const noveltyPenalty = overlap * args.profile.target * 0.95;
  const overtimePenalty = overtimeSeconds * 1.4;
  const score = distanceDelta + noveltyPenalty + overtimePenalty;

  const distanceFits =
    args.route.distanceMeters >= args.profile.min &&
    args.route.distanceMeters <= args.maxDistance;
  const timeFits = estimatedSeconds <= args.timeBudgetSeconds;

  return {
    score,
    preferred: distanceFits && timeFits,
    fallback:
      args.route.distanceMeters >= 70 &&
      estimatedSeconds <= args.timeBudgetSeconds * 1.12,
    emergency:
      args.route.distanceMeters >= 70 &&
      estimatedSeconds <= args.timeBudgetSeconds * 1.3,
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
}): Promise<RoutedScene> {
  const routingStartedAt = Date.now();
  const deadlineAt = routingStartedAt + TICKET_ROUTING_BUDGET_MS;
  const distanceScale = args.distanceScale ?? 1;
  const profile = routeDistanceProfile(args.minutes, distanceScale);
  const maxDistance = args.maxDistanceMeters ?? profile.max;
  const sideMissionCount = args.sideMissionCount ?? 0;
  const avoidRoutes = args.avoidRoutes ?? [];
  const timeBudgetSeconds = Math.max(5, args.minutes) * 60 * 1.05;

  const shortlist = routingShortlist(
    args.candidates,
    args.minutes,
    distanceScale,
    3
  );

  let bestCached: RoutedScene | null = null;
  let bestCachedScore = Number.POSITIVE_INFINITY;
  let bestEmergency: RoutedScene | null = null;
  let bestEmergencyScore = Number.POSITIVE_INFINITY;

  // Finished prewarm data is free: inspect it synchronously before touching the
  // network. Emergency cache results are kept too instead of being discarded.
  for (const scene of shortlist) {
    const route = getCachedWalkingRoute(args.start, scene.point);
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
    });

    if (
      (assessment.preferred || assessment.fallback) &&
      assessment.score < bestCachedScore
    ) {
      bestCached = routed;
      bestCachedScore = assessment.score;
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
    const inFlight = getInFlightWalkingRoute(args.start, scene.point);
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
      graceMs
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
      });

      if (assessment.preferred || assessment.fallback) {
        console.log(
          `[DETOUR ROUTE] in-flight hint won in ${Date.now() - routingStartedAt}ms`
        );
        return routed;
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
      getInFlightWalkingRoute(args.start, scene.point)
    ) {
      console.log('[DETOUR ROUTE] skipped busy prewarm candidate');
      continue;
    }

    // The prewarm may have finished after the grace window. Re-check cache for
    // free before spending a network attempt.
    const newlyCached = getCachedWalkingRoute(args.start, scene.point);
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
      });

      if (assessment.preferred || assessment.fallback) {
        console.log(
          `[DETOUR ROUTE] late cache hit in ${Date.now() - routingStartedAt}ms`
        );
        return routed;
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
      });

      if (assessment.preferred) {
        console.log(
          `[DETOUR ROUTE] preferred ${networkAttempts} in ${Date.now() - routingStartedAt}ms`
        );
        return routed;
      }

      if (assessment.fallback) {
        console.log(
          `[DETOUR ROUTE] soft fallback ${networkAttempts} in ${Date.now() - routingStartedAt}ms`
        );
        return routed;
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
