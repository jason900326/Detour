export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type MoodId =
  | 'wander'
  | 'camera'
  | 'food'
  | 'quiet'
  | 'weird'
  | 'surprise';

export type Mission = {
  code: string;
  title: string;
  instruction: string;
  playability: number;
};

export type PlaceCandidate = GeoPoint & {
  id: string;
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  name: string;
  category: string;
  categoryCode: string;
  categoryFamily: string;
  distanceMeters: number;
  baseScore: number;
  score: number;
  baseReason: string;
  reason: string;
  mission: Mission;
  known: boolean;
  selected: boolean;
};

export type DetourCheckpoint = GeoPoint & {
  id: number;
  placeId: string;
  placeName: string;
  category: string;
  categoryCode: string;
  reason: string;
  title: string;
  note: string;
  missionCode: string;
  missionTitle: string;
  mission: string;
  cameraPrompt: string;
  defaultPrompt: string;
};

export type DetourEngineResult = {
  candidates: PlaceCandidate[];
  selectedCandidates: PlaceCandidate[];
  checkpoints: DetourCheckpoint[];
  radiusMeters: number;
  source: 'OpenStreetMap';
};

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: Record<string, string>;
};

type RawPlace = GeoPoint & {
  id: string;
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  name: string;
  category: string;
  categoryCode: string;
  categoryFamily: string;
  distanceMeters: number;
  tags: Record<string, string>;
};

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

const CATEGORY_BASE_SCORE: Record<string, number> = {
  artwork: 82,
  viewpoint: 80,
  monument: 78,
  memorial: 76,
  ruins: 84,
  archaeological_site: 84,
  wayside_shrine: 80,
  garden: 66,
  park: 48,
  marketplace: 74,
  food_court: 61,
  fountain: 67,
  square: 70,
  named_tree: 64,
  library: 72,
  community_centre: 67,
  public_bookcase: 81,
  place_of_worship: 68,
  pedestrian_street: 73,
};

const CATEGORY_FAMILY: Record<string, string> = {
  artwork: 'visual',
  fountain: 'visual',
  viewpoint: 'view',
  monument: 'history',
  memorial: 'history',
  ruins: 'history',
  archaeological_site: 'history',
  wayside_shrine: 'faith',
  place_of_worship: 'faith',
  garden: 'green',
  park: 'green',
  named_tree: 'green',
  marketplace: 'life',
  food_court: 'life',
  library: 'civic',
  community_centre: 'civic',
  public_bookcase: 'civic',
  square: 'urban',
  pedestrian_street: 'urban',
};

const MOOD_BONUS: Record<MoodId, Record<string, number>> = {
  wander: {
    artwork: 15,
    viewpoint: 10,
    monument: 13,
    memorial: 12,
    ruins: 20,
    archaeological_site: 20,
    wayside_shrine: 18,
    garden: 8,
    park: 2,
    marketplace: 15,
    food_court: 6,
    fountain: 8,
    square: 18,
    named_tree: 7,
    library: 9,
    community_centre: 13,
    public_bookcase: 22,
    place_of_worship: 12,
    pedestrian_street: 22,
  },
  camera: {
    artwork: 30,
    viewpoint: 26,
    monument: 19,
    memorial: 15,
    ruins: 24,
    archaeological_site: 22,
    wayside_shrine: 20,
    garden: 14,
    park: 2,
    marketplace: 16,
    food_court: 5,
    fountain: 14,
    square: 15,
    named_tree: 13,
    library: 10,
    community_centre: 9,
    public_bookcase: 19,
    place_of_worship: 14,
    pedestrian_street: 20,
  },
  food: {
    artwork: 2,
    viewpoint: 0,
    monument: 0,
    memorial: 0,
    ruins: 0,
    archaeological_site: 0,
    wayside_shrine: 2,
    garden: 0,
    park: -7,
    marketplace: 38,
    food_court: 36,
    fountain: 0,
    square: 10,
    named_tree: -4,
    library: -5,
    community_centre: 3,
    public_bookcase: -5,
    place_of_worship: 0,
    pedestrian_street: 15,
  },
  quiet: {
    artwork: 5,
    viewpoint: 22,
    monument: 9,
    memorial: 12,
    ruins: 12,
    archaeological_site: 12,
    wayside_shrine: 10,
    garden: 25,
    park: 16,
    marketplace: -24,
    food_court: -24,
    fountain: 12,
    square: 5,
    named_tree: 20,
    library: 28,
    community_centre: 4,
    public_bookcase: 20,
    place_of_worship: 10,
    pedestrian_street: 5,
  },
  weird: {
    artwork: 31,
    viewpoint: 8,
    monument: 18,
    memorial: 15,
    ruins: 30,
    archaeological_site: 27,
    wayside_shrine: 28,
    garden: 4,
    park: -12,
    marketplace: 11,
    food_court: 1,
    fountain: 19,
    square: 8,
    named_tree: 23,
    library: 5,
    community_centre: 14,
    public_bookcase: 34,
    place_of_worship: 13,
    pedestrian_street: 20,
  },
  surprise: {
    artwork: 17,
    viewpoint: 15,
    monument: 15,
    memorial: 14,
    ruins: 19,
    archaeological_site: 19,
    wayside_shrine: 18,
    garden: 10,
    park: 2,
    marketplace: 15,
    food_court: 9,
    fountain: 14,
    square: 17,
    named_tree: 12,
    library: 12,
    community_centre: 13,
    public_bookcase: 25,
    place_of_worship: 11,
    pedestrian_street: 19,
  },
};

