import test from "node:test";
import assert from "node:assert/strict";
import { phaseAt } from "./pocket-engine.ts";
import {
  chooseDiscovery,
  DISCOVERIES,
} from "./pocket-content.ts";
import {
  isImmediatePocketUTurn,
  rankPocketPlaces,
} from "./pocket-routing-policy.ts";

const point = (latitude, longitude) => ({ latitude, longitude });
const start = point(25, 121);

test("journey remains exploratory after three quick early discoveries", () => {
  assert.equal(phaseAt(120, 3), "exploration");
});

test("journey enters closing around eight minutes with three discoveries", () => {
  assert.equal(phaseAt(490, 3), "closing");
});

test("ten minutes closes even with fewer discoveries and fifteen minutes finishes", () => {
  assert.equal(phaseAt(600, 1), "closing");
  assert.equal(phaseAt(900, 1), "finished");
});

test("difficulty recovers after a slow target and can rise after fast finds", () => {
  const medium = DISCOVERIES.find((item) => item.difficulty === "medium");
  assert.ok(medium);
  const slow = { ...medium, foundAt: 1, seconds: 130 };
  assert.equal(
    chooseDiscovery([slow], [medium.id], "street", () => 0).difficulty,
    "easy",
  );

  const easy = DISCOVERIES.find((item) => item.difficulty === "easy");
  assert.ok(easy);
  const fast = { ...easy, foundAt: 1, seconds: 20 };
  const next = chooseDiscovery(
    [fast, fast],
    [easy.id],
    "street",
    () => 0,
  );
  assert.equal(next.difficulty, "hard");
});

test("skip can always recover to a different available target", () => {
  const first = chooseDiscovery([], [], "street", () => 0);
  const replacement = chooseDiscovery([], [first.id], "street", () => 0);
  assert.notEqual(replacement.id, first.id);
});

test("routing ranking avoids a strong immediate U-turn when alternatives exist", () => {
  const trace = [
    point(25, 121),
    point(25, 121.0005),
    point(25, 121.001),
  ];
  const current = trace.at(-1);
  const ahead = {
    point: point(25, 121.0023),
    name: "ahead",
    stop: false,
    environment: "street",
  };
  const behind = {
    point: point(25, 120.9997),
    name: "behind",
    stop: false,
    environment: "street",
  };
  const ranked = rankPocketPlaces(
    [behind, ahead],
    current,
    trace[0],
    trace,
    false,
    120,
    () => 0,
  );
  assert.equal(ranked[0].name, "ahead");
});

test("closing only considers places that are valid stops", () => {
  const candidates = [
    {
      point: point(25.001, 121),
      name: "ordinary street",
      stop: false,
      environment: "street",
    },
    {
      point: point(25.0012, 121),
      name: "small square",
      stop: true,
      environment: "street",
    },
  ];
  const ranked = rankPocketPlaces(
    candidates,
    start,
    start,
    [start],
    true,
    600,
    () => 0,
  );
  assert.deepEqual(ranked.map((place) => place.name), ["small square"]);
});

test("the U-turn rule rejects a route that immediately reverses the walked heading", () => {
  const previous = point(25, 121);
  const current = point(25, 121.001);
  const behind = point(25, 120.9998);
  const ahead = point(25, 121.002);
  assert.equal(isImmediatePocketUTurn(previous, current, behind), true);
  assert.equal(isImmediatePocketUTurn(previous, current, ahead), false);
});
