import type {
  Difficulty,
  Environment,
} from "./pocket-engine";

export type PocketDiscoveryResult = "found" | "skipped" | null;

export type PocketDiscoveryObservation = {
  discoveryId: string;
  difficulty: Difficulty;
  kind: "object" | "feature" | "detail";
  environment: Environment;
  shownAt: number;
  result: PocketDiscoveryResult;
  secondsVisible: number | null;
  journeyElapsedSeconds: number;
  discoveryIndex: number;
};

export type DiscoveryAggregate = {
  shownCount: number;
  foundCount: number;
  skippedCount: number;
  foundRate: number;
  skipRate: number;
  averageSecondsVisible: number | null;
  medianSecondsVisible: number | null;
};

export type PocketDiscoverySummary = DiscoveryAggregate & {
  byEnvironment: Record<string, DiscoveryAggregate>;
  byJourneyPosition: Record<string, DiscoveryAggregate>;
};

function roundedRatio(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function aggregate(
  observations: PocketDiscoveryObservation[],
): DiscoveryAggregate {
  const foundCount = observations.filter(
    (observation) => observation.result === "found",
  ).length;
  const skippedCount = observations.filter(
    (observation) => observation.result === "skipped",
  ).length;
  const seconds = observations
    .map((observation) => observation.secondsVisible)
    .filter((value): value is number => Number.isFinite(value));
  const sorted = [...seconds].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const medianSecondsVisible = !sorted.length
    ? null
    : sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  const averageSecondsVisible = seconds.length
    ? seconds.reduce((sum, value) => sum + value, 0) / seconds.length
    : null;

  return {
    shownCount: observations.length,
    foundCount,
    skippedCount,
    foundRate: observations.length
      ? roundedRatio(foundCount / observations.length)
      : 0,
    skipRate: observations.length
      ? roundedRatio(skippedCount / observations.length)
      : 0,
    averageSecondsVisible:
      averageSecondsVisible === null
        ? null
        : Math.round(averageSecondsVisible * 10) / 10,
    medianSecondsVisible:
      medianSecondsVisible === null
        ? null
        : Math.round(medianSecondsVisible * 10) / 10,
  };
}

function grouped(
  observations: PocketDiscoveryObservation[],
  key: (observation: PocketDiscoveryObservation) => string,
) {
  const buckets: Record<string, PocketDiscoveryObservation[]> = {};
  for (const observation of observations) {
    const bucket = key(observation);
    (buckets[bucket] ??= []).push(observation);
  }
  return Object.fromEntries(
    Object.entries(buckets).map(([bucket, rows]) => [
      bucket,
      aggregate(rows),
    ]),
  );
}

export function aggregateDiscoveryTelemetry(
  observations: PocketDiscoveryObservation[],
): PocketDiscoverySummary {
  return {
    ...aggregate(observations),
    byEnvironment: grouped(
      observations,
      (observation) => observation.environment,
    ),
    byJourneyPosition: grouped(
      observations,
      (observation) => String(observation.discoveryIndex),
    ),
  };
}
