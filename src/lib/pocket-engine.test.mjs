import test from "node:test";
import assert from "node:assert/strict";
import {
  phaseAt,
  appendFix,
  nextDiscoveryRevealReason,
  shouldDiscardShortEmptyJourney,
  shouldRevealNextDiscovery,
} from "./pocket-engine.ts";

test("four early finds close gently without finishing; hard time cap always finishes", () => {
  assert.equal(phaseAt(300, 4), "closing");
  assert.equal(phaseAt(479, 3), "exploration");
  assert.equal(phaseAt(480, 3), "closing");
  assert.equal(phaseAt(600, 0), "closing");
  assert.equal(phaseAt(899, 5), "closing");
  assert.equal(phaseAt(900, 0), "finished");
});

test("GPS noise and teleportation do not contaminate the walked route", () => {
  const trace = [{ latitude: 25, longitude: 121 }];
  assert.equal(
    appendFix(trace, { latitude: 25.1, longitude: 121.1 }, 5, 4),
    trace,
  );
  assert.equal(
    appendFix(trace, { latitude: 25.0001, longitude: 121 }, 100, 4),
    trace,
  );
  assert.equal(
    appendFix(trace, { latitude: 25.00001, longitude: 121 }, 5, 4),
    trace,
  );
  assert.equal(
    appendFix(trace, { latitude: 25.0001, longitude: 121 }, 5, 4).length,
    2,
  );
});

test("short empty exits do not create souvenir tickets", () => {
  const base = { startedAt: 1_000, found: [], photos: [] };
  assert.equal(shouldDiscardShortEmptyJourney(base, 60_999), true);
  assert.equal(shouldDiscardShortEmptyJourney(base, 61_000), false);
  assert.equal(
    shouldDiscardShortEmptyJourney(
      { ...base, found: [{ id: "x" }] },
      20_000,
    ),
    false,
  );
  assert.equal(
    shouldDiscardShortEmptyJourney({ ...base, photos: ["photo.jpg"] }, 20_000),
    false,
  );
});


test("successful discovery waits before revealing the next paper", () => {
  const from = { latitude: 25, longitude: 121 };
  const base = {
    phase: "exploration",
    target: null,
    nextDiscoveryAt: 30_000,
    nextDiscoveryFrom: from,
    trace: [from],
    demo: false,
  };

  assert.equal(shouldRevealNextDiscovery(base, 29_999), false);
  assert.equal(shouldRevealNextDiscovery(base, 45_000), false);
  assert.equal(shouldRevealNextDiscovery(base, 65_000), true);
  assert.equal(nextDiscoveryRevealReason(base, 65_000), "timeout");
});

test("walking about 35 meters reveals the next paper after the minimum gap", () => {
  const from = { latitude: 25, longitude: 121 };
  const moved = { latitude: 25.00036, longitude: 121 };
  const journey = {
    phase: "exploration",
    target: null,
    nextDiscoveryAt: 30_000,
    nextDiscoveryFrom: from,
    trace: [from, moved],
    demo: false,
  };

  assert.equal(shouldRevealNextDiscovery(journey, 30_000), true);
  assert.equal(nextDiscoveryRevealReason(journey, 30_000), "distance");
});

test("roaming never reveals a second paper while one is already active", () => {
  const point = { latitude: 25, longitude: 121 };
  assert.equal(
    shouldRevealNextDiscovery(
      {
        phase: "exploration",
        target: { id: "active" },
        nextDiscoveryAt: 1,
        nextDiscoveryFrom: point,
        trace: [point],
        demo: false,
      },
      100_000,
    ),
    false,
  );
});

test("indoor demo can reveal after its shortened timer without movement", () => {
  const point = { latitude: 25, longitude: 121 };
  assert.equal(
    shouldRevealNextDiscovery(
      {
        phase: "exploration",
        target: null,
        nextDiscoveryAt: 3_000,
        nextDiscoveryFrom: point,
        trace: [point],
        demo: true,
      },
      3_000,
    ),
    true,
  );
  assert.equal(
    nextDiscoveryRevealReason(
      {
        phase: "exploration",
        target: null,
        nextDiscoveryAt: 3_000,
        nextDiscoveryFrom: point,
        trace: [point],
        demo: true,
      },
      3_000,
    ),
    "demo",
  );
});
