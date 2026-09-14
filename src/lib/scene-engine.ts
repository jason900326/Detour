import type {
  GeoPoint,
  LightContext,
  Mission,
  MoodId,
} from './journey-engine';

import {
  getSceneFeedbackBias,
  type SceneFeedbackRecord,
} from './scene-feedback';

export type SceneKind =
  | 'mural'
  | 'street-art'
  | 'artwork'
  | 'statue'
  | 'historic'
  | 'market'
  | 'food'
  | 'square'
  | 'fountain'
  | 'public-bookcase'
  | 'viewpoint'
  | 'steps'
  | 'footbridge'
  | 'pedestrian'
  | 'heritage-tree'
  | 'culture'
  | 'green-space';

export type SceneCandidate = {
  id: string;
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  point: GeoPoint;
  kind: SceneKind;
  label: string;
  name: string;
  tags: Record<string, string>;
  straightDistanceMeters: number;
  score: number;
  qualityScore: number;
  tier: 'primary' | 'fallback';
  previouslyVisited: boolean;
  scoreReasons: string[];
};

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const OVERPASS_CACHE_TTL = 10 * 60 * 1000;
const overpassCache = new Map<string, { expiresAt: number; elements: OverpassElement[] }>();
const overpassInFlight = new Map<string, Promise<OverpassElement[]>>();

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceBetween(a: GeoPoint, b: GeoPoint) {
  const radius = 6371000;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function pointFromElement(element: OverpassElement): GeoPoint | null {
  if (
    typeof element.lat === 'number' &&
    typeof element.lon === 'number'
  ) {
    return {
      latitude: element.lat,
      longitude: element.lon,
    };
  }

  if (
    typeof element.center?.lat === 'number' &&
    typeof element.center?.lon === 'number'
  ) {
    return {
      latitude: element.center.lat,
      longitude: element.center.lon,
    };
  }

  return null;
}

function isReligious(tags: Record<string, string>) {
  return (
    tags.amenity === 'place_of_worship' ||
    tags.religion !== undefined ||
    ['temple', 'shrine', 'church', 'chapel', 'mosque'].includes(
      tags.building ?? ''
    ) ||
    ['wayside_shrine'].includes(tags.historic ?? '')
  );
}

function classifyScene(
  tags: Record<string, string>
): { kind: SceneKind; label: string } | null {
  if (isReligious(tags)) return null;

  if (tags.tourism === 'artwork') {
    const artworkType = tags.artwork_type ?? '';

    if (['statue', 'sculpture', 'bust'].includes(artworkType)) {
      return { kind: 'statue', label: '雕像' };
    }

    if (artworkType === 'mural') {
      return { kind: 'mural', label: '壁畫' };
    }

    if (
      artworkType === 'street_art' ||
      artworkType === 'graffiti' ||
      tags.artwork_subject === 'street_art'
    ) {
      return { kind: 'street-art', label: '街頭藝術' };
    }

    return { kind: 'artwork', label: '公共藝術' };
  }

  if (tags.amenity === 'marketplace') {
    return { kind: 'market', label: '市場' };
  }

  if (
    ['restaurant', 'fast_food', 'cafe', 'food_court', 'ice_cream'].includes(
      tags.amenity ?? ''
    ) ||
    ['bakery', 'confectionery', 'deli', 'pastry', 'beverages', 'coffee', 'tea'].includes(
      tags.shop ?? ''
    )
  ) {
    return { kind: 'food', label: '食物目的地' };
  }

  if (tags.amenity === 'public_bookcase') {
    return { kind: 'public-bookcase', label: '街頭書櫃' };
  }

  if (
    ['gallery', 'museum'].includes(tags.tourism ?? '') ||
    tags.amenity === 'arts_centre'
  ) {
    return { kind: 'culture', label: '文化空間' };
  }

  if (
    ['park', 'garden'].includes(tags.leisure ?? '')
  ) {
    return { kind: 'green-space', label: '綠地' };
  }

  if (tags.amenity === 'fountain') {
    return { kind: 'fountain', label: '噴泉' };
  }

  if (tags.tourism === 'viewpoint') {
    return { kind: 'viewpoint', label: '視野點' };
  }

  if (tags.place === 'square') {
    return { kind: 'square', label: '廣場' };
  }

  if (tags.natural === 'tree' && tags.heritage) {
    return { kind: 'heritage-tree', label: '老樹' };
  }

  if (tags.highway === 'steps') {
    return { kind: 'steps', label: '階梯' };
  }

  if (
    tags.bridge === 'yes' &&
    ['footway', 'pedestrian', 'path'].includes(tags.highway ?? '')
  ) {
    return { kind: 'footbridge', label: '人行橋' };
  }

  if (tags.highway === 'pedestrian') {
    return { kind: 'pedestrian', label: '步行街段' };
  }

  if (
    tags.historic === 'memorial' &&
    ['statue', 'sculpture', 'bust'].includes(tags.memorial ?? '')
  ) {
    return { kind: 'statue', label: '紀念雕像' };
  }

  if (
    tags.historic &&
    !['memorial', 'wayside_shrine'].includes(tags.historic)
  ) {
    return { kind: 'historic', label: '歷史痕跡' };
  }

  return null;
}

function hasStrongIdentity(
  tags: Record<string, string>
) {
  return Boolean(
    tags.name ||
      tags.image ||
      tags.wikimedia_commons ||
      tags.wikipedia ||
      tags.wikidata ||
      tags.artist_name ||
      tags.description ||
      tags.inscription ||
      tags.heritage
  );
}

function qualityScoreForScene(
  kind: SceneKind,
  tags: Record<string, string>
) {
  let score = 0;

  const intrinsic: Partial<Record<SceneKind, number>> = {
    mural: 42,
    'street-art': 42,
    artwork: 32,
    statue: 48,
    'public-bookcase': 30,
    market: 24,
    food: 22,
    fountain: 20,
    viewpoint: 20,
    historic: 18,
    square: 18,
    'heritage-tree': 26,
    steps: 8,
    footbridge: 10,
    pedestrian: 8,
    culture: 28,
    'green-space': 18,
  };

  score += intrinsic[kind] ?? 0;

  if (tags.name) score += 8;
  if (tags.image) score += 18;
  if (tags.wikimedia_commons) score += 16;
  if (tags.wikipedia || tags.wikidata) score += 12;
  if (tags.artist_name) score += 10;
  if (tags.heritage) score += 10;
  if (tags.description || tags.inscription) score += 6;
  if (tags.lit === 'yes') score += 3;

  return score;
}

function destinationTier(
  kind: SceneKind,
  tags: Record<string, string>,
  moodId: MoodId,
  qualityScore: number
): 'primary' | 'fallback' | null {
  // Food still must be a real identifiable food/market destination.
  if (moodId === 'food') {
    if (
      ['food', 'market'].includes(kind) &&
      Boolean(tags.name)
    ) {
      return qualityScore >= 30
        ? 'primary'
        : 'fallback';
    }

    return null;
  }

  // Discovery should be permissive. Anonymous public infrastructure is
  // fallback material rather than an automatic rejection; routing and the
  // public-access gates still decide whether it can become a real ticket.
  if (
    ['steps', 'footbridge', 'pedestrian'].includes(kind) &&
    !hasStrongIdentity(tags)
  ) {
    return 'fallback';
  }

  if (
    kind === 'historic' &&
    !hasStrongIdentity(tags)
  ) {
    return 'fallback';
  }

  // Visual objects can stand on their own even without a formal name.
  if (
    ['mural', 'street-art', 'artwork', 'statue'].includes(kind)
  ) {
    return qualityScore >= 30
      ? 'primary'
      : qualityScore >= 18
        ? 'fallback'
        : null;
  }

  // Named culture / markets / public bookcases / heritage objects are
  // strong enough to be primary at a slightly lower data threshold.
  if (
    [
      'culture',
      'market',
      'public-bookcase',
      'heritage-tree',
    ].includes(kind)
  ) {
    return qualityScore >= 26
      ? 'primary'
      : qualityScore >= 14
        ? 'fallback'
        : null;
  }

  // Parks/gardens are explicitly fallback material: they keep the app
  // playable in sparse OSM areas, but should never outrank richer scenes.
  if (kind === 'green-space') {
    return 'fallback';
  }

  if (qualityScore >= 24) {
    return 'primary';
  }

  if (qualityScore >= 10) {
    return 'fallback';
  }

  return null;
}

function generatedName(
  kind: SceneKind,
  tags: Record<string, string>
) {
  if (tags.name) return tags.name;

  switch (kind) {
    case 'mural':
      return '一面沒有名字的壁畫';
    case 'street-art':
      return '一件街頭作品';
    case 'artwork':
      return '一件公共藝術';
    case 'statue':
      return '一座沒有名字的雕像';
    case 'historic':
      return '一個舊城市痕跡';
    case 'market':
      return '一個市場邊緣';
    case 'food':
      return '一個食物目的地';
    case 'square':
      return '一個廣場';
    case 'fountain':
      return '一座噴泉';
    case 'public-bookcase':
      return '一個街頭書櫃';
    case 'viewpoint':
      return '一個視野點';
    case 'steps':
      return '一段階梯';
    case 'footbridge':
      return '一座人行橋';
    case 'pedestrian':
      return '一段步行街';
    case 'heritage-tree':
      return '一棵老樹';
    case 'culture':
      return '一個文化空間';
    case 'green-space':
      return '一塊有名字的綠地';
  }
}

function contextAllows(
  kind: SceneKind,
  context: LightContext,
  tags: Record<string, string>
) {
  if (context === 'day') return true;

  if (context === 'night') {
    if (
      [
        'historic',
        'statue',
        'viewpoint',
        'steps',
        'footbridge',
        'heritage-tree',
      ].includes(kind)
    ) {
      return tags.lit === 'yes';
    }

    if (kind === 'green-space') {
      return tags.lit === 'yes';
    }

    return [
      'mural',
      'street-art',
      'artwork',
      'market',
      'food',
      'square',
      'fountain',
      'pedestrian',
      'culture',
    ].includes(kind);
  }

  // Twilight: still allow broad scenes, but avoid obviously unlit access.
  if (
    ['steps', 'footbridge', 'viewpoint'].includes(kind) &&
    tags.lit === 'no'
  ) {
    return false;
  }

  return true;
}

function foodTimeFitScore(
  tags: Record<string, string>,
  minutes: number
) {
  const amenity = tags.amenity ?? '';
  const shop = tags.shop ?? '';

  let score = 0;

  if (minutes <= 15) {
    if (
      ['fast_food', 'ice_cream'].includes(
        amenity
      )
    ) {
      score += 30;
    }

    if (
      ['cafe'].includes(amenity) ||
      [
        'bakery',
        'pastry',
        'confectionery',
        'deli',
      ].includes(shop)
    ) {
      score += 24;
    }

    if (amenity === 'restaurant') {
      score -= 14;
    }

    if (tags.takeaway === 'yes') {
      score += 9;
    }
  } else if (minutes <= 30) {
    if (
      ['fast_food', 'cafe'].includes(
        amenity
      ) ||
      ['bakery', 'pastry', 'deli'].includes(
        shop
      )
    ) {
      score += 18;
    }

    if (amenity === 'restaurant') {
      score += 5;
    }
  } else {
    if (amenity === 'restaurant') {
      score += 22;
    }

    if (amenity === 'food_court') {
      score += 14;
    }

    if (tags.amenity === 'marketplace') {
      score += 10;
    }
  }

  if (tags.cuisine) {
    score += 8;
  }

  if (tags.opening_hours === '24/7') {
    score += 5;
  }

  return score;
}

function foodDecisionLabel(
  tags: Record<string, string>
) {
  const cuisineMap: Record<string, string> = {
    taiwanese: '台式',
    chinese: '中式',
    japanese: '日式',
    korean: '韓式',
    thai: '泰式',
    vietnamese: '越式',
    italian: '義式',
    pizza: '披薩',
    burger: '漢堡',
    noodle: '麵類',
    noodles: '麵類',
    coffee_shop: '咖啡',
    coffee: '咖啡',
    bakery: '烘焙',
    dessert: '甜點',
    ice_cream: '冰品',
    vegetarian: '蔬食',
    vegan: '純素',
  };

  const rawCuisine =
    tags.cuisine
      ?.split(/[;,]/)
      .map((value) => value.trim())
      .find(Boolean);

  if (
    rawCuisine &&
    cuisineMap[rawCuisine]
  ) {
    return cuisineMap[rawCuisine];
  }

  if (tags.shop === 'bakery') {
    return '烘焙';
  }

  if (
    ['pastry', 'confectionery'].includes(
      tags.shop ?? ''
    )
  ) {
    return '甜點';
  }

  if (tags.amenity === 'cafe') {
    return '咖啡店';
  }

  if (tags.amenity === 'fast_food') {
    return '快速吃點東西';
  }

  if (tags.amenity === 'ice_cream') {
    return '冰品';
  }

  if (tags.amenity === 'marketplace') {
    return '市場';
  }

  return '這間店';
}

function baseScore(kind: SceneKind, moodId: MoodId) {
  const base: Record<SceneKind, number> = {
    mural: 132,
    'street-art': 130,
    artwork: 118,
    statue: 138,
    historic: 92,
    market: 102,
    food: 96,
    square: 100,
    fountain: 96,
    'public-bookcase': 108,
    viewpoint: 96,
    steps: 94,
    footbridge: 98,
    pedestrian: 96,
    'heritage-tree': 94,
    culture: 108,
    'green-space': 72,
  };

  let score = base[kind];

  if (moodId === 'food') {
    if (kind === 'food') score += 80;
    else if (kind === 'market') score += 48;
    else if (kind === 'pedestrian') score += 12;
    else score -= 60;
  }

  if (moodId === 'quiet') {
    if (
      ['viewpoint', 'square', 'artwork', 'heritage-tree'].includes(kind)
    ) {
      score += 22;
    }

    if (['market', 'food'].includes(kind)) score -= 28;
  }

  if (moodId === 'weird') {
    if (
      [
        'mural',
        'street-art',
        'artwork',
        'statue',
        'steps',
        'footbridge',
        'fountain',
        'public-bookcase',
      ].includes(kind)
    ) {
      score += 26;
    }
  }

  if (moodId === 'surprise') {
    score += ((kind.length * 17) % 23) - 8;
  }

  return score;
}

function journeyTargetDistance(minutes: number) {
  const safeMinutes = Math.max(5, Math.min(90, Math.round(minutes / 5) * 5));

  if (safeMinutes <= 5) return 220;
  if (safeMinutes <= 10) return 420;
  if (safeMinutes <= 15) return 680;
  if (safeMinutes <= 30) return Math.round(680 + (safeMinutes - 15) * 28);
  if (safeMinutes <= 45) return Math.round(1100 + (safeMinutes - 30) * 22);
  if (safeMinutes <= 60) return Math.round(1430 + (safeMinutes - 45) * 18);
  return Math.round(1700 + (safeMinutes - 60) * (400 / 30));
}

function distanceProfile(
  minutes: number,
  distanceScale = 1
) {
  const routeTarget = journeyTargetDistance(minutes) * distanceScale;

  // OSM candidate distance is straight-line; walking route is normally longer.
  return {
    ideal: routeTarget * 0.74,
    max: routeTarget * 1.15,
  };
}

function scoreDistance(
  distanceMeters: number,
  minutes: number,
  distanceScale = 1
) {
  const profile = distanceProfile(
    minutes,
    distanceScale
  );

  // Candidate discovery should not reject a place just because the
  // straight-line estimate is imperfect. The routed-walk stage is the
  // authority on whether the trip actually fits the selected time.
  if (distanceMeters > profile.max * 1.55) return -999;

  if (distanceMeters < 55) return -34;

  const difference = Math.abs(
    distanceMeters - profile.ideal
  );

  return Math.max(-30, 26 - difference / 9);
}

function buildQuery(
  start: GeoPoint,
  moodId: MoodId
) {
  // The real walking limit is much smaller than discovery radius.
  // Food is especially dense in Taipei, so don't query unrelated
  // artwork/parks/steps that will be rejected by the food gate anyway.
  const radius =
    moodId === 'food'
      ? 1700
      : 1800;

  const around =
    `(around:${radius},${start.latitude},${start.longitude})`;

  if (moodId === 'food') {
    return `
[out:json][timeout:18];
(
  nwr${around}["amenity"="marketplace"]["name"];
  nwr${around}["amenity"~"restaurant|fast_food|cafe|food_court|ice_cream"]["name"];
  nwr${around}["shop"~"bakery|confectionery|deli|pastry|beverages|coffee|tea"]["name"];
);
out center 180;
`;
  }

  return `
[out:json][timeout:18];
(
  nwr${around}["tourism"="artwork"];
  nwr${around}["tourism"="viewpoint"];
  nwr${around}["place"="square"];
  nwr${around}["amenity"="marketplace"];
  nwr${around}["amenity"="fountain"];
  nwr${around}["amenity"="public_bookcase"];
  nwr${around}["tourism"~"gallery|museum"]["name"];
  nwr${around}["amenity"="arts_centre"]["name"];
  nwr${around}["leisure"~"park|garden"];
  nwr${around}["historic"];
  nwr${around}["historic"="memorial"]["memorial"~"statue|sculpture|bust"];
  nwr${around}["natural"="tree"]["heritage"];
  way${around}["highway"="steps"];
  way${around}["highway"~"footway|pedestrian|path"]["bridge"="yes"];
  way${around}["highway"="pedestrian"];
);
out center 180;
`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller =
    new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (
      controller.signal.aborted
    ) {
      throw new Error(
        'Scene request timed out'
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOverpass(query: string) {
  let lastError: unknown = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded;charset=UTF-8',
            Accept: 'application/json',
          },
          body: `data=${encodeURIComponent(query)}`,
        },
        21000
      );

      if (!response.ok) {
        throw new Error(`Overpass ${response.status}`);
      }

      const data = (await response.json()) as OverpassResponse;

      if (!Array.isArray(data.elements)) {
        throw new Error('Overpass response missing elements');
      }

      return data.elements;
    } catch (error) {
      lastError = error;
    }
  }

  if (
    lastError instanceof Error &&
    lastError.message ===
      'Scene request timed out'
  ) {
    throw new Error(
      'Scene 資料服務逾時，請再試一次。'
    );
  }

  throw new Error(
    'Scene 資料服務暫時沒有回應，請再試一次。'
  );
}


