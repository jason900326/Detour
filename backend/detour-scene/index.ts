import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const QUERY_VERSION = 4;
const DATABASE_LIMIT = 180;

type SceneFamily = "general" | "food";

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type SceneRow = {
  id: string;
  osm_type: "node" | "way" | "relation" | null;
  osm_id: number | string | null;
  latitude: number;
  longitude: number;
  tags: Record<string, string> | null;
  kind: string;
  quality_score: number;
  distance_m: number;
};

type QueryDescriptor = {
  family: SceneFamily;
  radius: number;
  latitude: number;
  longitude: number;
  gridLatE3: number;
  gridLonE3: number;
};

function json(value: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...CORS_HEADERS,
      ...(extraHeaders ?? {}),
    },
  });
}

function getEnvKeyMap(name: string) {
  const raw = Deno.env.get(name) ?? "";

  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function isAuthorized(req: Request) {
  const provided = req.headers.get("apikey") ?? "";
  return Object.values(getEnvKeyMap("SUPABASE_PUBLISHABLE_KEYS")).includes(provided);
}

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const secrets = getEnvKeyMap("SUPABASE_SECRET_KEYS");
  const secretKey = secrets.default ?? Object.values(secrets)[0] ?? "";

  if (!url || !secretKey) return null;

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function parseQueryDescriptor(query: string): QueryDescriptor | null {
  if (query.length < 20 || query.length > 6000 || !query.includes("[out:json]")) {
    return null;
  }

  const match = query.match(
    /\(around:(\d+),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/,
  );

  if (!match) return null;

  const radius = Number(match[1]);
  const latitude = Number(match[2]);
  const longitude = Number(match[3]);

  if (
    !Number.isFinite(radius) ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    radius < 100 ||
    radius > 2000 ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }

  const family: SceneFamily =
    query.includes('["amenity"~"restaurant|fast_food|cafe|food_court|ice_cream"]') ||
    query.includes('["shop"~"bakery|confectionery|deli|pastry|beverages|coffee|tea"]')
      ? "food"
      : "general";

  return {
    family,
    radius,
    latitude,
    longitude,
    gridLatE3: Math.round(latitude * 1000),
    gridLonE3: Math.round(longitude * 1000),
  };
}

function sceneRowsToElements(rows: SceneRow[]): OverpassElement[] {
  const elements: OverpassElement[] = [];

  for (const row of rows) {
    if (!row.osm_type || row.osm_id === null) continue;

    const id = Number(row.osm_id);
    if (!Number.isFinite(id)) continue;

    elements.push({
      type: row.osm_type,
      id,
      lat: Number(row.latitude),
      lon: Number(row.longitude),
      tags: row.tags ?? {},
    });
  }

  return elements;
}

async function findDatabaseScenes(
  admin: ReturnType<typeof createClient>,
  descriptor: QueryDescriptor,
) {
  const startedAt = Date.now();
  const { data, error } = await admin.rpc("nearby_detour_scenes", {
    p_lat: descriptor.latitude,
    p_lon: descriptor.longitude,
    p_radius_m: descriptor.radius,
    p_family: descriptor.family,
    p_limit: DATABASE_LIMIT,
  });

  if (error) {
    console.log(
      `[DETOUR SCENE API] Scene DB failed ${Date.now() - startedAt}ms · ${error.message}`,
    );
    return null;
  }

  const rows = Array.isArray(data) ? data as SceneRow[] : [];
  const elements = sceneRowsToElements(rows);

  console.log(
    `[DETOUR SCENE API] Scene DB ${elements.length > 0 ? "hit" : "miss"} ${Date.now() - startedAt}ms · ${elements.length} elements`,
  );

  return elements;
}

function offsetPoint(
  latitude: number,
  longitude: number,
  meters: number,
  bearingDegrees: number,
) {
  const earthRadius = 6371000;
  const bearing = bearingDegrees * Math.PI / 180;
  const lat1 = latitude * Math.PI / 180;
  const lon1 = longitude * Math.PI / 180;
  const angularDistance = meters / earthRadius;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
  );

  return {
    latitude: lat2 * 180 / Math.PI,
    longitude: lon2 * 180 / Math.PI,
  };
}

function anchorDistanceForRadius(radius: number) {
  if (radius <= 1150) return 500;
  if (radius <= 1400) return 800;
  if (radius <= 1600) return 1050;
  if (radius <= 1725) return 1250;
  return 1500;
}

function generatedRouteAnchors(descriptor: QueryDescriptor): OverpassElement[] {
  if (descriptor.family === "food") return [];

  const baseDistance = anchorDistanceForRadius(descriptor.radius);
  const seed = Math.abs(descriptor.gridLatE3 * 31 + descriptor.gridLonE3 * 17);
  const baseBearing = seed % 360;
  const bearingOffsets = [0, 180, 90, 270, 45, 225, 135, 315];
  const distanceScales = [1, 1, 0.96, 1.04, 0.9, 1.1, 0.94, 1.06];
  const idBase = 1_700_000_000 + seed % 100_000;

  return bearingOffsets.map((bearingOffset, index) => {
    const point = offsetPoint(
      descriptor.latitude,
      descriptor.longitude,
      baseDistance * distanceScales[index],
      (baseBearing + bearingOffset) % 360,
    );

    return {
      type: "node",
      id: idBase + index,
      lat: point.latitude,
      lon: point.longitude,
      tags: {
        highway: "pedestrian",
        name: "這趟 DETOUR 的收尾點",
        "detour:generated": "route-anchor",
      },
    } satisfies OverpassElement;
  });
}

function generatedResponse(descriptor: QueryDescriptor, startedAt: number) {
  const elements = generatedRouteAnchors(descriptor);

  if (elements.length === 0) {
    return json(
      {
        error: "SCENE_DATABASE_EMPTY",
        detail: "Food needs a real named place. Taiwan Scene import has not provided one here yet.",
      },
      503,
      { "X-Detour-Scene-Source": "database-empty" },
    );
  }

  console.log(
    `[DETOUR SCENE API] route-anchor fallback ${Date.now() - startedAt}ms · ${elements.length} anchors`,
  );

  return json(
    {
      elements,
      detourCache: {
        status: "generated",
        ageMs: 0,
        upstream: "route-anchor",
      },
    },
    200,
    { "X-Detour-Scene-Source": "route-anchor" },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  if (!isAuthorized(req)) {
    return json({ error: "INVALID_API_KEY" }, 401);
  }

  const requestStartedAt = Date.now();
  let activeDescriptor: QueryDescriptor | null = null;

  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body?.mode === "health") {
        return json({
          ok: true,
          source: "postgis-scenes",
          queryVersion: QUERY_VERSION,
          failOpen: true,
          overpassInCriticalPath: false,
        });
      }
      return json({ error: "INVALID_PAYLOAD" }, 400);
    }

    const bodyText = await req.text();
    const query = new URLSearchParams(bodyText).get("data") ?? "";
    activeDescriptor = parseQueryDescriptor(query);

    if (!activeDescriptor) {
      return json({ error: "INVALID_SCENE_QUERY" }, 400);
    }

    const admin = getAdminClient();
    if (!admin) {
      console.log("[DETOUR SCENE API] database admin key unavailable");
      return generatedResponse(activeDescriptor, requestStartedAt);
    }

    const databaseElements = await findDatabaseScenes(admin, activeDescriptor);
    if (databaseElements && databaseElements.length > 0) {
      console.log(
        `[DETOUR SCENE API] database response ${Date.now() - requestStartedAt}ms`,
      );

      return json(
        {
          elements: databaseElements,
          detourCache: {
            status: "database",
            ageMs: 0,
            upstream: "scene-db",
          },
        },
        200,
        { "X-Detour-Scene-Source": "scene-db" },
      );
    }

    return generatedResponse(activeDescriptor, requestStartedAt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    console.log(
      `[DETOUR SCENE API] request failed ${Date.now() - requestStartedAt}ms · ${message}`,
    );

    if (activeDescriptor) {
      return generatedResponse(activeDescriptor, requestStartedAt);
    }

    return json(
      {
        error: "SCENE_GATEWAY_FAILED",
        detail: message.slice(0, 300),
      },
      500,
    );
  }
});
