import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSlowRouteArcWaypoints,
  chooseSlowWalkingRoute,
  chooseWalkingRouteForContext,
  measureLocalShortcutRatio,
  measureRouteSelfOverlapRatio,
  slowRouteMaximumSeconds,
  slowRouteTargetSeconds,
} from './routing-engine.ts';

const point = (latitude, longitude) => ({ latitude, longitude });

function route({
  distanceMeters,
  durationSeconds,
  unnamedDistanceRatio,
  turnCount = 2,
  localShortcutRatio = 1.05,
}) {
  return {
    coordinates: [point(25, 121), point(25.001, 121.001)],
    distanceMeters,
    durationSeconds,
    quality: {
      unnamedDistanceRatio,
      turnCount,
      localShortcutRatio,
    },
  };
}

test('local shortcut ratio catches an obvious two-leg triangle', () => {
  const direct = measureLocalShortcutRatio([
    point(25, 121),
    point(25.001, 121.001),
  ]);
  const dogLeg = measureLocalShortcutRatio([
    point(25, 121),
    point(25.001, 121),
    point(25.001, 121.001),
  ]);

  assert.equal(direct, 1);
  assert.ok(dogLeg > 1.39 && dogLeg < 1.44);
});

test('day profile keeps the normal shortest walking route', () => {
  const shortest = route({
    distanceMeters: 1000,
    durationSeconds: 700,
    unnamedDistanceRatio: 0.8,
  });
  const namedAlternative = route({
    distanceMeters: 1080,
    durationSeconds: 740,
    unnamedDistanceRatio: 0.08,
  });

  assert.equal(
    chooseWalkingRouteForContext([namedAlternative, shortest], 'day'),
    shortest
  );
});

test('night profile may take a small detour for a more legible route', () => {
  const shortest = route({
    distanceMeters: 1000,
    durationSeconds: 700,
    unnamedDistanceRatio: 0.82,
    turnCount: 8,
  });
  const namedAlternative = route({
    distanceMeters: 1070,
    durationSeconds: 750,
    unnamedDistanceRatio: 0.08,
    turnCount: 3,
  });

  assert.equal(
    chooseWalkingRouteForContext([shortest, namedAlternative], 'night'),
    namedAlternative
  );
});

test('night profile never buys legibility with an excessive detour', () => {
  const shortest = route({
    distanceMeters: 1000,
    durationSeconds: 700,
    unnamedDistanceRatio: 0.75,
  });
  const tooLong = route({
    distanceMeters: 1250,
    durationSeconds: 870,
    unnamedDistanceRatio: 0,
  });

  assert.equal(
    chooseWalkingRouteForContext([shortest, tooLong], 'night'),
    shortest
  );
});

test('slow route time budget ignores optional side events', () => {
  assert.equal(slowRouteTargetSeconds(15), 828);
  assert.equal(slowRouteMaximumSeconds(15), 945);
});

test('slow route arc creates two same-side waypoints instead of a turn-back point', () => {
  const start = point(25, 121);
  const destination = point(25, 121.012);
  const [first, second] = buildSlowRouteArcWaypoints(
    start,
    destination,
    1900,
    1
  );

  assert.ok(first.longitude > start.longitude);
  assert.ok(second.longitude > first.longitude);
  assert.ok(first.latitude > start.latitude);
  assert.ok(second.latitude > start.latitude);
});

test('self-overlap rejects a route that walks out and returns on itself', () => {
  const clean = Array.from({ length: 12 }, (_, index) =>
    point(25, 121 + index * 0.0003)
  );
  const outAndBack = [
    ...clean,
    ...clean.slice(1, -1).reverse(),
  ];

  assert.equal(measureRouteSelfOverlapRatio(clean), 0);
  assert.ok(measureRouteSelfOverlapRatio(outAndBack) > 0.08);
});

test('slow route falls back to direct when extension repeats streets', () => {
  const direct = route({
    distanceMeters: 900,
    durationSeconds: 650,
    unnamedDistanceRatio: 0.1,
  });
  direct.coordinates = Array.from({ length: 12 }, (_, index) =>
    point(25, 121 + index * 0.0003)
  );

  const repeated = route({
    distanceMeters: 1500,
    durationSeconds: 1050,
    unnamedDistanceRatio: 0.1,
  });
  repeated.coordinates = [
    ...direct.coordinates,
    ...direct.coordinates.slice(1, -1).reverse(),
  ];

  assert.equal(
    chooseSlowWalkingRoute({
      directRoute: direct,
      candidates: [repeated],
      targetSeconds: 1050,
      maximumSeconds: 1150,
      context: 'day',
    }),
    direct
  );
});
