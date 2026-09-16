import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contextCode,
  parseMinutes,
  ticketSerial,
} from './detour-formatters.ts';

test('parseMinutes handles normal, extended and empty values', () => {
  assert.equal(parseMinutes('15'), 15);
  assert.equal(parseMinutes('90+'), 90);
  assert.equal(parseMinutes(null), 0);
  assert.equal(parseMinutes('invalid'), 0);
});

test('ticketSerial remains stable for missing and selected values', () => {
  assert.equal(ticketSerial(null, null), 'DTR-00----');
  assert.equal(ticketSerial('90+', 'quiet'), 'DTR-90P-QUI');
});

test('contextCode maps light states to telemetry codes', () => {
  assert.equal(contextCode('day'), 'DAY');
  assert.equal(contextCode('twilight'), 'TWILIGHT');
  assert.equal(contextCode('night'), 'NIGHT');
  assert.equal(contextCode(null), 'AUTO');
});