async function fetchOverpassCached(query: string) {
  const cached = overpassCache.get(query);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.elements;
  }

  const inFlight = overpassInFlight.get(query);
  if (inFlight) return inFlight;

  const request = fetchOverpass(query)
    .then((elements) => {
      overpassCache.set(query, {
        expiresAt: Date.now() + OVERPASS_CACHE_TTL,
        elements,
      });
      return elements;
    })
    .finally(() => {
      overpassInFlight.delete(query);
    });

  overpassInFlight.set(query, request);
  return request;
}

export function clearSceneDiscoveryCache() {
  overpassCache.clear();
  overpassInFlight.clear();
}

export async function findSceneCandidates(args: {
  start: GeoPoint;
  moodId: MoodId;
  context: LightContext;
  minutes: number;
  excludeSceneIds?: string[];
  hardExcludeSceneIds?: string[];
  feedback?: SceneFeedbackRecord[];
  distanceScale?: number;
}) {
  const elements = await fetchOverpassCached(
    buildQuery(args.start, args.moodId)
  );

  const excluded = new Set(args.excludeSceneIds ?? []);
  const hardExcluded = new Set(
    args.hardExcludeSceneIds ?? []
  );
  const seen = new Set<string>();
  const candidates: SceneCandidate[] = [];

  for (const element of elements) {
    const tags = element.tags ?? {};
    const point = pointFromElement(element);
    const classification = classifyScene(tags);

    if (!point || !classification) continue;

    const id = `${element.type}:${element.id}`;

    if (seen.has(id)) continue;
    seen.add(id);

    if (hardExcluded.has(id)) {
      continue;
    }

    const previouslyVisited = excluded.has(id);

    if (
      ['private', 'no'].includes(tags.access ?? '')
    ) {
      continue;
    }

    if (
      !contextAllows(
        classification.kind,
        args.context,
        tags
      )
    ) {
      continue;
    }

    // Food mode should actually lead to food / market scenes,
    // not randomly substitute a temple, park or generic landmark.
    if (
      args.moodId === 'food' &&
      !['food', 'market'].includes(classification.kind)
    ) {
      continue;
    }

    const straightDistanceMeters = distanceBetween(
      args.start,
      point
    );

    const distanceScore = scoreDistance(
      straightDistanceMeters,
      args.minutes,
      args.distanceScale ?? 1
    );

    if (distanceScore <= -900) continue;

    const qualityScore = qualityScoreForScene(
      classification.kind,
      tags
    );

    const tier = destinationTier(
      classification.kind,
      tags,
      args.moodId,
      qualityScore
    );

    if (!tier) {
      continue;
    }

    const reasons: string[] = [];
    const typeScore = baseScore(
      classification.kind,
      args.moodId
    );

    let score =
      typeScore +
      distanceScore +
      Math.round(qualityScore * 0.55);

    if (args.moodId === 'food') {
      const foodFit = foodTimeFitScore(
        tags,
        args.minutes
      );

      score += foodFit;

      if (foodFit > 0) {
        reasons.push(
          `TIME FIT +${foodFit}`
        );
      } else if (foodFit < 0) {
        reasons.push(
          `TIME FIT ${foodFit}`
        );
      }
    }

    if (tier === 'fallback') {
      score -= 38;
      reasons.push('FALLBACK');
    }

    if (previouslyVisited) {
      score -= 46;
      reasons.push('VISITED');
    }

    reasons.push(
      `TYPE ${Math.round(typeScore)}`
    );
    reasons.push(
      `QUALITY ${qualityScore}`
    );

    if (distanceScore >= 15) {
      reasons.push('DISTANCE FIT');
    } else if (distanceScore < 0) {
      reasons.push('DISTANCE PENALTY');
    }

    if (tags.name) {
      score += 4;
      reasons.push('NAMED');
    }

    if (tags.image || tags.wikimedia_commons) {
      score += 8;
      reasons.push('VISUAL DATA');
    }

    if (tags.lit === 'yes') {
      score += 6;
      reasons.push('LIT');
    }

    if (
      args.context === 'night' &&
      tags.lit === 'yes'
    ) {
      score += 12;
      reasons.push('NIGHT FIT');
    }

    const feedbackBias =
      getSceneFeedbackBias(
        id,
        args.feedback ?? []
      );

    if (feedbackBias !== 0) {
      score += feedbackBias;
      reasons.push(
        feedbackBias > 0
          ? `LEARNED +${feedbackBias}`
          : `LEARNED ${feedbackBias}`
      );
    }

    candidates.push({
      id,
      osmType: element.type,
      osmId: element.id,
      point,
      kind: classification.kind,
      label: classification.label,
      name: generatedName(classification.kind, tags),
      tags,
      straightDistanceMeters,
      score,
      qualityScore,
      tier,
      previouslyVisited,
      scoreReasons: reasons,
    });
  }

  return candidates
    .sort((a, b) => {
      if (a.tier !== b.tier) {
        return a.tier === 'primary'
          ? -1
          : 1;
      }

      return b.score - a.score;
    })
    .slice(0, 40);
}

