import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getDistanceInMeters,
  getRouteDistance,
  offsetPoint,
} from './geo-utils.ts';

test('distance is zero for the same point', () => {
  assert.equal(
    getDistanceInMeters(25.0478, 121.5319, 25.0478, 121.5319),
    0
  );
});

test('route distance sums each leg', () => {
  const points = [
    { latitude: 25.0478, longitude: 121.5319 },
    { latitude: 25.0488, longitude: 121.5319 },
    { latitude: 25.0498, longitude: 121.5319 },
  ];

  const distance = getRouteDistance(points);
  assert.ok(distance > 210 && distance < 230);
});

test('offsetPoint moves approximately the requested distance', () => {
  const start = { latitude: 25.0478, longitude: 121.5319 };
  const moved = offsetPoint(start, 100, 90);
  const distance = getDistanceInMeters(
    start.latitude,
    start.longitude,
    moved.latitude,
    moved.longitude
  );

  assert.ok(Math.abs(distance - 100) < 0.5);
});
