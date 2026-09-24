import type {
  Difficulty,
  Discovery,
  Environment,
  ExperienceId,
} from "./pocket-content";
import type { DiscoveryRevealReason } from "./pocket-engine";
import type {
  DiscoveryPerformance,
  DiscoverySelectionLog,
  DiscoverySelectionReason,
} from "./pocket-discovery-selection";

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
  experienceId?: ExperienceId;
  repeatExposure?: boolean;
  actionType?: Discovery["actionType"];
  direction?: Discovery["direction"];
  role?: Discovery["role"];
  concept?: Discovery["concept"];
  roamGapSeconds?: number;
  roamGapMeters?: number;
  roamRevealReason?: DiscoveryRevealReason;
  selection?: DiscoverySelectionLog;
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
  byActionType: Record<string, DiscoveryAggregate>;
  actionSequence: string[];
  roaming: {
    count: number;
    averageSeconds: number | null;
    medianSeconds: number | null;
    averageMeters: number | null;
    revealReasonCounts: Record<string, number>;
    samples: Array<{
      discoveryIndex: number;
      seconds: number;
      meters: number | null;
      reason?: DiscoveryRevealReason;
    }>;
  };
};

export type DiscoveryQualitySignal = {
  discoveryId: string;
  shown: number;
  foundRate: number;
  skipRate: number;
  medianSeconds: number | null;
  environmentBreakdown: Record<string, DiscoveryAggregate>;
  repeatExposure: {
    count: number;
    rate: number;
  };
};

export type DiscoveryEnvironmentDifference = {
  discoveryId: string;
  environments: Record<string, DiscoveryAggregate>;
  foundRateSpread: number;
  skipRateSpread: number;
};

export type DiscoverySelectionAnalytics = {
  selectionReasonCounts: Record<DiscoverySelectionReason, number>;
  fallback: {
    count: number;
    rate: number;
  };
  skipRecovery: DiscoveryAggregate;
  hardAfterQuickFinds: DiscoveryAggregate;
  highestSkipRate: DiscoveryQualitySignal[];
  longestMedianSeconds: DiscoveryQualitySignal[];
  repeatedTooSoon: Array<{
    discoveryId: string;
    count: number;
    rate: number;
  }>;
  environmentDifferences: DiscoveryEnvironmentDifference[];
};

function roundedRatio(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function finiteSeconds(observations: PocketDiscoveryObservation[]) {
  return observations
    .map((observation) => observation.secondsVisible)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
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
  const seconds = finiteSeconds(observations);
  const medianSecondsVisible = median(seconds);
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

function byDiscovery(
  observations: PocketDiscoveryObservation[],
) {
  const buckets: Record<string, PocketDiscoveryObservation[]> = {};
  for (const observation of observations) {
    (buckets[observation.discoveryId] ??= []).push(observation);
  }
  return buckets;
}

export function aggregateDiscoveryTelemetry(
  observations: PocketDiscoveryObservation[],
): PocketDiscoverySummary {
  const roaming = observations.filter(
    (observation) =>
      typeof observation.roamGapSeconds === "number" &&
      Number.isFinite(observation.roamGapSeconds),
  );
  const roamSeconds = roaming.map((observation) => observation.roamGapSeconds!);
  const roamMeters = roaming
    .map((observation) => observation.roamGapMeters)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );
  const revealReasonCounts: Record<string, number> = {};
  for (const observation of roaming) {
    if (!observation.roamRevealReason) continue;
    revealReasonCounts[observation.roamRevealReason] =
      (revealReasonCounts[observation.roamRevealReason] ?? 0) + 1;
  }

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
    byActionType: grouped(
      observations,
      (observation) => observation.actionType ?? "unknown",
    ),
    actionSequence: observations.map(
      (observation) => observation.actionType ?? "unknown",
    ),
    roaming: {
      count: roaming.length,
      averageSeconds: roamSeconds.length
        ? Math.round(
            (roamSeconds.reduce((sum, value) => sum + value, 0) /
              roamSeconds.length) *
              10,
          ) / 10
        : null,
      medianSeconds: roamSeconds.length
        ? Math.round(median(roamSeconds)! * 10) / 10
        : null,
      averageMeters: roamMeters.length
        ? Math.round(
            (roamMeters.reduce((sum, value) => sum + value, 0) /
              roamMeters.length) *
              10,
          ) / 10
        : null,
      revealReasonCounts,
      samples: roaming.map((observation) => ({
        discoveryIndex: observation.discoveryIndex,
        seconds: Math.round(observation.roamGapSeconds! * 10) / 10,
        meters:
          typeof observation.roamGapMeters === "number" &&
          Number.isFinite(observation.roamGapMeters)
            ? Math.round(observation.roamGapMeters * 10) / 10
            : null,
        reason: observation.roamRevealReason,
      })),
    },
  };
}

/**
 * Historical selection input. These values are deliberately descriptive;
 * the selector applies only weak influence and ignores tiny samples.
 */
