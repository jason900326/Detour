import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const QUERY_VERSION = 6;
const SCENE_SCHEMA_VERSION = 2;
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
  scene_family: SceneFamily | "detour";
  quality_score: number;
  oddity_score: number;
  visual_score: number;
  food_commitment_score: number | null;
  traits: string[] | null;
  scoring_version: number;
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

function normalizedSceneText(tags: Record<string, string>) {
  return [
    tags.name,
    tags["name:zh"],
    tags.official_name,
    tags.operator,
    tags.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasAnySceneKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function isClearlyPublicDestination(tags: Record<string, string>) {
  return (
    ["museum", "gallery"].includes(tags.tourism ?? "") ||
    [
      "arts_centre",
      "community_centre",
      "library",
      "marketplace",
      "public_bookcase",
    ].includes(tags.amenity ?? "") ||
    ["park", "garden"].includes(tags.leisure ?? "") ||
    tags.place === "square"
  );
}

function isUnsafeOrRestrictedScene(tags: Record<string, string>) {
  if (["private", "no"].includes(tags.access ?? "")) return true;
  if (tags["detour:generated"] === "route-anchor") return true;

  const amenity = tags.amenity ?? "";
  const building = tags.building ?? "";
  const healthcare = tags.healthcare ?? "";
  const emergency = tags.emergency ?? "";
  const office = tags.office ?? "";
  const text = normalizedSceneText(tags);

  if (
    ["hospital", "clinic", "doctors", "dentist"].includes(amenity) ||
    ["hospital", "clinic", "doctor", "dentist", "centre", "center"].includes(healthcare) ||
    building === "hospital" ||
    emergency === "emergency_ward" ||
    hasAnySceneKeyword(text, [
      "醫院", "醫學中心", "醫療中心", "診所",
      " hospital", "hospital ", "medical center", "medical centre",
      " clinic", "clinic ",
    ])
  ) {
    return true;
  }

  const policeOrFire =
    ["police", "fire_station"].includes(amenity) ||
    ["police", "fire_station"].includes(building) ||
    ["fire_station", "ambulance_station"].includes(emergency) ||
    hasAnySceneKeyword(text, [
      "警察局", "派出所", "分局", "警察隊",
      "消防局", "消防隊", "消防分隊",
      "police station", "fire station",
    ]);

  if (policeOrFire && !["museum", "gallery"].includes(tags.tourism ?? "")) {
    return true;
  }

  if (
    amenity === "prison" ||
    tags.landuse === "military" ||
    tags.military !== undefined ||
    building === "military"
  ) {
    return true;
  }

  const government =
    office === "government" ||
    tags.government !== undefined ||
    ["townhall", "courthouse", "embassy"].includes(amenity) ||
    ["government", "civic"].includes(building) ||
    hasAnySceneKeyword(text, [
      "市政府", "縣政府", "區公所", "鄉公所", "鎮公所",
      "戶政事務所", "地政事務所", "稅捐處", "稅務局",
      "法院", "檢察署", "government office", "city hall",
      "district office", "courthouse",
    ]);

  return government && !isClearlyPublicDestination(tags);
}

function sceneRowsToElements(rows: SceneRow[]): OverpassElement[] {
  const elements: OverpassElement[] = [];

  for (const row of rows) {
    if (!row.osm_type || row.osm_id === null) continue;

    const id = Number(row.osm_id);
    if (!Number.isFinite(id)) continue;

    const traits = Array.isArray(row.traits)
      ? row.traits.filter((trait): trait is string => typeof trait === "string")
      : [];
    const tags: Record<string, string> = {
      ...(row.tags ?? {}),
      "detour:scene_family": row.scene_family,
      "detour:quality_score": String(row.quality_score),
      "detour:oddity_score": String(row.oddity_score),
      "detour:visual_score": String(row.visual_score),
      "detour:traits": traits.join(","),
      "detour:scoring_version": String(row.scoring_version),
    };

    if (row.food_commitment_score !== null) {
      tags["detour:food_commitment_score"] = String(
        row.food_commitment_score,
      );
    }
    if (isUnsafeOrRestrictedScene(tags)) continue;

    elements.push({
      type: row.osm_type,
      id,
      lat: Number(row.latitude),
      lon: Number(row.longitude),
      tags,
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
  console.log(
    `[DETOUR SCENE API] database empty ${Date.now() - startedAt}ms · refusing unsafe synthetic anchor`,
  );

  return json(
    {
      error: "SCENE_DATABASE_EMPTY",
      detail:
        descriptor.family === "food"
          ? "Food needs a real named place. Taiwan Scene import has not provided one here yet."
          : "No verified public Scene is available in this area yet.",
    },
    503,
    { "X-Detour-Scene-Source": "database-empty" },
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
          sceneSchemaVersion: SCENE_SCHEMA_VERSION,
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
