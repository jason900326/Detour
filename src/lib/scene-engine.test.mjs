import assert from 'node:assert/strict';
import test from 'node:test';

import { isUnsafeOrRestrictedScene } from './scene-safety.ts';

test('military and defense destinations are hard excluded', () => {
  const restrictedTags = [
    { name: '國防大學' },
    { name: '戰鬥機展示' },
    { name: 'National Defense University' },
    { landuse: 'military' },
    { military: 'airfield' },
    { historic: 'aircraft' },
  ];

  for (const tags of restrictedTags) {
    assert.equal(isUnsafeOrRestrictedScene(tags), true, JSON.stringify(tags));
  }
});

test('ordinary public destinations remain eligible for the safety gate', () => {
  assert.equal(
    isUnsafeOrRestrictedScene({
      name: '城市廣場',
      place: 'square',
    }),
    false
  );
});
