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

const FOOT_ROUTER =
  'https://routing.openstreetmap.de/routed-foot/route/v1/driving';

let lastRoutingRequestAt = 0;
const WALKING_ROUTE_CACHE_TTL = 2 * 60 * 1000;
const walkingRouteCache = new Map<string, { expiresAt: number; route: WalkingRoute }>();
const walkingRouteInFlight = new Map<string, Promise<WalkingRoute>>();

function walkingRouteCacheKey(start: GeoPoint, destination: GeoPoint) {
  const round = (value: number) => value.toFixed(5);
  return `${round(start.latitude)},${round(start.longitude)}>${round(destination.latitude)},${round(destination.longitude)}`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttleRouter() {
  const elapsed = Date.now() - lastRoutingRequestAt;
  const waitFor = Math.max(0, 1100 - elapsed);

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
  timeoutMs = 12000
): Promise<WalkingRoute> {
  const cacheKey = walkingRouteCacheKey(start, destination);
  const cached = walkingRouteCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.route;

  // Prewarm and ticket issue often ask for the exact same leg at nearly the
  // same time. Share that request instead of queueing a duplicate behind the
  // router throttle.
  const inFlight = walkingRouteInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const request = (async () => {
    await throttleRouter();

    const coordinates = [
      `${start.longitude},${start.latitude}`,
      `${destination.longitude},${destination.latitude}`,
    ].join(';');

    const url =
      `${FOOT_ROUTER}/${coordinates}` +
      '?overview=full&geometries=geojson&steps=true&alternatives=false';
    const response = await fetchWithTimeout(url, timeoutMs);

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
    walkingRouteInFlight.delete(cacheKey);
  });

  walkingRouteInFlight.set(cacheKey, request);
  return request;
}

export async function prewarmWalkingRoutes(
  start: GeoPoint,
  candidates: SceneCandidate[],
  limit = 2,
  minutes = 15,
  distanceScale = 1
) {
  const straightTarget = targetDistance(minutes) * distanceScale * 0.74;
  const likely = candidates
    .slice(0, 7)
    .sort(
      (a, b) =>
        Math.abs(a.straightDistanceMeters - straightTarget) -
        Math.abs(b.straightDistanceMeters - straightTarget)
    )
    .slice(0, Math.max(0, limit));

  for (const scene of likely) {
    try {
      await fetchWalkingRoute(start, scene.point, 3200);
    } catch {
      // Prewarming is opportunistic; ticket issue can still try another route.
    }
  }
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

export async function resolveRoutedScene(args: {
  start: GeoPoint;
  candidates: SceneCandidate[];
  minutes: number;
  maxDistanceMeters?: number;
  distanceScale?: number;
  sideMissionCount?: number;
  avoidRoutes?: GeoPoint[][];
}): Promise<RoutedScene> {
  const profile = routeDistanceProfile(
    args.minutes,
    args.distanceScale ?? 1
  );
  const maxDistance = args.maxDistanceMeters ?? profile.max;
  const straightTarget = profile.target * 0.74;
  const sideMissionCount = args.sideMissionCount ?? 0;
  const avoidRoutes = args.avoidRoutes ?? [];
  const timeBudgetSeconds = Math.max(5, args.minutes) * 60 * 1.05;
  const routingStartedAt = Date.now();
  const TICKET_ROUTING_BUDGET_MS = 4800;

  // Search a broader quality window, then try the candidates closest to the
  // requested time first. This avoids throwing away perfectly walkable nearby
  // places just because they ranked 8th or 9th on POI quality.
  const shortlist = args.candidates
    .slice(0, 18)
    .sort(
      (a, b) =>
        Math.abs(a.straightDistanceMeters - straightTarget) -
        Math.abs(b.straightDistanceMeters - straightTarget)
    )
    .slice(0, 5);

  let bestFallback: RoutedScene | null = null;
  let bestFallbackScore = Number.POSITIVE_INFINITY;

  for (const scene of shortlist) {
    if (Date.now() - routingStartedAt > TICKET_ROUTING_BUDGET_MS && bestFallback) {
      break;
    }

    try {
      const route = await fetchWalkingRoute(args.start, scene.point, 3200);
      const overlap = routeOverlapRatio(route.coordinates, avoidRoutes);
      const estimatedSeconds = estimatedJourneySeconds(
        route,
        sideMissionCount,
        args.minutes
      );
      const overtimeSeconds = Math.max(0, estimatedSeconds - timeBudgetSeconds);
      const distanceDelta = Math.abs(route.distanceMeters - profile.target);
      const noveltyPenalty = overlap * profile.target * 0.95;
      const overtimePenalty = overtimeSeconds * 1.4;
      const score = distanceDelta + noveltyPenalty + overtimePenalty;

      if (
        route.distanceMeters >= 70 &&
        estimatedSeconds <= timeBudgetSeconds * 1.12 &&
        score < bestFallbackScore
      ) {
        bestFallback = { scene, route };
        bestFallbackScore = score;
      }

      // A route that is safely inside the time/distance envelope is already
      // good enough for a fast ticket, even if it misses the ideal-distance
      // band or repeats a little more history than preferred.
      const fastFallbackFits =
        route.distanceMeters >= 70 &&
        estimatedSeconds <= timeBudgetSeconds * 1.06 &&
        overlap <= 0.85;

      const distanceFits =
        route.distanceMeters >= profile.min &&
        route.distanceMeters <= maxDistance;
      const timeFits = estimatedSeconds <= timeBudgetSeconds;
      const noveltyFits = overlap <= 0.62;

      // Fast path: a route that clears all product gates is good enough. Do not
      // make the user wait while we compare mathematically nicer alternatives.
      if (distanceFits && timeFits && noveltyFits) {
        return { scene, route };
      }

      if (fastFallbackFits) {
        return { scene, route };
      }
    } catch {
      // Try the next Scene while the small routing budget remains.
    }
  }

  if (bestFallback) return bestFallback;

  throw new Error(
    `附近有 Scene，但目前找不到符合 ${args.minutes} 分鐘節奏的步行主線。`
  );
}
