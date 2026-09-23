import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateDiscoveryQuality,
  aggregateDiscoveryTelemetry,
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
