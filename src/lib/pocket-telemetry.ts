import { DETOUR_API_CONFIG } from "./app-config";
import { postDetourJson } from "./api-client";
import { DETOUR_BUILD_VERSION } from "./build-info";
import type {
  Discovery,
  Environment,
} from "./pocket-engine";
import type { PocketRouteQualityMetrics } from "./pocket-route-quality";
import {
  aggregateDiscoveryTelemetry,
  type PocketDiscoveryObservation,
} from "./pocket-telemetry-core";
import {
  isRecord,
  isString,
  readStored,
  writeStored,
} from "./storage";
import { getPlaytestTesterId } from "./playtest-analytics";

const POCKET_TELEMETRY_KEY = "@detour/pocket-telemetry/v1";
const MAX_RUNS = 120;

export type PocketTelemetryStatus =
  | "active"
  | "completed"
  | "discarded";

export type PocketTelemetryRun = {
  id: string;
  startedAt: number;
  completedAt?: number;
  status: PocketTelemetryStatus;
  devMode: boolean;
  discoveries: PocketDiscoveryObservation[];
  swapCount: number;
  rerouteCount: number;
  photoCount?: number;
  foundCount?: number;
  actualDurationSeconds?: number;
  routeQuality?: PocketRouteQualityMetrics;
};

function isObservation(value: unknown): value is PocketDiscoveryObservation {
  if (!isRecord(value)) return false;
  return (
    isString(value.discoveryId) &&
    isString(value.difficulty) &&
    isString(value.kind) &&
    isString(value.environment) &&
    typeof value.shownAt === "number" &&
    (value.result === null ||
      value.result === "found" ||
      value.result === "skipped") &&
    (value.secondsVisible === null ||
      typeof value.secondsVisible === "number") &&
    typeof value.journeyElapsedSeconds === "number" &&
    typeof value.discoveryIndex === "number"
  );
}

function isRun(value: unknown): value is PocketTelemetryRun {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    typeof value.startedAt === "number" &&
    isString(value.status) &&
    typeof value.devMode === "boolean" &&
    Array.isArray(value.discoveries) &&
    value.discoveries.every(isObservation) &&
    typeof value.swapCount === "number" &&
    typeof value.rerouteCount === "number"
  );
}

function isRuns(value: unknown): value is PocketTelemetryRun[] {
  return Array.isArray(value) && value.every(isRun);
}

let queue = Promise.resolve();

async function loadRuns() {
  return (await readStored(POCKET_TELEMETRY_KEY, isRuns)) ?? [];
}

function enqueue(task: () => Promise<void>) {
  queue = queue
    .then(task)
    .catch(() => {
      // Telemetry must never block or surface an error in the Journey.
    });
  return queue;
}

async function saveRuns(runs: PocketTelemetryRun[]) {
  await writeStored(POCKET_TELEMETRY_KEY, runs.slice(0, MAX_RUNS));
}

function mutateRun(
  id: string,
  mutate: (run: PocketTelemetryRun) => PocketTelemetryRun,
) {
  return enqueue(async () => {
    const runs = await loadRuns();
    const index = runs.findIndex((run) => run.id === id);
    if (index < 0) return;
    const next = [...runs];
    next[index] = mutate(next[index]);
    await saveRuns(next);
  });
}

export function beginPocketTelemetryRun(input: {
  id: string;
  startedAt: number;
  devMode: boolean;
}) {
  return enqueue(async () => {
    const runs = await loadRuns();
    if (runs.some((run) => run.id === input.id)) return;
    const next: PocketTelemetryRun = {
      ...input,
      status: "active",
      discoveries: [],
      swapCount: 0,
      rerouteCount: 0,
    };
    await saveRuns([
      next,
      ...runs.filter((run) => run.id !== input.id),
    ]);
  });
}

export function recordPocketDiscoveryShown(input: {
  journeyId: string;
  target: Discovery;
  environment: Environment;
  shownAt: number;
  journeyStartedAt: number;
  discoveryIndex: number;
}) {
  return mutateRun(input.journeyId, (run) => {
    if (
      run.discoveries.some(
        (observation) =>
          observation.discoveryIndex === input.discoveryIndex,
      )
    )
      return run;

    const observation: PocketDiscoveryObservation = {
      discoveryId: input.target.id,
      difficulty: input.target.difficulty,
      kind: input.target.kind,
      environment: input.environment,
      shownAt: input.shownAt,
      result: null,
      secondsVisible: null,
      journeyElapsedSeconds: Math.max(
        0,
        Math.round((input.shownAt - input.journeyStartedAt) / 100) / 10,
      ),
      discoveryIndex: input.discoveryIndex,
    };

    return {
      ...run,
      discoveries: [...run.discoveries, observation],
    };
  });
}

export function resolvePocketDiscovery(input: {
  journeyId: string;
  discoveryIndex: number;
  result: "found" | "skipped";
  resolvedAt: number;
}) {
  return mutateRun(input.journeyId, (run) => {
    const discoveries = run.discoveries.map((observation) =>
      observation.discoveryIndex === input.discoveryIndex
        ? {
            ...observation,
            result: input.result,
            secondsVisible: Math.max(
              0,
              Math.round(
                ((input.resolvedAt - observation.shownAt) / 1000) * 10,
              ) / 10,
            ),
          }
        : observation,
    );
    return {
      ...run,
      discoveries,
      swapCount:
        run.swapCount + (input.result === "skipped" ? 1 : 0),
    };
  });
}

export function recordPocketReroute(journeyId: string) {
  return mutateRun(journeyId, (run) => ({
    ...run,
    rerouteCount: run.rerouteCount + 1,
  }));
}

async function syncPocketRun(run: PocketTelemetryRun) {
  const testerId = await getPlaytestTesterId();
  try {
    await postDetourJson(
      DETOUR_API_CONFIG.playtestEndpoint,
      {
        mode: "sync-pocket-run",
        appVersion: DETOUR_BUILD_VERSION,
        testerId,
        run: {
          ...run,
          discoverySummary: aggregateDiscoveryTelemetry(run.discoveries),
        },
      },
      5000,
    );
  } catch {
    // Local telemetry remains useful even when sync is unavailable.
  }
}

export function finalizePocketTelemetryRun(input: {
  journeyId: string;
  status: Exclude<PocketTelemetryStatus, "active">;
  completedAt: number;
  photoCount: number;
  foundCount: number;
  routeQuality: PocketRouteQualityMetrics;
  actualDurationSeconds: number;
}) {
  return enqueue(async () => {
    const runs = await loadRuns();
    const index = runs.findIndex((run) => run.id === input.journeyId);
    if (index < 0) return;
    const current = runs[index];
    const done: PocketTelemetryRun = {
      ...current,
      status: input.status,
      completedAt: input.completedAt,
      photoCount: input.photoCount,
      foundCount: input.foundCount,
      actualDurationSeconds: Math.max(
        0,
        Math.round(input.actualDurationSeconds),
      ),
      routeQuality: {
        ...input.routeQuality,
        rerouteCount: current.rerouteCount,
      },
    };
    const next = [...runs];
    next[index] = done;
    await saveRuns(next);
    void syncPocketRun(done);
  });
}

export async function loadPocketTelemetryRuns() {
  try {
    return await loadRuns();
  } catch {
    return [];
  }
}