const CATEGORY_LABEL: Record<string, string> = {
  artwork: '公共藝術',
  viewpoint: '觀景點',
  monument: '紀念物',
  memorial: '歷史痕跡',
  ruins: '遺構',
  archaeological_site: '歷史遺址',
  wayside_shrine: '街角信仰',
  garden: '庭園',
  park: '公園',
  marketplace: '市場',
  food_court: '飲食空間',
  fountain: '噴泉',
  square: '廣場',
  named_tree: '老樹 / 特殊樹木',
  library: '圖書館',
  community_centre: '社區空間',
  public_bookcase: '街頭書櫃',
  place_of_worship: '信仰節點',
  pedestrian_street: '徒步街段',
};

function radiusForTime(timeValue: string | null) {
  switch (timeValue) {
    case '15':
      return 900;
    case '30':
      return 1500;
    case '60':
      return 2400;
    case '90+':
      return 3200;
    default:
      return 1500;
  }
}

function idealDistanceForTime(timeValue: string | null) {
  switch (timeValue) {
    case '15':
      return 420;
    case '30':
      return 720;
    case '60':
      return 1100;
    case '90+':
      return 1500;
    default:
      return 720;
  }
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

function pointForElement(element: OverpassElement): GeoPoint | null {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;

  if (latitude === undefined || longitude === undefined) {
    return null;
  }

  return { latitude, longitude };
}

function placeName(tags: Record<string, string>) {
  return (
    tags['name:zh-Hant'] ??
    tags['name:zh'] ??
    tags.name ??
    tags['name:en'] ??
    null
  );
}

function categoryForTags(tags: Record<string, string>) {
  if (tags.tourism === 'artwork') return 'artwork';
  if (tags.tourism === 'viewpoint') return 'viewpoint';

  if (tags.historic === 'monument') return 'monument';
  if (tags.historic === 'memorial') return 'memorial';
  if (tags.historic === 'ruins') return 'ruins';
  if (tags.historic === 'archaeological_site') return 'archaeological_site';
  if (tags.historic === 'wayside_shrine') return 'wayside_shrine';

  if (tags.leisure === 'garden') return 'garden';
  if (tags.leisure === 'park') return 'park';

  if (tags.amenity === 'marketplace') return 'marketplace';
  if (tags.amenity === 'food_court') return 'food_court';
  if (tags.amenity === 'fountain') return 'fountain';
  if (tags.amenity === 'library') return 'library';
  if (tags.amenity === 'community_centre') return 'community_centre';
  if (tags.amenity === 'public_bookcase') return 'public_bookcase';
  if (tags.amenity === 'place_of_worship') return 'place_of_worship';

  if (tags.place === 'square') return 'square';
  if (tags.natural === 'tree') return 'named_tree';
  if (tags.highway === 'pedestrian') return 'pedestrian_street';

  return null;
}

function isTransit(tags: Record<string, string>) {
  return (
    tags.public_transport === 'station' ||
    tags.railway === 'station' ||
    tags.station === 'subway'
  );
}

function isAllowed(tags: Record<string, string>) {
  const access = tags.access?.toLowerCase();

  if (access === 'private' || access === 'no' || access === 'customers') {
    return false;
  }

  if (tags.fee === 'yes') {
    return false;
  }

  return true;
}

function buildQuery(latitude: number, longitude: number, radius: number) {
  const around = `(around:${Math.round(radius)},${latitude.toFixed(6)},${longitude.toFixed(6)})`;

  return `
[out:json][timeout:14];
(
  nwr${around}["tourism"~"^(artwork|viewpoint)$"];
  nwr${around}["historic"~"^(memorial|monument|ruins|archaeological_site|wayside_shrine)$"];
  nwr${around}["leisure"~"^(park|garden)$"];
  nwr${around}["amenity"~"^(fountain|marketplace|food_court|library|community_centre|public_bookcase|place_of_worship)$"];
  nwr${around}["place"="square"];
  nwr${around}["natural"="tree"]["name"];
  nwr${around}["highway"="pedestrian"]["name"];
  nwr${around}["public_transport"="station"];
  nwr${around}["railway"="station"];
);
out center tags;
`;
}

function nearestTransitDistance(point: GeoPoint, transitPoints: GeoPoint[]) {
  if (transitPoints.length === 0) return Number.POSITIVE_INFINITY;

  let nearest = Number.POSITIVE_INFINITY;

  for (const transit of transitPoints) {
    const distance = getDistanceInMeters(
      point.latitude,
      point.longitude,
      transit.latitude,
      transit.longitude
    );

    nearest = Math.min(nearest, distance);
  }

  return nearest;
}

function missionFor(
  categoryCode: string,
  moodId: MoodId,
  name: string
): Mission {
  const camera = moodId === 'camera';
  const quiet = moodId === 'quiet';
  const weird = moodId === 'weird';
  const food = moodId === 'food';

  if (categoryCode === 'park' || categoryCode === 'garden') {
    if (camera) {
      return {
        code: 'EDGE FRAME',
        title: '別拍公園。',
        instruction:
          '沿著外圍走一小段。找到植物和城市硬碰在一起的地方，再拍第一張。',
        playability: 88,
      };
    }

    if (quiet) {
      return {
        code: 'QUIET EDGE',
        title: '找最安靜的邊界。',
        instruction:
          '避開入口、遊具和最寬的步道。找到一個比較沒人經過的位置，停兩分鐘。',
        playability: 90,
      };
    }

    if (weird) {
      return {
        code: 'NOT A PARK',
        title: '找最不像公園的東西。',
        instruction:
          '不要找樹或草地。找一個放在這裡有點突兀、甚至不知道為什麼存在的東西。',
        playability: 92,
      };
    }

    return {
      code: 'NO MAIN PATH',
      title: '不要走中間。',
      instruction:
        '進去後避開最寬的主路，沿邊界走到下一個出口。只注意平常不會停下來看的東西。',
      playability: 86,
    };
  }

  if (categoryCode === 'marketplace' || categoryCode === 'food_court') {
    if (food) {
      return {
        code: 'ONE LAP FIRST',
        title: '先繞一圈，不准點。',
        instruction:
          '先完整走一圈，只看哪些攤位有人停下來。最後再選一個你原本沒打算吃的東西。',
        playability: 96,
      };
    }

    if (camera) {
      return {
        code: 'NO SIGNS',
        title: '不要拍招牌。',
        instruction:
          '找一個最像這裡生活節奏的瞬間：手、袋子、蒸氣、桌面或人流都可以。',
        playability: 94,
      };
    }

    return {
      code: 'READ THE CROWD',
      title: '先看人，不看店。',
      instruction:
        '站在邊緣觀察一分鐘。找出大家自然聚集的方向，再往那裡走。',
      playability: 91,
    };
  }

  if (
    categoryCode === 'monument' ||
    categoryCode === 'memorial' ||
    categoryCode === 'ruins' ||
    categoryCode === 'archaeological_site'
  ) {
    return {
      code: 'TIME TRACE',
      title: '找時間留下的破綻。',
      instruction:
        camera
          ? '不要先拍全貌。找字、裂縫、補丁、材質變化，或新舊接在一起的地方。'
          : '先不要查資料。只靠現場猜：哪一部分最老？哪一部分後來才加上去？',
      playability: 95,
    };
  }

  if (categoryCode === 'artwork') {
    return {
      code: 'WRONG ANGLE',
      title: '不要從正面看。',
      instruction:
        camera
          ? '繞它半圈，只拍一個你第一眼完全沒注意到的角度或細節。'
          : '繞它半圈。找一個從正面看不出來、但換位置才出現的細節。',
      playability: 96,
    };
  }

  if (categoryCode === 'viewpoint') {
    return {
      code: 'LOOK BACK',
      title: '到了先不要看遠方。',
      instruction:
        camera
          ? '先背對景色，找一個前景。等你找到能框住遠方的東西，再轉身拍。'
          : '先背對主要景色十秒，再轉身。第一個抓住你的東西才算答案。',
      playability: 91,
    };
  }

  if (categoryCode === 'wayside_shrine' || categoryCode === 'place_of_worship') {
    return {
      code: 'THRESHOLD',
      title: '看它怎麼接上日常。',
      instruction:
        '留在公共可進入的範圍，不打擾正在祭拜的人。找出它和住家、店面或街道交界的那一小段。',
      playability: 89,
    };
  }

  if (categoryCode === 'library') {
    return {
      code: 'ONE SPINE',
      title: '只找一個書名。',
      instruction:
        '如果開放就進公共區域；如果沒開就在外面停一下。不要找想看的書，只找一個讓你停住的書名。',
      playability: quiet ? 94 : 86,
    };
  }

  if (categoryCode === 'public_bookcase') {
    return {
      code: 'ONE PAGE',
      title: '打開一本你不會買的書。',
      instruction:
        '隨便選一本，翻到任意一頁，只讀第一句。不要借也沒關係，記住那一句就好。',
      playability: 98,
    };
  }

  if (categoryCode === 'community_centre') {
    return {
      code: 'LOCAL CLUE',
      title: '找一個只有附近人才懂的線索。',
      instruction:
        '留在公開區域，看公告、佈告欄、活動資訊或門口留下的東西。找一個最有「這裡生活感」的細節。',
      playability: 90,
    };
  }

  if (categoryCode === 'square') {
    return {
      code: 'CROSSING LINES',
      title: '站著別動一分鐘。',
      instruction:
        camera
          ? '先選好構圖，再等一個人自己走進去。不要追著人拍。'
          : '只看人流。猜大家最常從哪裡來、往哪裡去，然後選比較少人的方向離開。',
      playability: 94,
    };
  }

  if (categoryCode === 'pedestrian_street') {
    return {
      code: 'SLOW LANE',
      title: '把速度降一半。',
      instruction:
        '只走公開的人行區域。用平常一半的速度走完這一小段，找三個你平常會直接略過的店面或物件。',
      playability: 93,
    };
  }

  if (categoryCode === 'fountain') {
    return {
      code: 'ONLY WATER',
      title: camera ? '不要拍整座。' : '只看水怎麼動。',
      instruction: camera
        ? '只留下水、光、倒影或濺起來的一瞬間。照片裡不要出現完整噴泉。'
        : '停三十秒，只看水的節奏。找一個重複出現的動作。',
      playability: 88,
    };
  }

  if (categoryCode === 'named_tree') {
    return {
      code: 'CITY CLAIM',
      title: '看它佔了城市多少空間。',
      instruction:
        camera
          ? '不要只拍樹。把旁邊的招牌、牆、車道或建築一起放進畫面。'
          : '繞到另一側看看。找一個城市因為它而讓路的痕跡。',
      playability: 91,
    };
  }

  return {
    code: 'ONE DETAIL',
    title: `先別急著離開 ${name}。`,
    instruction: '停三十秒，找一個只有站在這裡才會注意到的細節。',
    playability: 80,
  };
}

function reasonFor(
  categoryCode: string,
  transitDistance: number,
  tags: Record<string, string>,
  known: boolean,
  mission: Mission
) {
  if (known) {
    return `你標記過「來過」。只有因為任務可玩性 ${mission.playability}/100，才還留在候選池。`;
  }

  const farFromTransit = transitDistance > 300;

  if (categoryCode === 'park' || categoryCode === 'garden') {
    return farFromTransit
      ? '它只是舞台，不是答案；只有任務夠好才有資格進路線。'
      : '離日常動線不遠，但任務會逼你用不同方式使用這個空間。';
  }

  if (categoryCode === 'artwork' || categoryCode === 'fountain') {
    return '有明確可觀察的物件，任務可以直接利用現場細節。';
  }

  if (
    categoryCode === 'ruins' ||
    categoryCode === 'archaeological_site' ||
    categoryCode === 'memorial' ||
    categoryCode === 'monument'
  ) {
    return tags.start_date
      ? '有年代線索，任務可以從現場直接讀城市留下的時間差。'
      : '不是以消費為目的的停靠點，而且現場有足夠東西可以觀察。';
  }

  if (categoryCode === 'marketplace' || categoryCode === 'food_court') {
    return '人流與生活節奏本身就是素材，不需要靠評分或打卡點成立。';
  }

  if (categoryCode === 'library' || categoryCode === 'public_bookcase') {
    return '它可以產生一個很小、很具體，而且不需要消費的任務。';
  }

  if (categoryCode === 'square' || categoryCode === 'pedestrian_street') {
    return '它是一個城市動線交界，任務可以直接使用人流與方向。';
  }

  if (categoryCode === 'wayside_shrine' || categoryCode === 'place_of_worship') {
    return '生活、街道與信仰在這裡接在一起；任務只使用公共空間並避免打擾。';
  }

  if (categoryCode === 'community_centre') {
    return '它通常有在地資訊，適合找只有附近居民才會注意到的線索。';
  }

  if (categoryCode === 'named_tree') {
    return '不是典型景點，但它和周圍城市空間的關係本身就可以變成任務。';
  }

  return '這裡能產生一個和現場直接相關的任務，而不只是叫你走過去。';
}

function scorePlace(
  place: RawPlace,
  moodId: MoodId,
  idealDistance: number,
  transitPoints: GeoPoint[],
  known: boolean,
  mission: Mission
) {
  let score = CATEGORY_BASE_SCORE[place.categoryCode] ?? 50;
  score += MOOD_BONUS[moodId][place.categoryCode] ?? 0;

  // Mission-first: a boring place with a strong task can survive, but a weak
  // task can no longer hide behind a high POI score.
  score += (mission.playability - 80) * 1.15;

  const distanceError = Math.abs(place.distanceMeters - idealDistance);
  score += Math.max(0, 24 * (1 - distanceError / idealDistance));

  const transitDistance = nearestTransitDistance(place, transitPoints);

  if (transitDistance < 140) {
    score -= 24;
  } else if (transitDistance < 260) {
    score -= 12;
  } else if (transitDistance > 450) {
    score += 7;
  }

  if (place.tags.brand) score -= 25;

  if (
    (place.categoryCode === 'park' || place.categoryCode === 'monument') &&
    (place.tags.wikipedia || place.tags.wikidata)
  ) {
    score -= 10;
  }

  if (place.tags.artist_name) score += 8;
  if (place.tags.start_date) score += 6;
  if (place.tags.architect) score += 5;
  if (place.tags.description) score += 3;

  if (known) {
    score -= 52;
  }

  return {
    score,
    transitDistance,
  };
}

function selectCandidates(candidates: PlaceCandidate[], start: GeoPoint) {
  const byScore = [...candidates].sort((a, b) => b.score - a.score);
  const chosen: PlaceCandidate[] = [];

  const tryChoose = (
    allowKnown: boolean,
    allowFamilyRepeat: boolean,
    minSpacing: number
  ) => {
    for (const candidate of byScore) {
      if (chosen.length >= 3) break;
      if (chosen.some((item) => item.id === candidate.id)) continue;
      if (!allowKnown && candidate.known) continue;

      // Same exact category is never repeated. Three parks is not a Detour.
      if (
        chosen.some(
          (item) => item.categoryCode === candidate.categoryCode
        )
      ) {
        continue;
      }

      // Green space is treated as one family: park + garden + named tree may
      // only occupy one stop unless we have absolutely no diverse alternative.
      if (
        !allowFamilyRepeat &&
        chosen.some(
          (item) => item.categoryFamily === candidate.categoryFamily
        )
      ) {
        continue;
      }

      if (
        candidate.categoryFamily === 'green' &&
        chosen.some((item) => item.categoryFamily === 'green')
      ) {
        continue;
      }

      const farEnough = chosen.every(
        (item) =>
          getDistanceInMeters(
            item.latitude,
            item.longitude,
            candidate.latitude,
            candidate.longitude
          ) >= minSpacing
      );

      if (!farEnough) continue;

      chosen.push(candidate);
    }
  };

  tryChoose(false, false, 220);
  if (chosen.length < 3) tryChoose(false, true, 180);
  if (chosen.length < 3) tryChoose(true, false, 180);
  if (chosen.length < 3) tryChoose(true, true, 120);

  if (chosen.length < 3) return chosen;

  const ordered: PlaceCandidate[] = [];
  const remaining = [...chosen];
  let cursor = start;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestCost = Number.POSITIVE_INFINITY;

    remaining.forEach((candidate, index) => {
      const distance = getDistanceInMeters(
        cursor.latitude,
        cursor.longitude,
        candidate.latitude,
        candidate.longitude
      );

      // A little nudge toward alternating category families even after the
      // selection phase, without turning this into route optimization yet.
      const familyPenalty =
        ordered.length > 0 &&
        ordered[ordered.length - 1].categoryFamily ===
          candidate.categoryFamily
          ? 250
          : 0;

      const cost = distance + familyPenalty;

      if (cost < bestCost) {
        bestCost = cost;
        bestIndex = index;
      }
    });

    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    cursor = next;
  }

  return ordered;
}

