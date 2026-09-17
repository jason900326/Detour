import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const QUERY_LIMIT = 30;

type SearchBody = {
  mode?: "health";
  query?: string;
  latitude?: number;
  longitude?: number;
  limit?: number;
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: CORS_HEADERS,
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

function validCoordinate(value: unknown, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!isAuthorized(req)) return json({ error: "INVALID_API_KEY" }, 401);

  try {
    const body = await req.json() as SearchBody;
    if (body.mode === "health") {
      return json({ ok: true, source: "postgis-pois", provider: "overture" });
    }

    const query = body.query?.trim() ?? "";
    if (
      query.length < 1 ||
      query.length > 100 ||
      !validCoordinate(body.latitude, -90, 90) ||
      !validCoordinate(body.longitude, -180, 180)
    ) {
      return json({ error: "INVALID_POI_QUERY" }, 400);
    }

    const admin = getAdminClient();
    if (!admin) return json({ error: "POI_DATABASE_UNAVAILABLE" }, 503);

    const { data, error } = await admin.rpc("search_detour_pois", {
      p_query: query,
      p_lat: body.latitude,
      p_lon: body.longitude,
      p_limit: Math.max(1, Math.min(body.limit ?? QUERY_LIMIT, 50)),
    });

    if (error) {
      console.log(`[DETOUR POI API] search failed · ${error.message}`);
      return json({ error: "POI_SEARCH_FAILED" }, 503);
    }

    return json({
      results: Array.isArray(data) ? data : [],
      source: "poi-db",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    console.log(`[DETOUR POI API] request failed · ${detail}`);
    return json({ error: "POI_GATEWAY_FAILED" }, 500);
  }
});