export function buildSceneArrivalMission(args: {
  scene: SceneCandidate;
  moodId: MoodId;
  context: LightContext;
}): Mission {
  const { scene } = args;

  if (scene.kind === 'statue') {
    return {
      id: `scene-${scene.id}-statue`,
      code: 'ARRIVAL · DETAIL',
      title: '拍一個雕像細節。',
      instruction: '只選手上的東西、衣服紋路、底座文字或姿勢裡的一個，不用拍整尊。',
      completion: '照片裡只有一個清楚可辨的細節。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'mural' || scene.kind === 'street-art' || scene.kind === 'artwork') {
    return {
      id: `scene-${scene.id}-art`,
      code: 'ARRIVAL · ONE PART',
      title: '不要拍整個作品。',
      instruction: '找一個最清楚的顏色、形狀或材質細節，只拍那一小塊。',
      completion: '拍下一個你能直接指出的作品細節。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'food' || scene.kind === 'market') {
    return {
      id: `scene-${scene.id}-food`,
      code: 'ARRIVAL · PROOF',
      title: '拍下「到了」的證據。',
      instruction: `留在公開位置，把「${scene.name}」的店名、攤位名或入口標示拍進去；不用消費。`,
      completion: '照片裡看得到這個目的地的名稱或入口。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'public-bookcase') {
    return {
      id: `scene-${scene.id}-book`,
      code: 'ARRIVAL · ONE TITLE',
      title: '拍一個書名。',
      instruction: '不用翻書，只從公共可見的書脊或封面選一個清楚的書名。',
      completion: '照片裡讀得到一個書名。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'historic' || scene.kind === 'culture') {
    return {
      id: `scene-${scene.id}-culture`,
      code: 'ARRIVAL · ONE MARK',
      title: '拍一個這裡才有的標記。',
      instruction: '只看館外或公共可見範圍，找名稱、年份、符號、牌子或刻字中的一個。',
      completion: '拍下一個能辨認這個地方的文字或符號。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'heritage-tree') {
    return {
      id: `scene-${scene.id}-tree`,
      code: 'ARRIVAL · BARK',
      title: '拍一小塊樹皮。',
      instruction: '不用碰樹，也不要拍整棵；只取樹幹上一塊清楚的紋理。',
      completion: '照片裡看得到明確的樹皮紋理。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'fountain') {
    return {
      id: `scene-${scene.id}-water`,
      code: 'ARRIVAL · WATER EDGE',
      title: '拍水碰到邊緣的地方。',
      instruction: '只拍水和石頭、金屬或地面接觸的一小塊，不用拍完整噴泉。',
      completion: '照片裡同時有水和一個硬質邊緣。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'steps') {
    return {
      id: `scene-${scene.id}-steps`,
      code: 'ARRIVAL · LINES',
      title: '拍三條重複的線。',
      instruction: '留在安全位置，用階梯本身的邊緣完成，不必走完整段。',
      completion: '照片裡至少有三條重複線。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'footbridge') {
    return {
      id: `scene-${scene.id}-bridge`,
      code: 'ARRIVAL · LINE',
      title: '拍橋上最長的一條線。',
      instruction: '只在公共可走的位置找欄杆、地面或結構的一條長直線。',
      completion: '讓那條線從照片一側延伸到另一側。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'viewpoint') {
    return {
      id: `scene-${scene.id}-view`,
      code: 'ARRIVAL · NEAR / FAR',
      title: '拍一個近的，也留一個遠的。',
      instruction: '站在原地，把一個近處物件放在畫面下緣，遠方留在後面。',
      completion: '同一張照片裡明顯看得到近景和遠景。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'green-space') {
    return {
      id: `scene-${scene.id}-green`,
      code: 'ARRIVAL · GREEN',
      title: '拍一個綠色。',
      instruction: '不用走進草地；從公共路徑拍一個清楚的綠色物件或植物。',
      completion: '照片裡有一個明確的綠色主體。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'square' || scene.kind === 'pedestrian') {
    return {
      id: `scene-${scene.id}-shape`,
      code: 'ARRIVAL · SHAPE',
      title: '拍一個圓形。',
      instruction: '只看你站著就能安全看到的範圍；標誌、燈、蓋子或圖案都可以。',
      completion: '照片裡有一個清楚的圓形。',
      photo: true,
      portable: false,
    };
  }

  return {
    id: `scene-${scene.id}-arrival`,
    code: 'ARRIVAL · NUMBER',
    title: '拍一個數字。',
    instruction: '只看目的地外面或公共可見範圍；門牌、年份、標示或牌子上的數字都可以。',
    completion: '照片裡有一個讀得出的數字。',
    photo: true,
    portable: false,
  };
}