function checkpointTitle(index: number) {
  if (index === 0) return '第一個舞台。';
  if (index === 1) return '第二個舞台。';
  return '最後一個舞台。';
}

function buildCheckpoints(selectedCandidates: PlaceCandidate[]) {
  return selectedCandidates.map((candidate, index) => ({
    id: index + 1,
    placeId: candidate.id,
    placeName: candidate.name,
    category: candidate.category,
    categoryCode: candidate.categoryCode,
    reason: candidate.reason,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    title: checkpointTitle(index),
    note: `舞台：${candidate.name} · ${candidate.category}`,
    missionCode: candidate.mission.code,
    missionTitle: candidate.mission.title,
    mission: candidate.mission.instruction,
    cameraPrompt: candidate.mission.instruction,
    defaultPrompt: candidate.mission.instruction,
  } satisfies DetourCheckpoint));
}

function applyKnownAndSelect(params: {
  candidates: PlaceCandidate[];
  start: GeoPoint;
  knownPlaceIds: string[];
}) {
  const knownSet = new Set(params.knownPlaceIds);

  const rescored = params.candidates
    .map((candidate) => {
      const known = knownSet.has(candidate.id);
      const score = Math.round(candidate.baseScore - (known ? 52 : 0));

      return {
        ...candidate,
        known,
        score,
        selected: false,
        reason: known
          ? `你標記過「來過」。只有因為任務可玩性 ${candidate.mission.playability}/100，才還留在候選池。`
          : candidate.baseReason,
      };
    })
    .sort((a, b) => b.score - a.score);

  const selected = selectCandidates(rescored, params.start);

  if (selected.length < 3) {
    throw new Error('ENGINE_NOT_ENOUGH_DIVERSE_STAGES');
  }

  const selectedIds = new Set(selected.map((candidate) => candidate.id));

  const candidates = rescored.map((candidate) => ({
    ...candidate,
    selected: selectedIds.has(candidate.id),
  }));

  const selectedCandidates = selected.map((candidate) => ({
    ...candidate,
    selected: true,
  }));

  return {
    candidates,
    selectedCandidates,
    checkpoints: buildCheckpoints(selectedCandidates),
  };
}

