import test from 'node:test';
import assert from 'node:assert/strict';

import {
  closingRouteTargetDistanceMeters,
  closingStopPriority,
  isSpatiallyConsistentOffRouteSample,
  isTrustedV2GpsAccuracy,
  rubberBandCorrectionDegrees,
} from './v2-routing-policy.ts';

test('V2 rubber band bends toward the anchor gradually instead of snapping into a U-turn', () => {
  assert.equal(rubberBandCorrectionDegrees(90, 270), 75);
  assert.equal(rubberBandCorrectionDegrees(270, 90), 75);
  assert.equal(rubberBandCorrectionDegrees(350, 10), 20);
  assert.equal(rubberBandCorrectionDegrees(10, 350), -20);
});

test('V2 rubber band never exceeds its configured per-segment correction', () => {
  assert.equal(rubberBandCorrectionDegrees(0, 150, 60), 60);
  assert.equal(rubberBandCorrectionDegrees(180, 30, 60), -60);
});

test('V2 closing prefers places that are naturally easy to stop at', () => {
  assert.ok(closingStopPriority('green-space') < closingStopPriority('viewpoint'));
  assert.ok(closingStopPriority('square') < closingStopPriority('footbridge'));
  assert.ok(closingStopPriority('pedestrian') < closingStopPriority('unknown-kind'));
});


test('V2 early closing keeps enough route to taper toward the normal journey length', () => {
  assert.equal(closingRouteTargetDistanceMeters(8 * 60), 190);
  assert.ok(closingRouteTargetDistanceMeters(5 * 60) > 300);
  assert.ok(closingRouteTargetDistanceMeters(2 * 60) >= 450);
  assert.equal(closingRouteTargetDistanceMeters(10 * 60), 190);
});


test('V2 route progress only trusts sufficiently precise GPS samples', () => {
  assert.equal(isTrustedV2GpsAccuracy(5), true);
  assert.equal(isTrustedV2GpsAccuracy(60), true);
  assert.equal(isTrustedV2GpsAccuracy(61), false);
  assert.equal(isTrustedV2GpsAccuracy(null), false);
});


test('V2 reroute evidence must come from spatially consistent off-route samples', () => {
  const distanceMeters = (a, b) => Math.abs(a.latitude - b.latitude) * 111000;
  const first = { latitude: 25, longitude: 121 };
  const closeSecond = { latitude: 25.0003, longitude: 121 };
  const wildJump = { latitude: 25.002, longitude: 121 };

  assert.equal(
    isSpatiallyConsistentOffRouteSample({
      previous: null,
      current: first,
      distanceMeters,
    }),
    false
  );
  assert.equal(
    isSpatiallyConsistentOffRouteSample({
      previous: first,
      current: closeSecond,
      distanceMeters,
    }),
    true
  );
  assert.equal(
    isSpatiallyConsistentOffRouteSample({
      previous: first,
      current: wildJump,
      distanceMeters,
    }),
    false
  );
});
