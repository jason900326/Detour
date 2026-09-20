import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chooseHybridRouteCandidate,
  getHybridDirectionCandidates,
} from './hybrid-detour/decision-engine.ts';

const point = (latitude, longitude) => ({ latitude, longitude });

function route(coordinates, distanceMeters = 120) {
  return {
    coordinates,
    distanceMeters,
    durationSeconds: 100,
  };
}

test('direction candidates keep three real options in a rotating order', () => {
  const candidates = getHybridDirectionCandidates({
    headingDegrees: 90,
    recentDirections: [],
    step: 0,
  });

  assert.deepEqual(
    candidates.map((candidate) => candidate.direction),
    ['straight', 'right', 'left']
  );
  assert.equal(candidates[1].bearingDegrees, 180);
});

test('route selection prefers a novel real route over a repeated one', () => {
  const oldRoute = [
    point(25, 121),
    point(25.0002, 121),
    point(25.0004, 121),
    point(25.0006, 121),
    point(25.0008, 121),
  ];
  const novelRoute = [
    point(25, 121),
    point(25, 121.0002),
    point(25, 121.0004),
    point(25, 121.0006),
    point(25, 121.0008),
  ];

  const decision = chooseHybridRouteCandidate({
    headingDegrees: 0,
    recentDirections: ['right'],
    recentRoutes: [oldRoute],
    step: 1,
    candidates: [
      {
        direction: 'right',
        bearingDegrees: 90,
        route: route(oldRoute),
      },
      {
        direction: 'left',
        bearingDegrees: 270,
        route: route(novelRoute),
      },
    ],
  });

  assert.ok(decision);
  assert.equal(decision.direction, 'left');
  assert.equal(decision.route.coordinates, novelRoute);
  assert.equal(decision.reason, 'avoid-repeat');
});

test('route selection can use the only available valid candidate', () => {
  const decision = chooseHybridRouteCandidate({
    headingDegrees: 0,
    recentDirections: ['right'],
    recentRoutes: [],
    step: 0,
    candidates: [
      {
        direction: 'right',
        bearingDegrees: 90,
        route: route([
          point(25, 121),
          point(25.0002, 121),
          point(25.0004, 121),
        ]),
      },
    ],
  });

  assert.ok(decision);
  assert.equal(decision.direction, 'right');
});
