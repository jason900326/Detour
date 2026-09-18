import assert from 'node:assert/strict';
import test from 'node:test';

import { measureMovementSample } from './location-trace-logic.ts';

const point = { latitude: 25, longitude: 121 };
const distanceMeters = (_from, to) => to.distance;

test('movement policy ignores GPS jitter and implausible jumps', () => {
  assert.equal(
    measureMovementSample({
      previous: point,
      next: { ...point, distance: 3 },
      previousSampleAt: 0,
      sampleAt: 3000,
      distanceMeters,
    }),
    null
  );
  assert.equal(
    measureMovementSample({
      previous: point,
      next: { ...point, distance: 81 },
      previousSampleAt: 0,
      sampleAt: 3000,
      distanceMeters,
    }),
    null
  );
});

test('movement policy caps elapsed movement time per sample', () => {
  assert.deepEqual(
    measureMovementSample({
      previous: point,
      next: { ...point, distance: 20 },
      previousSampleAt: 0,
      sampleAt: 20000,
      distanceMeters,
    }),
    { movedMeters: 20, sampleSeconds: 10 }
  );
});
