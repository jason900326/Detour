import test from 'node:test';
import assert from 'node:assert/strict';

import {
  chooseV2Target,
  shouldEnterV2Closing,
  shouldForceV2Finish,
  targetDifficultyForNext,
  replacementDifficultyForV2,
} from './v2-journey.ts';

test('V2 starts with an easy target and escalates only after the first finding', () => {
  assert.equal(targetDifficultyForNext({ discoveries: 0, lastTargetSeconds: null }), 'easy');
  assert.equal(targetDifficultyForNext({ discoveries: 1, lastTargetSeconds: 30 }), 'medium');
  assert.equal(targetDifficultyForNext({ discoveries: 2, lastTargetSeconds: 130 }), 'easy');
  assert.equal(
    targetDifficultyForNext({
      discoveries: 4,
      lastTargetSeconds: 20,
      lastTargetDifficulty: 'hard',
    }),
    'medium'
  );
});

test('V2 replacement never punishes the player with a harder target', () => {
  assert.equal(replacementDifficultyForV2('easy'), 'easy');
  assert.equal(replacementDifficultyForV2('medium'), 'medium');
  assert.equal(replacementDifficultyForV2('hard'), 'medium');
});

test('V2 target selection never repeats an excluded id or emoji when alternatives exist', () => {
  const first = chooseV2Target({ difficulty: 'easy', seed: 0 });
  const next = chooseV2Target({
    difficulty: 'easy',
    excludedIds: [first.id],
    excludedEmojis: [first.emoji],
    seed: 0,
  });

  assert.notEqual(next.id, first.id);
  assert.notEqual(next.emoji, first.emoji);
});

test('V2 environment data only weakly biases the eligible target pool', () => {
  const generic = chooseV2Target({ difficulty: 'easy', seed: 12 });
  const greenWeighted = chooseV2Target({
    difficulty: 'easy',
    environmentKinds: ['green-space'],
    seed: 12,
  });

  assert.equal(generic.id, 'cloud');
  assert.ok(['tree', 'flower', 'cloud', 'chair', 'shadow', 'plant'].includes(greenWeighted.id));
});

test('V2 enters closing after enough discoveries or at the ten-minute boundary', () => {
  assert.equal(shouldEnterV2Closing({ elapsedSeconds: 7 * 60, discoveries: 3 }), false);
  assert.equal(shouldEnterV2Closing({ elapsedSeconds: 8 * 60, discoveries: 3 }), true);
  assert.equal(shouldEnterV2Closing({ elapsedSeconds: 10 * 60, discoveries: 1 }), true);
});

test('V2 forced finish is a time limit, not a failure state', () => {
  assert.equal(shouldForceV2Finish(14 * 60 + 59), false);
  assert.equal(shouldForceV2Finish(15 * 60), true);
});
