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
  destination: GeoPoint
): Promise<WalkingRoute> {
  await throttleRouter();

  const coordinates = [
    `${start.longitude},${start.latitude}`,
    `${destination.longitude},${destination.latitude}`,
  ].join(';');

  const url =
    `${FOOT_ROUTER}/${coordinates}` +
    '?overview=full&geometries=geojson&steps=true&alternatives=false';
  const response = await fetchWithTimeout(url, 12000);

  if (!response.ok) throw new Error(`Walking router ${response.status}`);

  const data = (await response.json()) as OsrmResponse;
  const route = data.routes?.[0];

  if (data.code !== 'Ok' || !route || !route.geometry?.coordinates?.length) {
    throw new Error('No walking route');
  }

  return {
    coordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({
      latitude,
      longitude,
    })),
    distanceMeters: route.distance,
    durationSeconds: route.duration,
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

export async function resolveRoutedScene(args: {
  start: GeoPoint;
  candidates: SceneCandidate[];
  minutes: number;
  maxDistanceMeters?: number;
  distanceScale?: number;
}): Promise<RoutedScene> {
  const profile = routeDistanceProfile(
    args.minutes,
    args.distanceScale ?? 1
  );
  const maxDistance = args.maxDistanceMeters ?? profile.max;
  const straightTarget = profile.target * 0.74;

  // AI/editorial rank chooses taste. For the final route check, distance fit
  // gets priority inside that shortlist so a 20-minute request cannot end in
  // a 2-minute walk simply because that candidate was ranked first.
  const shortlist = args.candidates
    .slice(0, 14)
    .sort(
      (a, b) =>
        Math.abs(a.straightDistanceMeters - straightTarget) -
        Math.abs(b.straightDistanceMeters - straightTarget)
    )
    .slice(0, 8);

  let bestFallback: RoutedScene | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const scene of shortlist) {
    try {
      const route = await fetchWalkingRoute(args.start, scene.point);
      const delta = Math.abs(route.distanceMeters - profile.target);

      if (route.distanceMeters <= maxDistance * 1.08 && delta < bestDelta) {
        bestFallback = { scene, route };
        bestDelta = delta;
      }

      if (
        route.distanceMeters >= profile.min &&
        route.distanceMeters <= maxDistance
      ) {
        return { scene, route };
      }
    } catch {
      // Try the next Scene. Public routing can occasionally miss a snap.
    }
  }

  if (bestFallback) return bestFallback;

  throw new Error(
    `附近有 Scene，但目前找不到符合 ${args.minutes} 分鐘節奏的步行主線。`
  );
}
