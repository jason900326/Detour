import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chooseWalkingRouteForContext,
  measureLocalShortcutRatio,
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
