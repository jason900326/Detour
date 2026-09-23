import test from "node:test";
import assert from "node:assert/strict";
import {
  phaseAt,
  appendFix,
  shouldDiscardShortEmptyJourney,
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
