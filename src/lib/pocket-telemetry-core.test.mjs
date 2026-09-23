import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateDiscoveryPerformance,
  aggregateDiscoveryQuality,
  aggregateDiscoveryTelemetry,
  analyzeDiscoverySelections,
} from "./pocket-telemetry-core.ts";

const row = (overrides = {}) => ({
  discoveryId: "door",
  difficulty: "easy",
  kind: "object",
  environment: "street",
  shownAt: 1_000,
  result: "found",
  secondsVisible: 20,
  journeyElapsedSeconds: 0,
  discoveryIndex: 1,
  ...overrides,
});

test("discovery aggregates expose shown/found/skip rates and timing", () => {
  const summary = aggregateDiscoveryTelemetry([
    row(),
    row({
      discoveryId: "reflection",
      environment: "commercial",
      result: "skipped",
      secondsVisible: 40,
      discoveryIndex: 2,
    }),
    row({
      discoveryId: "tree",
      environment: "green",
      secondsVisible: 30,
      discoveryIndex: 3,
    }),
  ]);

  assert.equal(summary.shownCount, 3);
  assert.equal(summary.foundCount, 2);
  assert.equal(summary.skippedCount, 1);
  assert.equal(summary.foundRate, 0.6667);
  assert.equal(summary.skipRate, 0.3333);
  assert.equal(summary.averageSecondsVisible, 30);
  assert.equal(summary.medianSecondsVisible, 30);
  assert.equal(summary.byEnvironment.street.foundRate, 1);
  assert.equal(summary.byEnvironment.commercial.skipRate, 1);
  assert.equal(summary.byJourneyPosition["2"].skippedCount, 1);
  assert.equal(summary.byActionType.unknown.shownCount, 3);
  assert.deepEqual(summary.actionSequence, ["unknown", "unknown", "unknown"]);
  assert.deepEqual(summary.roaming, {
    count: 0,
    averageSeconds: null,
    medianSeconds: null,
    averageMeters: null,
    revealReasonCounts: {},
    samples: [],
  });
});

test("unresolved shown targets count as shown without inventing an outcome", () => {
  const summary = aggregateDiscoveryTelemetry([
    row({ result: null, secondsVisible: null }),
  ]);
  assert.equal(summary.shownCount, 1);
  assert.equal(summary.foundCount, 0);
  assert.equal(summary.skippedCount, 0);
  assert.equal(summary.averageSecondsVisible, null);
});


test("discovery quality exposes repeat exposure and environment breakdown without ranking content", () => {
  const quality = aggregateDiscoveryQuality([
    row({
      discoveryId: "reflection",
      environment: "street",
      repeatExposure: false,
      secondsVisible: 18,
    }),
    row({
      discoveryId: "reflection",
      environment: "commercial",
      repeatExposure: true,
      result: "skipped",
      secondsVisible: 42,
    }),
    row({
      discoveryId: "door",
      environment: "street",
      repeatExposure: false,
      secondsVisible: 15,
    }),
  ]);

  assert.equal(quality.reflection.shown, 2);
  assert.equal(quality.reflection.foundRate, 0.5);
  assert.equal(quality.reflection.skipRate, 0.5);
  assert.equal(quality.reflection.medianSeconds, 30);
  assert.equal(quality.reflection.repeatExposure.count, 1);
  assert.equal(quality.reflection.repeatExposure.rate, 0.5);
  assert.equal(quality.reflection.environmentBreakdown.street.shownCount, 1);
  assert.equal(
    "score" in quality.reflection || "ranking" in quality.reflection,
    false,
  );
});


const selection = (overrides = {}) => ({
  selectedDiscoveryId: "door",
  timestamp: 1_000,
  context: {
    environment: "street",
    experienceId: "core",
    elapsedSeconds: 30,
    discoveryIndex: 2,
    phase: "exploration",
    previousResult: "found",
    previousSecondsVisible: 20,
    previousDifficulty: "easy",
    recentlySeenIds: ["number"],
    recentlyFoundIds: ["number"],
    quickFindStreak: 1,
  },
  candidates: [
    {
      id: "door",
      score: 1.5,
      weight: 1.5,
      scoreBreakdown: {
        base: 1,
        environment: 0.35,
        difficulty: 0.55,
        variety: 0.16,
        recency: 0,
        performance: 0,
        experience: 0,
        phase: 0,
        total: 2.06,
      },
    },
  ],
  reason: "normal-selection",
  fallbackUsed: false,
  randomValue: 0.2,
  difficultyRandomValue: 0.8,
  ...overrides,
});

