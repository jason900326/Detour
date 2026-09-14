import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const OVERPASS_UPSTREAMS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// Public Overpass is enrichment, not a ticket gate. Cold requests get a short
// chance to return real OSM data; general Detours then fail open to route
// anchors instead of making the user wait 5-7 seconds for a 503.
const UPSTREAM_HEDGE_DELAY_MS = 180;
const UPSTREAM_REQUEST_TIMEOUT_MS = 1800;
const GENERAL_FRESH_MS = 6 * 60 * 60 * 1000;
const GENERAL_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const FOOD_FRESH_MS = 60 * 60 * 1000;
const FOOD_STALE_MS = 12 * 60 * 60 * 1000;
const QUERY_VERSION = 3;

type SceneFamily = "general" | "food";

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type CacheRow = {
  cache_key: string;
  family: SceneFamily;
  grid_lat_e3: number;
  grid_lon_e3: number;
  radius_m: number;
  elements: OverpassElement[];
  upstream: string;
  fetched_at: string;
  expires_at: string;
  stale_until: string;
};

type QueryDescriptor = {
  cacheKey: string;
  family: SceneFamily;
  radius: number;
  latitude: number;
  longitude: number;
  gridLatE3: number;
  gridLonE3: number;
};

const refreshInFlight = new Map<string, Promise<void>>();

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

  const gridLatE3 = Math.round(latitude * 1000);
  const gridLonE3 = Math.round(longitude * 1000);
  const cacheKey = [
    `scene-v${QUERY_VERSION}`,
    family,
    radius,
    gridLatE3,
    gridLonE3,
  ].join(":");

  return {
    cacheKey,
    family,
    radius,
    latitude,
    longitude,
    gridLatE3,
    gridLonE3,
  };
}

function endpointLabel(endpoint: string) {
  return endpoint.replace(/^https?:\/\//, "").split("/")[0];
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchUpstream(query: string) {
  return await new Promise<{ elements: OverpassElement[]; upstream: string }>(
    (resolve, reject) => {
      let settled = false;
      let failures = 0;
      const errors: string[] = [];

      const fail = (label: string, error: unknown) => {
        failures += 1;
        const message = error instanceof Error ? error.message : "unknown";
        errors.push(`${label}:${message}`);

        if (!settled && failures >= OVERPASS_UPSTREAMS.length) {
          settled = true;
          reject(new Error(errors.join(" | ")));
        }
      };

      OVERPASS_UPSTREAMS.forEach((endpoint, index) => {
        void (async () => {
          if (index > 0) {
            await new Promise<void>((done) =>
              setTimeout(done, index * UPSTREAM_HEDGE_DELAY_MS)
            );
          }

          const label = endpointLabel(endpoint);
          const endpointStartedAt = Date.now();

          try {
            const response = await fetchWithTimeout(
              endpoint,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                  Accept: "application/json",
                },
                body: `data=${encodeURIComponent(query)}`,
              },
              UPSTREAM_REQUEST_TIMEOUT_MS,
            );

            if (!response.ok) {
              throw new Error(`HTTP_${response.status}`);
            }

            const data = await response.json() as { elements?: OverpassElement[] };
            if (!Array.isArray(data.elements)) {
              throw new Error("INVALID_RESPONSE");
            }

            console.log(
              `[DETOUR SCENE API] ${label} success ${Date.now() - endpointStartedAt}ms · ${data.elements.length} elements`,
            );

            if (!settled) {
              settled = true;
              resolve({ elements: data.elements, upstream: label });
            }
          } catch (error) {
            console.log(
              `[DETOUR SCENE API] ${label} failed ${Date.now() - endpointStartedAt}ms · ${error instanceof Error ? error.message : "unknown"}`,
            );
            fail(label, error);
          }
        })();
      });
    },
  );
}

function ttlForFamily(family: SceneFamily) {
  return family === "food"
    ? { freshMs: FOOD_FRESH_MS, staleMs: FOOD_STALE_MS }
    : { freshMs: GENERAL_FRESH_MS, staleMs: GENERAL_STALE_MS };
}

