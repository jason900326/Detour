import test from 'node:test';
import assert from 'node:assert/strict';

import { buildShortRouteDestinations } from './v2-routing.ts';
import {
  bearingBetween,
  distanceBetween,
  signedAngle,
} from './navigation-engine.ts';

test('V2 rubber band bends a far-away route back gradually without demanding an immediate U-turn', () => {
  const start = { latitude: 25.033964, longitude: 121.564468 };
  const anchor = { latitude: 25.033964, longitude: 121.5582 };
  const previousBearing = 90;

  const destinations = buildShortRouteDestinations(
    start,
    42,
    previousBearing,
    anchor
  );

  const startDistance = distanceBetween(start, anchor);
  assert.equal(destinations.length, 4);
  assert.ok(
    destinations.some(
      (destination) => distanceBetween(destination, anchor) < startDistance
    )
  );
  assert.ok(
    destinations.some((destination) => {
      const bearing = bearingBetween(start, destination);
      return Math.abs(signedAngle(bearing - previousBearing)) <= 90;
    })
  );
});

test('V2 routing stays locally exploratory while still returning four short-route candidates', () => {
  const start = { latitude: 25.033964, longitude: 121.564468 };
  const nearbyAnchor = { latitude: 25.0341, longitude: 121.5645 };

  const destinations = buildShortRouteDestinations(start, 7, 35, nearbyAnchor);

  assert.equal(destinations.length, 4);
  for (const destination of destinations) {
    const distance = distanceBetween(start, destination);
    assert.ok(distance >= 145);
    assert.ok(distance <= 235);
  }
});
