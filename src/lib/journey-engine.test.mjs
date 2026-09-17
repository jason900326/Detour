import assert from 'node:assert/strict';
import test from 'node:test';

import { getJourneyProfile, getSideEventCount } from './journey-engine.ts';

test('short journeys keep side events lightweight', () => {
  assert.equal(getSideEventCount(10), 1);
  assert.equal(getSideEventCount(15), 1);
  assert.equal(getSideEventCount(20), 2);
  assert.equal(getSideEventCount(30), 3);
  assert.equal(getSideEventCount(45), 4);
  assert.equal(getSideEventCount(60), 5);
});

test('journey profile uses the same reduced event budget', () => {
  assert.equal(getJourneyProfile(10).sideEventCount, 1);
  assert.equal(getJourneyProfile(25).sideEventCount, 2);
  assert.equal(getJourneyProfile(35).sideEventCount, 3);
});