async function storeCache(
  admin: ReturnType<typeof createClient>,
  descriptor: QueryDescriptor,
  elements: OverpassElement[],
  upstream: string,
) {
  const now = Date.now();
  const ttl = ttlForFamily(descriptor.family);

  const { error } = await admin
    .from("scene_discovery_cache")
    .upsert({
      cache_key: descriptor.cacheKey,
      query_version: QUERY_VERSION,
      family: descriptor.family,
      grid_lat_e3: descriptor.gridLatE3,
      grid_lon_e3: descriptor.gridLonE3,
      radius_m: descriptor.radius,
      elements,
      upstream,
      fetched_at: new Date(now).toISOString(),
      expires_at: new Date(now + ttl.freshMs).toISOString(),
      stale_until: new Date(now + ttl.staleMs).toISOString(),
      updated_at: new Date(now).toISOString(),
    }, { onConflict: "cache_key" });

  if (error) {
    throw new Error(`CACHE_WRITE:${error.message}`);
  }
}

async function refreshCache(
  admin: ReturnType<typeof createClient>,
  descriptor: QueryDescriptor,
  query: string,
) {
  const existing = refreshInFlight.get(descriptor.cacheKey);
  if (existing) return existing;

  const task = (async () => {
    try {
      const fresh = await fetchUpstream(query);
      await storeCache(admin, descriptor, fresh.elements, fresh.upstream);
      console.log(`[DETOUR SCENE API] refresh stored ${descriptor.cacheKey}`);
    } catch (error) {
      console.log(
        `[DETOUR SCENE API] refresh missed ${descriptor.cacheKey} · ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  })().finally(() => {
    refreshInFlight.delete(descriptor.cacheKey);
  });

  refreshInFlight.set(descriptor.cacheKey, task);
  return task;
}

function cacheResponse(
  row: CacheRow,
  status: "fresh" | "stale" | "neighbor",
) {
  const ageMs = Math.max(0, Date.now() - Date.parse(row.fetched_at));

  return json(
    {
      elements: row.elements,
      detourCache: {
        status,
        ageMs,
        upstream: row.upstream,
      },
    },
    200,
    {
      "X-Detour-Scene-Cache": status,
      "X-Detour-Scene-Age-Ms": String(ageMs),
    },
  );
}

async function findNearestUsableCache(
  admin: ReturnType<typeof createClient>,
  descriptor: QueryDescriptor,
) {
  const nowIso = new Date().toISOString();
  const minRadius = Math.max(100, Math.floor(descriptor.radius * 0.72));
  const maxRadius = Math.min(2000, Math.ceil(descriptor.radius * 1.35));

  const { data, error } = await admin
    .from("scene_discovery_cache")
    .select(
      "cache_key,family,grid_lat_e3,grid_lon_e3,radius_m,elements,upstream,fetched_at,expires_at,stale_until",
    )
    .eq("family", descriptor.family)
    .gte("radius_m", minRadius)
    .lte("radius_m", maxRadius)
    .gte("grid_lat_e3", descriptor.gridLatE3 - 2)
    .lte("grid_lat_e3", descriptor.gridLatE3 + 2)
    .gte("grid_lon_e3", descriptor.gridLonE3 - 2)
    .lte("grid_lon_e3", descriptor.gridLonE3 + 2)
    .gt("stale_until", nowIso)
    .order("fetched_at", { ascending: false })
    .limit(18);

  if (error || !Array.isArray(data) || data.length === 0) return null;

  const rows = data as CacheRow[];
  rows.sort((a, b) => {
    const gridA =
      (a.grid_lat_e3 - descriptor.gridLatE3) ** 2 +
      (a.grid_lon_e3 - descriptor.gridLonE3) ** 2;
    const gridB =
      (b.grid_lat_e3 - descriptor.gridLatE3) ** 2 +
      (b.grid_lon_e3 - descriptor.gridLonE3) ** 2;
    const radiusA = Math.abs(a.radius_m - descriptor.radius) / 250;
    const radiusB = Math.abs(b.radius_m - descriptor.radius) / 250;
    const scoreA = gridA + radiusA;
    const scoreB = gridB + radiusB;

    if (scoreA !== scoreB) return scoreA - scoreB;
    return Date.parse(b.fetched_at) - Date.parse(a.fetched_at);
  });

  return rows[0] ?? null;
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
  // Food must remain truthful: never fabricate a cafe/market. General moods can
  // use anonymous route anchors because their endpoint is intentionally hidden
  // and the arrival task is a portable visual prompt, not a POI claim.
  if (descriptor.family === "food") return [];

  const baseDistance = anchorDistanceForRadius(descriptor.radius);
  const baseBearing = Math.floor(Math.random() * 360);
  const bearingOffsets = [0, 180, 90, 270, 45, 225, 135, 315];
  const distanceScales = [1, 1, 0.96, 1.04, 0.9, 1.1, 0.94, 1.06];
  const idBase =
    1_700_000_000 +
    Math.abs(descriptor.gridLatE3 * 31 + descriptor.gridLonE3 * 17) % 100_000;

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
        error: "SCENE_UPSTREAM_UNAVAILABLE",
        detail: "No truthful food fallback is available without upstream data.",
      },
      503,
    );
  }

  console.log(
    `[DETOUR SCENE API] fail-open route anchors ${Date.now() - startedAt}ms · ${elements.length} anchors`,
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
    { "X-Detour-Scene-Cache": "generated" },
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

  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body?.mode === "health") {
        return json({
          ok: true,
          cache: "scene_discovery_cache",
          queryVersion: QUERY_VERSION,
          failOpen: true,
        });
      }
      return json({ error: "INVALID_PAYLOAD" }, 400);
    }

    const bodyText = await req.text();
    const query = new URLSearchParams(bodyText).get("data") ?? "";
    const descriptor = parseQueryDescriptor(query);

    if (!descriptor) {
      return json({ error: "INVALID_SCENE_QUERY" }, 400);
    }

    const admin = getAdminClient();

    if (admin) {
      const { data: exact, error: exactError } = await admin
        .from("scene_discovery_cache")
        .select(
          "cache_key,family,grid_lat_e3,grid_lon_e3,radius_m,elements,upstream,fetched_at,expires_at,stale_until",
        )
        .eq("cache_key", descriptor.cacheKey)
        .maybeSingle();

      if (exactError) {
        console.log(`[DETOUR SCENE API] cache read failed · ${exactError.message}`);
      } else if (exact) {
        const row = exact as CacheRow;
        const now = Date.now();

        if (Date.parse(row.expires_at) > now) {
          console.log(
            `[DETOUR SCENE API] fresh hit ${Date.now() - requestStartedAt}ms · ${descriptor.cacheKey}`,
          );
          return cacheResponse(row, "fresh");
        }

        if (Date.parse(row.stale_until) > now) {
          console.log(
            `[DETOUR SCENE API] stale hit ${Date.now() - requestStartedAt}ms · ${descriptor.cacheKey}`,
          );
          EdgeRuntime.waitUntil(refreshCache(admin, descriptor, query));
          return cacheResponse(row, "stale");
        }
      }

      const neighbor = await findNearestUsableCache(admin, descriptor);
      if (neighbor) {
        console.log(
          `[DETOUR SCENE API] neighbor fallback ${Date.now() - requestStartedAt}ms · ${neighbor.cache_key}`,
        );
        EdgeRuntime.waitUntil(refreshCache(admin, descriptor, query));
        return cacheResponse(neighbor, "neighbor");
      }
    } else {
      console.log("[DETOUR SCENE API] database admin key unavailable; using upstream/fail-open only");
    }

    try {
      const fresh = await fetchUpstream(query);

      if (admin) {
        try {
          await storeCache(admin, descriptor, fresh.elements, fresh.upstream);
        } catch (error) {
          console.log(
            `[DETOUR SCENE API] cache write failed · ${error instanceof Error ? error.message : "unknown"}`,
          );
        }
      }

      console.log(
        `[DETOUR SCENE API] cold success ${Date.now() - requestStartedAt}ms · ${fresh.upstream}`,
      );

      return json(
        {
          elements: fresh.elements,
          detourCache: {
            status: "miss",
            ageMs: 0,
            upstream: fresh.upstream,
          },
        },
        200,
        { "X-Detour-Scene-Cache": "miss" },
      );
    } catch (error) {
      console.log(
        `[DETOUR SCENE API] upstream unavailable ${Date.now() - requestStartedAt}ms · ${error instanceof Error ? error.message : "unknown"}`,
      );

      if (admin) {
        EdgeRuntime.waitUntil(refreshCache(admin, descriptor, query));
      }

      return generatedResponse(descriptor, requestStartedAt);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    console.log(
      `[DETOUR SCENE API] request failed ${Date.now() - requestStartedAt}ms · ${message}`,
    );

    return json(
      {
        error: "SCENE_GATEWAY_FAILED",
        detail: message.slice(0, 300),
      },
      500,
    );
  }
});