test("historical discovery performance exposes stable selector inputs", () => {
  const performance = aggregateDiscoveryPerformance([
    row({ discoveryId: "door", result: "found", secondsVisible: 20 }),
    row({ discoveryId: "door", result: "skipped", secondsVisible: 40 }),
    row({ discoveryId: "tree", result: "found", secondsVisible: 30 }),
  ]);

  assert.deepEqual(performance.door, {
    shown: 2,
    found: 1,
    skipped: 1,
    averageSeconds: 30,
    medianSeconds: 30,
  });
});

test("selection analytics answer fallback, skip-recovery, quick-hard and recency questions", () => {
  const observations = [
    row({
      discoveryId: "door",
      selection: selection({
        selectedDiscoveryId: "door",
        fallbackUsed: true,
        reason: "fallback",
      }),
    }),
    row({
      discoveryId: "reflection",
      difficulty: "easy",
      result: "skipped",
      selection: selection({
        selectedDiscoveryId: "reflection",
        reason: "skip-recovery",
      }),
    }),
    row({
      discoveryId: "mural",
      difficulty: "hard",
      result: "found",
      selection: selection({
        selectedDiscoveryId: "mural",
        context: {
          ...selection().context,
          quickFindStreak: 2,
        },
      }),
    }),
    row({
      discoveryId: "door",
      environment: "commercial",
      result: "skipped",
      selection: selection({
        selectedDiscoveryId: "door",
        context: {
          ...selection().context,
          environment: "commercial",
          recentlySeenIds: ["tree", "door"],
        },
      }),
    }),
  ];

  const report = analyzeDiscoverySelections(observations);

  assert.equal(report.fallback.count, 1);
  assert.equal(report.fallback.rate, 0.25);
  assert.equal(report.skipRecovery.shownCount, 1);
  assert.equal(report.skipRecovery.skipRate, 1);
  assert.equal(report.hardAfterQuickFinds.shownCount, 1);
  assert.equal(report.hardAfterQuickFinds.foundRate, 1);
  assert.equal(
    report.repeatedTooSoon.find((item) => item.discoveryId === "door")?.count,
    1,
  );
  assert.ok(
    report.environmentDifferences.some(
      (item) => item.discoveryId === "door",
    ),
  );
});


test("discovery summary exposes mechanic mix and roaming gap timing", () => {
  const summary = aggregateDiscoveryTelemetry([
    row({
      discoveryId: "door",
      actionType: "find_one",
      roamGapSeconds: 28,
      roamGapMeters: 38,
      roamRevealReason: "distance",
    }),
    row({
      discoveryId: "old-new",
      actionType: "compare",
      roamGapSeconds: 60,
      roamGapMeters: 12,
      roamRevealReason: "timeout",
      discoveryIndex: 2,
    }),
    row({
      discoveryId: "pattern",
      actionType: "find_pattern",
      roamGapSeconds: 42,
      roamGapMeters: 31,
      roamRevealReason: "distance",
      discoveryIndex: 3,
    }),
  ]);

  assert.equal(summary.byActionType.find_one.shownCount, 1);
  assert.equal(summary.byActionType.compare.shownCount, 1);
  assert.equal(summary.byActionType.find_pattern.shownCount, 1);
  assert.equal(summary.roaming.count, 3);
  assert.equal(summary.roaming.averageSeconds, 43.3);
  assert.equal(summary.roaming.medianSeconds, 42);
  assert.equal(summary.roaming.averageMeters, 27);
  assert.deepEqual(summary.actionSequence, [
    "find_one",
    "compare",
    "find_pattern",
  ]);
  assert.deepEqual(summary.roaming.revealReasonCounts, {
    distance: 2,
    timeout: 1,
  });
  assert.deepEqual(summary.roaming.samples, [
    {
      discoveryIndex: 1,
      seconds: 28,
      meters: 38,
      reason: "distance",
    },
    {
      discoveryIndex: 2,
      seconds: 60,
      meters: 12,
      reason: "timeout",
    },
    {
      discoveryIndex: 3,
      seconds: 42,
      meters: 31,
      reason: "distance",
    },
  ]);
});
