import { getSideEventCount, type MoodId } from './journey-engine';
import type { SceneCandidate } from './scene-engine';

export function moodHint(moodId: MoodId) {
  if (moodId === 'wander') return '不設目的，讓路線自己長出來。';
  if (moodId === 'food') return '讓 DETOUR 幫你決定去哪裡吃。';
  return '整趟只追同一個顏色。';
}

export function isDrinkLikeFoodCandidate(scene: SceneCandidate) {
  const amenity = scene.tags.amenity ?? '';
  const shop = scene.tags.shop ?? '';
  const cuisine = (scene.tags.cuisine ?? '').toLowerCase();

  return (
    amenity === 'cafe' ||
    ['beverages', 'coffee', 'tea'].includes(shop) ||
    /(bubble_tea|tea|coffee|juice|smoothie)/.test(cuisine)
  );
}

export function isMealFoodCandidate(scene: SceneCandidate) {
  return ['restaurant', 'fast_food', 'food_court'].includes(
    scene.tags.amenity ?? ''
  );
}

export function applyFoodDestinationWeight(candidates: SceneCandidate[]) {
  const preferDrink = Math.random() < 0.8;
  const preferred = candidates.filter((scene) =>
    preferDrink ? isDrinkLikeFoodCandidate(scene) : isMealFoodCandidate(scene)
  );

  if (preferred.length >= 3) return preferred;

  return [
    ...preferred,
    ...candidates.filter((scene) => !preferred.includes(scene)),
  ];
}

export function getFilmRollCapacity(minutes: number) {
  // A user may photograph every suggested target plus a couple of free/arrival
  // frames. The roll must never punish engaging with side events.
  return Math.min(12, Math.max(6, getSideEventCount(minutes) + 2));
}
