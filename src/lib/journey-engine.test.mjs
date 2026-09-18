import assert from 'node:assert/strict';
import test from 'node:test';

import { getJourneyProfile, getSideEventCount } from './journey-engine.ts';

test('journey duration maps to the canonical target cadence', () => {
  assert.equal(getSideEventCount(10), 3);
  assert.equal(getSideEventCount(15), 3);
  assert.equal(getSideEventCount(20), 5);
  assert.equal(getSideEventCount(30), 7);
  assert.equal(getSideEventCount(45), 9);
  assert.equal(getSideEventCount(60), 10);
});

test('journey profile uses the same target cadence', () => {
  assert.equal(getJourneyProfile(10).sideEventCount, 3);
  assert.equal(getJourneyProfile(25).sideEventCount, 5);
  assert.equal(getJourneyProfile(35).sideEventCount, 7);
});
