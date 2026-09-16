import type { MoodId } from './journey-engine';
import type { SceneCandidate } from './scene-engine';

export function moodHint(moodId: MoodId) {
  if (moodId === 'wander') {
    return '不設目的，讓路線自己長出來。';
  }

  if (moodId === 'food') {
    return '讓 DETOUR 幫你決定去哪裡吃。';
  }

  if (moodId === 'quiet') {
    return '少一點聲音，留一點空白。';
  }

  if (moodId === 'weird') {
    return '去找平常會錯過的小東西。';
  }

  if (moodId === 'color') {
    return '整趟只追同一個顏色。';
  }

  if (moodId === 'slow') {
    return '你決定去哪，DETOUR 決定怎麼繞。';
  }

  return '今天的方向完全交給 DETOUR。';
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
  // Product rule: when both groups are healthy enough, Food mode chooses a
  // drink-like destination about 80% of the time and a meal about 20%.
  const preferDrink = Math.random() < 0.8;
  const preferred = candidates.filter((scene) =>
    preferDrink ? isDrinkLikeFoodCandidate(scene) : isMealFoodCandidate(scene)
  );

  // Keep route quality/safety first. If there are too few candidates in the
  // rolled category, fall back to the full qualified pool.
  if (preferred.length >= 3) return preferred;

  return [
    ...preferred,
    ...candidates.filter((scene) => !preferred.includes(scene)),
  ];
}

export function getFilmRollCapacity(_minutes: number) {
  // Every DETOUR keeps one small roll. Camera-first Side Quests plus the
  // arrival frame are designed to fit inside these six intentional photos.
  return 6;
}
