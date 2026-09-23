import { distance, type Environment, type Point } from "./pocket-engine";
import {
  isImmediatePocketUTurn,
  rankPocketPlaces,
} from "./pocket-routing-policy";
import { fetchWalkingRoute } from "./routing-engine";
import { distanceToPolyline } from "./navigation-engine";
import { DETOUR_API_CONFIG } from "./app-config";
import { fetchDetourApi } from "./api-client";

export type LocalPlace = {
  point: Point;
  name: string;
  stop: boolean;
  environment: Environment;
};
export type PocketLeg = {
  coordinates: Point[];
  destination: LocalPlace;
  closing: boolean;
};
type Element = {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};
let cache: { point: Point; time: number; places: LocalPlace[] } | undefined;

export async function nearbyPlaces(point: Point): Promise<LocalPlace[]> {
  if (
    cache &&
    Date.now() - cache.time < 300000 &&
    distance(cache.point, point) < 350
  )
    return cache.places;
  const around = `around:650,${point.latitude},${point.longitude}`;
  const query = `[out:json][timeout:12];(nwr(${around})[leisure=park];nwr(${around})[place=square];way(${around})[highway~"^(pedestrian|footway|residential|living_street)$"];node(${around})[amenity=bench];nwr(${around})[amenity~"^(cafe|restaurant|marketplace)$"];);out center tags;`;

  try {
    const response = await fetchDetourApi(
      DETOUR_API_CONFIG.sceneEndpoint,
      {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
      12000,
    );
    if (!response.ok) throw new Error("Nearby streets unavailable");
    const json = (await response.json()) as { elements: Element[] };
    if (!Array.isArray(json.elements))
      throw new Error("Invalid nearby street response");
    const places: LocalPlace[] = json.elements.flatMap((e) => {
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      const tags = e.tags ?? {};
      if (
        lat === undefined ||
        lon === undefined ||
        ["private", "no"].includes(tags.access) ||
        tags.highway === "construction"
      )
        return [];
      const green =
        tags.leisure === "park" || tags.landuse === "recreation_ground";
      const stop =
        green ||
        tags.place === "square" ||
        tags.amenity === "bench" ||
        tags.highway === "pedestrian";
      return [
        {
          point: { latitude: lat, longitude: lon },
          name:
            tags.name ||
            (green
              ? "附近的小公園"
              : tags.amenity === "bench"
                ? "街邊的公共座位"
                : tags.place === "square"
                  ? "附近的廣場"
                  : "這一段步行空間"),
          stop,
          environment: green ? "green" : tags.amenity ? "commercial" : "street",
        },
      ];
    });
    cache = { point, time: Date.now(), places };
    return places;
  } catch (error) {
    throw error;
  }
}

export const rankPlaces = rankPocketPlaces;
export async function planLeg(args: {
  current: Point;
  origin: Point;
  trace: Point[];
  closing: boolean;
  elapsed: number;
  places: LocalPlace[];
  recentRoutes?: Point[][];
},
fetchRoute: typeof fetchWalkingRoute = fetchWalkingRoute,
): Promise<PocketLeg | null> {
  const candidates = rankPlaces(
    args.places,
    args.current,
    args.origin,
    args.trace,
    args.closing,
    args.elapsed,
  );
  for (const destination of candidates.slice(0, 3)) {
    try {
      const fetched = await fetchRoute(
        args.current,
        destination.point,
        4500,
        {
          context:
            new Date().getHours() >= 19 || new Date().getHours() < 6
              ? "night"
              : "day",
        },
      );
      const route = { ...fetched, coordinates: [...fetched.coordinates] };
      if (
        route.coordinates.length < 2 ||
        (args.closing &&
          route.distanceMeters >
            Math.min(420, Math.max(70, (900 - args.elapsed) * 0.9)))
      )
        continue;
      // Only retain the next short section. This waypoint is not a journey endpoint.
      if (!args.closing && route.distanceMeters > 220) {
        const clipped: Point[] = [route.coordinates[0]];
        let meters = 0;
        for (let i = 1; i < route.coordinates.length; i++) {
          const a = route.coordinates[i - 1],
            b = route.coordinates[i];
          const edge = distance(a, b);
          if (meters + edge > 220) {
            const t = (220 - meters) / edge;
            clipped.push({
              latitude: a.latitude + (b.latitude - a.latitude) * t,
              longitude: a.longitude + (b.longitude - a.longitude) * t,
            });
            break;
          }
          clipped.push(b);
          meters += edge;
        }
        route.coordinates = clipped;
      }
      const ahead = route.coordinates.find(
        (p) => distance(args.current, p) > 30,
      );
      const previous =
        args.trace.length > 2 ? args.trace[args.trace.length - 3] : undefined;
      if (isImmediatePocketUTurn(previous, args.current, ahead)) continue;
      const samples = route.coordinates.filter(
        (p) => distance(p, args.current) > 40,
      );
      const histories = [
        args.trace.slice(0, -2),
        ...(args.recentRoutes ?? []),
      ].filter((t) => t.length > 1);
      const overlap =
        samples.filter((p) =>
          histories.some((t) => distanceToPolyline(p, t) < 18),
        ).length / Math.max(1, samples.length);
      if (overlap > 0.4) continue;
      return {
        coordinates: route.coordinates,
        destination,
        closing: args.closing,
      };
    } catch {
      /* Try another public walkable candidate, never a straight-line fallback. */
    }
  }
  return null;
}
