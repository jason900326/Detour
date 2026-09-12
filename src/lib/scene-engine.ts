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
    ['bakery', 'confectionery', 'deli', 'pastry'].includes(
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
    ['park', 'garden'].includes(tags.leisure ?? '') &&
    Boolean(tags.name)
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

  // Never resurrect anonymous generic infrastructure as a destination.
  if (
    ['steps', 'footbridge', 'pedestrian'].includes(kind) &&
    !hasStrongIdentity(tags)
  ) {
    return null;
  }

  if (
    kind === 'historic' &&
    !hasStrongIdentity(tags)
  ) {
    return null;
  }

  // Visual objects can stand on their own even without a formal name.
  if (
    ['mural', 'street-art', 'artwork'].includes(kind)
  ) {
    return qualityScore >= 30
      ? 'primary'
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
      : qualityScore >= 20
        ? 'fallback'
        : null;
  }

  // Parks/gardens are explicitly fallback material: they keep the app
  // playable in sparse OSM areas, but should never outrank richer scenes.
  if (kind === 'green-space') {
    return Boolean(tags.name)
      ? 'fallback'
      : null;
  }

  if (qualityScore >= 24) {
    return 'primary';
  }

  if (qualityScore >= 16) {
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

function distanceProfile(
  minutes: number,
  distanceScale = 1
) {
  let profile: {
    ideal: number;
    max: number;
  };

  if (minutes <= 15) {
    profile = { ideal: 220, max: 390 };
  } else if (minutes <= 30) {
    profile = { ideal: 280, max: 470 };
  } else if (minutes <= 60) {
    profile = { ideal: 340, max: 550 };
  } else {
    profile = { ideal: 400, max: 630 };
  }

  return {
    ideal:
      profile.ideal * distanceScale,
    max:
      profile.max * distanceScale,
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

  if (distanceMeters > profile.max * 1.18) return -999;

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
      ? 700
      : 900;

  const around =
    `(around:${radius},${start.latitude},${start.longitude})`;

  if (moodId === 'food') {
    return `
[out:json][timeout:18];
(
  nwr${around}["amenity"="marketplace"]["name"];
  nwr${around}["amenity"~"restaurant|fast_food|cafe|food_court|ice_cream"]["name"];
  nwr${around}["shop"~"bakery|confectionery|deli|pastry"]["name"];
);
out center 100;
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
  nwr${around}["leisure"~"park|garden"]["name"];
  nwr${around}["historic"]["name"];
  nwr${around}["natural"="tree"]["heritage"];
  way${around}["highway"="steps"];
  way${around}["highway"~"footway|pedestrian|path"]["bridge"="yes"];
  way${around}["highway"="pedestrian"]["name"];
);
out center 100;
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
  const elements = await fetchOverpass(
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
    .slice(0, 24);
}

export function buildSceneArrivalMission(args: {
  scene: SceneCandidate;
  moodId: MoodId;
  context: LightContext;
}): Mission {
  const { scene, moodId } = args;

  if (moodId === 'quiet') {
    return {
      id: `scene-${scene.id}-quiet`,
      code: 'ARRIVAL · LISTEN',
      title: '先不要拍。',
      instruction:
        '站在公共可停留的位置，找出最近和最遠的兩個聲音。不要閉眼，也不用離開原地。',
      completion: '兩個聲音都能指出來，就完成。',
      photo: false,
      portable: true,
    };
  }

  if (moodId === 'weird') {
    return {
      id: `scene-${scene.id}-weird`,
      code: 'ARRIVAL · ODD DETAIL',
      title: '找它最不像自己的地方。',
      instruction:
        '只看公共可見範圍。找一個和這個 Scene 格格不入的細節，先猜它為什麼在這裡。',
      completion: '猜出一個理由，就完成。照片可拍可不拍。',
      photo: false,
      portable: true,
    };
  }

  if (scene.kind === 'mural' || scene.kind === 'street-art') {
    return {
      id: `scene-${scene.id}-mural`,
      code: 'ARRIVAL · COLOR TRACE',
      title: '不要拍整面。',
      instruction:
        '找作品裡最小但最搶眼的一塊顏色，讓它和旁邊真實街景同時留在畫面裡。',
      completion: '拍一張只有這兩個重點的照片。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'artwork') {
    return {
      id: `scene-${scene.id}-artwork`,
      code: 'ARRIVAL · WRONG SIDE',
      title: '換一個不正面的角度。',
      instruction:
        '沿公共可走範圍移動幾步，找到它輪廓變化最大的一個角度。',
      completion: '拍下那個角度。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'food' || scene.kind === 'market') {
    const foodDecision =
      foodDecisionLabel(scene.tags);

    return {
      id: `scene-${scene.id}-food`,
      code: 'ARRIVAL · DETOUR PICK',
      title: '今天就這裡。',
      instruction:
        `${scene.name} 是 DETOUR 幫你做的決定。這趟的答案是「${foodDecision}」。不要再打開地圖比較下一家；先走到店前或公開入口，看現場是不是正常營業。`,
      completion:
        `到達 ${scene.name}，就完成主線。你不用再決定「去哪裡吃」。`,
      photo: false,
      portable: true,
    };
  }

  if (scene.kind === 'historic') {
    return {
      id: `scene-${scene.id}-historic`,
      code: 'ARRIVAL · NEW / OLD',
      title: '找新東西碰到舊東西的地方。',
      instruction:
        '看管線、招牌、修補、門窗或材質。找一個明顯比主體更新的細節。',
      completion: '找到一個就完成；想留下就拍。',
      photo: false,
      portable: true,
    };
  }

  if (scene.kind === 'steps') {
    return {
      id: `scene-${scene.id}-steps`,
      code: 'ARRIVAL · REPEAT',
      title: '只看重複。',
      instruction:
        '不要急著走完整段階梯。站在公共安全位置，找一組重複線條或陰影。',
      completion: '拍一張讓重複變成主角的照片。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'footbridge') {
    return {
      id: `scene-${scene.id}-bridge`,
      code: 'ARRIVAL · CROSSING',
      title: '等一個東西穿過畫面。',
      instruction:
        '留在公共可走的位置，選一個固定背景，等一個移動物經過。',
      completion: '在它穿過背景時拍一張。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'viewpoint') {
    return {
      id: `scene-${scene.id}-view`,
      code: 'ARRIVAL · FRAME IT',
      title: '不要拍整片風景。',
      instruction:
        '先找一個很近的東西當前景，再用它框住遠方。',
      completion: '拍一張同時有近和遠的照片。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'public-bookcase') {
    return {
      id: `scene-${scene.id}-book`,
      code: 'ARRIVAL · ONE TITLE',
      title: '只找一個書名。',
      instruction:
        '不用翻書。從公共可看的書脊裡，找一個你完全沒預期會在這裡看到的書名。',
      completion: '記住那個書名；想留紀錄就拍。',
      photo: false,
      portable: true,
    };
  }

  if (scene.kind === 'heritage-tree') {
    return {
      id: `scene-${scene.id}-tree`,
      code: 'ARRIVAL · OLDER / NEWER',
      title: '讓老和新同框。',
      instruction:
        '找附近一個明顯比這棵樹新的城市物件。',
      completion: '把老樹和那個新物件放進同一張照片。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'culture') {
    return {
      id: `scene-${scene.id}-culture`,
      code: 'ARRIVAL · OUTSIDE CLUE',
      title: '先不要急著進去。',
      instruction:
        '只看外面和公共可見範圍。找一個細節，猜它裡面最可能在做什麼。',
      completion: '先猜一個答案，再看現場資訊驗證。',
      photo: false,
      portable: true,
    };
  }

  if (scene.kind === 'green-space') {
    return {
      id: `scene-${scene.id}-green`,
      code: 'ARRIVAL · EDGE',
      title: '不要走去正中央。',
      instruction:
        '沿公共路徑找這塊綠地和城市接壤最奇怪的一個邊界：牆、招牌、住宅、道路都算。',
      completion: '找到一個你覺得最有反差的邊界，就完成。',
      photo: false,
      portable: true,
    };
  }

  if (scene.kind === 'fountain') {
    return {
      id: `scene-${scene.id}-water`,
      code: 'ARRIVAL · WATER / HARD',
      title: '找水碰到硬東西的地方。',
      instruction:
        '不要拍完整噴泉。只找水和石頭、金屬或地面交界的一小塊。',
      completion: '拍下那個交界。',
      photo: true,
      portable: false,
    };
  }

  if (scene.kind === 'square' || scene.kind === 'pedestrian') {
    return {
      id: `scene-${scene.id}-flow`,
      code: 'ARRIVAL · FLOW',
      title: '找一條大家自然會走的線。',
      instruction:
        '站在邊緣，不擋路。看十秒，找出人或車最常穿過的一條路徑。',
      completion: '用手指出那條線，就完成；照片可選。',
      photo: false,
      portable: true,
    };
  }

  return {
    id: `scene-${scene.id}-arrival`,
    code: 'ARRIVAL',
    title: '到了。先看看這裡。',
    instruction:
      '只看公共可見範圍。找一個你原本不會注意的細節。',
    completion: '找到一個就完成。',
    photo: false,
    portable: true,
  };
}
