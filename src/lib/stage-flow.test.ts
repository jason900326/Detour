import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ABANDONABLE_STAGES,
  STAGE_TRANSITIONS,
  canTransition,
} from './stage-flow.ts';

test('every stage has an explicit transition list', () => {
  assert.deepEqual(
    Object.keys(STAGE_TRANSITIONS).sort(),
    [
      'arrival',
      'boot',
      'developing',
      'finish',
      'journey',
      'mission',
      'mood',
      'onboarding',
      'passport',
      'passportDetail',
      'preparing',
      'ready',
      'sceneIssue',
      'settings',
      'time',
    ]
  );
});

test('core journey transitions are allowed', () => {
  assert.equal(canTransition('time', 'mood'), true);
  assert.equal(canTransition('mood', 'preparing'), true);
  assert.equal(canTransition('preparing', 'ready'), true);
  assert.equal(canTransition('ready', 'journey'), true);
  assert.equal(canTransition('journey', 'mission'), true);
  assert.equal(canTransition('arrival', 'developing'), true);
  assert.equal(canTransition('developing', 'finish'), true);
});

test('invalid jumps and stale recovery stage are rejected', () => {
  assert.equal(canTransition('time', 'finish'), false);
  assert.equal(canTransition('passportDetail', 'journey'), false);
  assert.equal(
    [...ABANDONABLE_STAGES].includes('sceneIssue'),
    true
  );
  assert.equal(
    [...ABANDONABLE_STAGES].includes(
      'recovery' as never
    ),
    false
  );
});
