import type { GeoPoint, LightContext, MoodId } from './journey-engine';
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

export function ticketSerial(
  time: string | null,
  moodId: MoodId | null
) {
  const timeCode =
    time?.replace('+', 'P') ?? '00';

  const moodCode =
    moodId?.slice(0, 3).toUpperCase() ??
    '---';

  return `DTR-${timeCode}-${moodCode}`;
}

export function getFilmRollCapacity(_minutes: number) {
  // Every DETOUR keeps one small roll. Camera-first Side Quests plus the
  // arrival frame are designed to fit inside these six intentional photos.
  return 6;
}

export function parseMinutes(value: string | null) {
  if (!value) return 0;
  if (value === '90+') return 90;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function getRouteDistance(points: GeoPoint[]) {
  if (points.length < 2) return 0;

  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    total += getDistanceInMeters(
      points[index - 1].latitude,
      points[index - 1].longitude,
      points[index].latitude,
      points[index].longitude
    );
  }

  return total;
}

export function offsetPoint(
  point: GeoPoint,
  meters: number,
  bearingDegrees: number
): GeoPoint {
  const earthRadius = 6371000;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const latitude = (point.latitude * Math.PI) / 180;
  const longitude = (point.longitude * Math.PI) / 180;
  const angularDistance = meters / earthRadius;

  const nextLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) *
        Math.sin(angularDistance) *
        Math.cos(bearing)
  );

  const nextLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearing) *
        Math.sin(angularDistance) *
        Math.cos(latitude),
      Math.cos(angularDistance) -
        Math.sin(latitude) * Math.sin(nextLatitude)
    );

  return {
    latitude: (nextLatitude * 180) / Math.PI,
    longitude: (nextLongitude * 180) / Math.PI,
  };
}

export function formatPassportDate(iso: string) {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${month}.${day} · ${hour}:${minute}`;
}

export function formatClockTime(iso?: string) {
  if (!iso) return '—';

  const date = new Date(iso);
  const hour = String(
    date.getHours()
  ).padStart(2, '0');
  const minute = String(
    date.getMinutes()
  ).padStart(2, '0');

  return `${hour}:${minute}`;
}

export function contextCode(context: LightContext | null) {
  if (context === 'night') return 'NIGHT';
  if (context === 'twilight') return 'TWILIGHT';
  if (context === 'day') return 'DAY';
  return 'AUTO';
}
