import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateReroute } from './reroute-logic.ts';

test('reroute threshold is bounded by GPS accuracy and safe limits', () => {
  assert.equal(
    evaluateReroute({
      offRouteDistanceMeters: 50,
      gpsAccuracyMeters: 0,
      offRouteCount: 0,
      rerouteInFlight: false,
    }).thresholdMeters,
    45
  );
  assert.equal(
    evaluateReroute({
      offRouteDistanceMeters: 80,
      gpsAccuracyMeters: 100,
      offRouteCount: 0,
      rerouteInFlight: false,
    }).thresholdMeters,
    70
  );
});

test('reroute requires three consecutive off-route samples', () => {
  const input = {
    offRouteDistanceMeters: 50,
    gpsAccuracyMeters: 10,
    rerouteInFlight: false,
  };

  assert.equal(evaluateReroute({ ...input, offRouteCount: 0 }).shouldReroute, false);
  assert.equal(evaluateReroute({ ...input, offRouteCount: 1 }).shouldReroute, false);
  assert.equal(evaluateReroute({ ...input, offRouteCount: 2 }).shouldReroute, true);
});

test('on-route samples reset the counter and in-flight reroutes do not retrigger', () => {
  assert.deepEqual(
    evaluateReroute({
      offRouteDistanceMeters: 20,
      gpsAccuracyMeters: 10,
      offRouteCount: 2,
      rerouteInFlight: false,
    }),
    {
      thresholdMeters: 45,
      nextOffRouteCount: 0,
      shouldReroute: false,
    }
  );
  assert.equal(
    evaluateReroute({
      offRouteDistanceMeters: 50,
      gpsAccuracyMeters: 10,
      offRouteCount: 2,
      rerouteInFlight: true,
    }).shouldReroute,
    false
  );
});
