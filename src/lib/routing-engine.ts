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

  if (waitFor > 0) {
    await wait(waitFor);
  }

  lastRoutingRequestAt = Date.now();
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
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

  if (!response.ok) {
    throw new Error(`Walking router ${response.status}`);
  }

  const data = (await response.json()) as OsrmResponse;
  const route = data.routes?.[0];

  if (
    data.code !== 'Ok' ||
    !route ||
    !route.geometry?.coordinates?.length
  ) {
    throw new Error('No walking route');
  }

  const points = route.geometry.coordinates.map(
    ([longitude, latitude]) => ({
      latitude,
      longitude,
    })
  );

  return {
    coordinates: points,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}

function routeDistanceLimit(minutes: number) {
  if (minutes <= 15) return 430;
  if (minutes <= 30) return 540;
  if (minutes <= 60) return 670;
  return 790;
}

export async function resolveRoutedScene(args: {
  start: GeoPoint;
  candidates: SceneCandidate[];
  minutes: number;
  maxDistanceMeters?: number;
  distanceScale?: number;
}): Promise<RoutedScene> {
  const maxDistance =
    args.maxDistanceMeters ??
    routeDistanceLimit(args.minutes) *
      (args.distanceScale ?? 1);
  // A strict top-5 made sparse neighborhoods fail too easily when one
  // candidate snapped badly to the pedestrian network. Try a few more
  // candidates while keeping requests sequential and throttled.
  const shortlist = args.candidates.slice(0, 8);

  let shortestFallback: RoutedScene | null = null;

  for (const scene of shortlist) {
    try {
      const route = await fetchWalkingRoute(
        args.start,
        scene.point
      );

      if (
        !shortestFallback ||
        route.distanceMeters <
          shortestFallback.route.distanceMeters
      ) {
        shortestFallback = { scene, route };
      }

      if (
        route.distanceMeters >= 45 &&
        route.distanceMeters <= maxDistance
      ) {
        return { scene, route };
      }
    } catch {
      // Try the next scene. Public prototype router can occasionally miss.
    }
  }

  if (
    shortestFallback &&
    shortestFallback.route.distanceMeters <= maxDistance * 1.08
  ) {
    return shortestFallback;
  }

  throw new Error(
    `附近有 Scene，但目前找不到 ${Math.round(
      maxDistance
    )} 公尺內適合步行抵達的主線。`
  );
}