export function rerankDetour(params: {
  candidates: PlaceCandidate[];
  start: GeoPoint;
  knownPlaceIds: string[];
}) {
  return applyKnownAndSelect(params);
}

export async function discoverDetour(params: {
  latitude: number;
  longitude: number;
  moodId: string | null;
  timeValue: string | null;
  knownPlaceIds?: string[];
}): Promise<DetourEngineResult> {
  const moodId = (
    ['wander', 'camera', 'food', 'quiet', 'weird', 'surprise'].includes(
      params.moodId ?? ''
    )
      ? params.moodId
      : 'surprise'
  ) as MoodId;

  const radiusMeters = radiusForTime(params.timeValue);
  const idealDistance = idealDistanceForTime(params.timeValue);
  const knownSet = new Set(params.knownPlaceIds ?? []);
  const query = buildQuery(
    params.latitude,
    params.longitude,
    radiusMeters
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 16000);

  let response: Response;

  try {
    response = await fetch(OVERPASS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timeout);
    throw new Error('ENGINE_NETWORK');
  }

  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error('ENGINE_SERVER');
  }

  const payload = (await response.json()) as {
    elements?: OverpassElement[];
  };

  const elements = payload.elements ?? [];
  const start: GeoPoint = {
    latitude: params.latitude,
    longitude: params.longitude,
  };

  const transitPoints = elements
    .filter((element) => isTransit(element.tags ?? {}))
    .map(pointForElement)
    .filter((point): point is GeoPoint => point !== null);

  const rawPlaces: RawPlace[] = [];
  const seen = new Set<string>();

  for (const element of elements) {
    const tags = element.tags ?? {};

    if (isTransit(tags) || !isAllowed(tags)) continue;

    const point = pointForElement(element);
    const categoryCode = categoryForTags(tags);
    const name = placeName(tags);

    if (!point || !categoryCode || !name) continue;

    const distanceMeters = getDistanceInMeters(
      start.latitude,
      start.longitude,
      point.latitude,
      point.longitude
    );

    if (distanceMeters < 170 || distanceMeters > radiusMeters) {
      continue;
    }

    const duplicateKey = `${name.trim().toLowerCase()}-${categoryCode}`;
    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);

    rawPlaces.push({
      ...point,
      id: `${element.type}/${element.id}`,
      osmType: element.type,
      osmId: element.id,
      name,
      category: CATEGORY_LABEL[categoryCode] ?? categoryCode,
      categoryCode,
      categoryFamily: CATEGORY_FAMILY[categoryCode] ?? categoryCode,
      distanceMeters,
      tags,
    });
  }

  const scored = rawPlaces
    .map((place) => {
      const known = knownSet.has(place.id);
      const mission = missionFor(place.categoryCode, moodId, place.name);
      const { score, transitDistance } = scorePlace(
        place,
        moodId,
        idealDistance,
        transitPoints,
        known,
        mission
      );

      const baseScore = known ? score + 52 : score;

      const baseReason = reasonFor(
        place.categoryCode,
        transitDistance,
        place.tags,
        false,
        mission
      );

      return {
        id: place.id,
        osmType: place.osmType,
        osmId: place.osmId,
        name: place.name,
        category: place.category,
        categoryCode: place.categoryCode,
        categoryFamily: place.categoryFamily,
        latitude: place.latitude,
        longitude: place.longitude,
        distanceMeters: place.distanceMeters,
        baseScore: Math.round(baseScore),
        score: Math.round(score),
        baseReason,
        reason: known
          ? `你標記過「來過」。只有因為任務可玩性 ${mission.playability}/100，才還留在候選池。`
          : baseReason,
        mission,
        known,
        selected: false,
      } satisfies PlaceCandidate;
    })
    .sort((a, b) => b.score - a.score);

  // Keep a deeper pool than v0.7 so that marking a familiar place can swap in
  // a replacement without another network request.
  const candidatePool = scored.slice(0, 24);

  const ranked = applyKnownAndSelect({
    candidates: candidatePool,
    start,
    knownPlaceIds: params.knownPlaceIds ?? [],
  });

  return {
    candidates: ranked.candidates,
    selectedCandidates: ranked.selectedCandidates,
    checkpoints: ranked.checkpoints,
    radiusMeters,
    source: 'OpenStreetMap',
  };
}
