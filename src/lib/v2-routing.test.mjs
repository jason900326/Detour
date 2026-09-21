import test from 'node:test';
import assert from 'node:assert/strict';

import {
  closingRouteTargetDistanceMeters,
  closingStopPriority,
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