export function aggregateDiscoveryPerformance(
  observations: PocketDiscoveryObservation[],
): Record<string, DiscoveryPerformance> {
  return Object.fromEntries(
    Object.entries(byDiscovery(observations)).map(([discoveryId, rows]) => {
      const summary = aggregate(rows);
      return [
        discoveryId,
        {
          shown: summary.shownCount,
          found: summary.foundCount,
          skipped: summary.skippedCount,
          averageSeconds: summary.averageSecondsVisible ?? undefined,
          medianSeconds: summary.medianSecondsVisible ?? undefined,
        },
      ];
    }),
  );
}

/**
 * Content-quality signals intentionally stay descriptive. A high completion
 * percentage alone does not mean a discovery is good: Detour is trying to
 * create attention and curiosity, not optimize every prompt to be trivial.
 */
export function aggregateDiscoveryQuality(
  observations: PocketDiscoveryObservation[],
): Record<string, DiscoveryQualitySignal> {
  return Object.fromEntries(
    Object.entries(byDiscovery(observations)).map(([discoveryId, rows]) => {
      const overall = aggregate(rows);
      const repeated = rows.filter(
        (observation) => observation.repeatExposure === true,
      ).length;

      return [
        discoveryId,
        {
          discoveryId,
          shown: overall.shownCount,
          foundRate: overall.foundRate,
          skipRate: overall.skipRate,
          medianSeconds: overall.medianSecondsVisible,
          environmentBreakdown: grouped(
            rows,
            (observation) => observation.environment,
          ),
          repeatExposure: {
            count: repeated,
            rate: rows.length ? roundedRatio(repeated / rows.length) : 0,
          },
        },
      ];
    }),
  );
}

function rateRange(values: number[]) {
  if (values.length < 2) return 0;
  return Math.max(...values) - Math.min(...values);
}

function defaultReasonCounts(): Record<DiscoverySelectionReason, number> {
  return {
    "normal-selection": 0,
    "difficulty-recovery": 0,
    "skip-recovery": 0,
    "closing-light": 0,
    fallback: 0,
  };
}

/**
 * Pure playtest report over the complete candidate → selection → response
 * lifecycle. It exposes signals for inspection; it never removes or ranks
 * content automatically.
 */
export function analyzeDiscoverySelections(
  observations: PocketDiscoveryObservation[],
): DiscoverySelectionAnalytics {
  const quality = Object.values(aggregateDiscoveryQuality(observations));
  const withSelection = observations.filter(
    (observation) => observation.selection,
  );
  const reasonCounts = defaultReasonCounts();

  for (const observation of withSelection) {
    reasonCounts[observation.selection!.reason] += 1;
  }

  const fallbackCount = withSelection.filter(
    (observation) => observation.selection!.fallbackUsed,
  ).length;
  const skipRecoveryRows = observations.filter(
    (observation) => observation.selection?.reason === "skip-recovery",
  );
  const hardAfterQuickFindsRows = observations.filter(
    (observation) =>
      observation.difficulty === "hard" &&
      (observation.selection?.context.quickFindStreak ?? 0) >= 2,
  );

  const repeatedBuckets: Record<string, { count: number; shown: number }> = {};
  for (const observation of observations) {
    const state = (repeatedBuckets[observation.discoveryId] ??= {
      count: 0,
      shown: 0,
    });
    state.shown += 1;
    const recent =
      observation.selection?.context.recentlySeenIds.slice(-3) ?? [];
    if (recent.includes(observation.discoveryId)) state.count += 1;
  }

  const environmentDifferences = quality
    .flatMap((signal): DiscoveryEnvironmentDifference[] => {
      const values = Object.values(signal.environmentBreakdown);
      if (values.length < 2) return [];
      return [
        {
          discoveryId: signal.discoveryId,
          environments: signal.environmentBreakdown,
          foundRateSpread: roundedRatio(
            rateRange(values.map((value) => value.foundRate)),
          ),
          skipRateSpread: roundedRatio(
            rateRange(values.map((value) => value.skipRate)),
          ),
        },
      ];
    })
    .sort(
      (a, b) =>
        Math.max(b.foundRateSpread, b.skipRateSpread) -
        Math.max(a.foundRateSpread, a.skipRateSpread),
    );

  return {
    selectionReasonCounts: reasonCounts,
    fallback: {
      count: fallbackCount,
      rate: withSelection.length
        ? roundedRatio(fallbackCount / withSelection.length)
        : 0,
    },
    skipRecovery: aggregate(skipRecoveryRows),
    hardAfterQuickFinds: aggregate(hardAfterQuickFindsRows),
    highestSkipRate: [...quality].sort(
      (a, b) => b.skipRate - a.skipRate || b.shown - a.shown,
    ),
    longestMedianSeconds: [...quality].sort(
      (a, b) =>
        (b.medianSeconds ?? -1) - (a.medianSeconds ?? -1) ||
        b.shown - a.shown,
    ),
    repeatedTooSoon: Object.entries(repeatedBuckets)
      .map(([discoveryId, value]) => ({
        discoveryId,
        count: value.count,
        rate: value.shown
          ? roundedRatio(value.count / value.shown)
          : 0,
      }))
      .sort((a, b) => b.rate - a.rate || b.count - a.count),
    environmentDifferences,
  };
}
