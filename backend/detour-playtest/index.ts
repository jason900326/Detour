import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: CORS,
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
  const provided =
    req.headers.get("apikey") ?? "";

  return Object.values(
    getEnvKeyMap("SUPABASE_PUBLISHABLE_KEYS"),
  ).includes(provided);
}

function text(value: unknown, max = 160) {
  return typeof value === "string"
    ? value.slice(0, max)
    : null;
}

function int(value: unknown) {
  return Number.isFinite(Number(value))
    ? Math.round(Number(value))
    : null;
}

function bool(value: unknown) {
  return typeof value === "boolean"
    ? value
    : null;
}

function textArray(
  value: unknown,
  maxItems = 8,
) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string",
    )
    .slice(0, maxItems)
    .map((item) => item.slice(0, 80));
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeJson(value: unknown, fallback: unknown) {
  if (!value || typeof value !== "object") return fallback;
  return value;
}

function normalizePocket(body: any) {
  const testerId = text(body?.testerId, 40);
  const run = body?.run ?? {};
  const localRunId = text(run.id, 80);
  const status = text(run.status, 30);
  const startedAt = finiteNumber(run.startedAt);

  if (!testerId || !localRunId || !status || startedAt === null) {
    return null;
  }

  const routeQuality =
    safeJson(run.routeQuality, {}) as Record<string, unknown>;
  const discoveries = Array.isArray(run.discoveries)
    ? run.discoveries.slice(0, 40).map((item: any) => ({
        discoveryId: text(item?.discoveryId, 80),
        difficulty: text(item?.difficulty, 20),
        kind: text(item?.kind, 20),
        environment: text(item?.environment, 20),
        shownAt: finiteNumber(item?.shownAt),
        result:
          item?.result === "found" || item?.result === "skipped"
            ? item.result
            : null,
        secondsVisible: finiteNumber(item?.secondsVisible),
        journeyElapsedSeconds: finiteNumber(item?.journeyElapsedSeconds),
        discoveryIndex: int(item?.discoveryIndex),
      }))
    : [];

  const durationSeconds = int(run.actualDurationSeconds);
  return {
    tester_id: testerId,
    local_run_id: localRunId,
    created_at: new Date(startedAt).toISOString(),
    status,
    dev_mode: bool(run.devMode) ?? false,
    minutes: Math.max(1, Math.round((durationSeconds ?? 600) / 60)),
    mood_id: "pocket-v2",
    actual_duration_minutes:
      durationSeconds === null
        ? null
        : Math.max(0, Math.round(durationSeconds / 60)),
    reroute_count: int(run.rerouteCount) ?? int(routeQuality.rerouteCount) ?? 0,
    photo_count: int(run.photoCount),
    completed_at:
      finiteNumber(run.completedAt) === null
        ? null
        : new Date(Number(run.completedAt)).toISOString(),
    app_version: text(body?.appVersion, 40),
    pocket_discoveries: discoveries,
    discovery_summary: safeJson(run.discoverySummary, {}),
    route_quality: routeQuality,
    pocket_swap_count: int(run.swapCount) ?? 0,
  };
}

function normalize(body: any) {
  const testerId =
    text(body?.testerId, 40);

  const session =
    body?.session ?? {};

  const localRunId =
    text(session.id, 80);

  const status =
    text(session.status, 30);

  const minutes =
    int(session.minutes);

  const moodId =
    text(session.moodId, 40);

  if (
    !testerId ||
    !localRunId ||
    !status ||
    !minutes ||
    !moodId
  ) {
    return null;
  }

  const allowedRatings =
    new Set([
      "replay",
      "okay",
      "not-worth-it",
    ]);

  const rating =
    text(session.runRating, 30);

  return {
    tester_id: testerId,
    local_run_id: localRunId,
    created_at:
      text(session.createdAt, 80) ??
      new Date().toISOString(),
    status,
    dev_mode:
      bool(session.devMode) ??
      false,
    minutes,
    mood_id: moodId,
    light_context:
      text(session.lightContext, 40),
    scene_kind:
      text(session.sceneKind, 60),
    planned_distance_meters:
      int(session.plannedDistanceMeters),
    planned_duration_seconds:
      int(session.plannedDurationSeconds),
    actual_duration_minutes:
      int(session.actualDurationMinutes),
    side_missions_total:
      int(session.sideMissionsTotal),
    side_missions_completed:
      int(session.sideMissionsCompleted),
    side_missions_skipped:
      int(session.sideMissionsSkipped),
    arrival_result:
      text(session.arrivalResult, 30),
    reroute_count:
      int(session.rerouteCount) ??
      0,
    scene_failure_reasons:
      textArray(
        session.sceneFailureReasons
      ),
    photo_count:
      int(session.photoCount),
    failure_reason:
      text(session.failureReason, 160),
    ai_ranking_used:
      bool(session.aiRankingUsed),
    ai_mission_used:
      bool(session.aiMissionUsed),
    completed_at:
      text(session.completedAt, 80),
    app_version:
      text(body?.appVersion, 40),
    run_rating:
      rating &&
      allowedRatings.has(rating)
        ? rating
        : null,
    run_feedback_reasons:
      textArray(
        session.runFeedbackReasons,
        6
      ),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      { headers: CORS },
    );
  }

  if (req.method !== "POST") {
    return json(
      { error: "METHOD_NOT_ALLOWED" },
      405,
    );
  }

  if (!isAuthorized(req)) {
    return json(
      { error: "INVALID_API_KEY" },
      401,
    );
  }

  try {
    const body =
      await req.json();

    if (body?.mode === "health") {
      return json({ ok: true });
    }

    if (
      body?.mode !== "sync-run" &&
      body?.mode !== "sync-pocket-run"
    ) {
      return json(
        { error: "UNKNOWN_MODE" },
        400,
      );
    }

    const row =
      body?.mode === "sync-pocket-run"
        ? normalizePocket(body)
        : normalize(body);

    if (!row) {
      return json(
        { error: "INVALID_PAYLOAD" },
        400,
      );
    }

    const url =
      Deno.env.get("SUPABASE_URL") ??
      "";

    const secrets =
      getEnvKeyMap(
        "SUPABASE_SECRET_KEYS"
      );

    const secretKey =
      secrets.default ??
      Object.values(secrets)[0] ??
      "";

    if (!url || !secretKey) {
      return json(
        {
          error:
            "SERVER_DATABASE_KEY_MISSING",
        },
        503,
      );
    }

    const admin =
      createClient(
        url,
        secretKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      );

    const { error } =
      await admin
        .from("playtest_runs")
        .upsert(
          row,
          {
            onConflict:
              "tester_id,local_run_id",
          },
        );

    if (error) {
      console.error(error);

      return json(
        {
          error:
            "DATABASE_WRITE_FAILED",
          detail: error.message,
        },
        500,
      );
    }

    return json({ ok: true });
  } catch (error) {
    console.error(error);

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "UNKNOWN_ERROR",
      },
      500,
    );
  }
});
