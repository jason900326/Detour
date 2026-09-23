import test from "node:test";
import assert from "node:assert/strict";
import {
  backtrackRatio,
  computePocketRouteQuality,
  currentJourneyOverlapRatio,
  recentJourneyOverlapRatio,
} from "./pocket-route-quality.ts";

const p = (longitude, latitude = 0) => ({ latitude, longitude });

test("a novel one-way trace reports high novelty and no self overlap", () => {
  const trace = [p(0), p(0.001), p(0.002), p(0.003), p(0.004)];
  const metrics = computePocketRouteQuality(trace, [], 2);
  assert.equal(metrics.novelStreetRatio, 1);
  assert.equal(metrics.currentJourneyOverlapRatio, 0);
  assert.equal(metrics.recentJourneyOverlapRatio, 0);
  assert.equal(metrics.backtrackRatio, 0);
  assert.equal(metrics.rerouteCount, 2);
});

test("walking back over the same line is detected as overlap and backtracking", () => {
  const trace = [p(0), p(0.001), p(0.002), p(0.001), p(0)];
  assert.ok(currentJourneyOverlapRatio(trace) > 0);
  assert.ok(backtrackRatio(trace) > 0.25);
});

test("recent journey overlap is based on proximity, not exact coordinate equality", () => {
  const recent = [[p(0), p(0.001), p(0.002), p(0.003)]];
  const nearby = [
    p(0, 0.00005),
    p(0.001, 0.00005),
    p(0.002, 0.00005),
    p(0.003, 0.00005),
  ];
  assert.ok(recentJourneyOverlapRatio(nearby, recent) > 0.9);
});
