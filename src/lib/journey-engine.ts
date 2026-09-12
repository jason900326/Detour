export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type MoodId =
  | 'wander'
  | 'food'
  | 'quiet'
  | 'weird'
  | 'color'
  | 'surprise';

export type LightContext = 'day' | 'twilight' | 'night';

export type ColorId =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple';

export type ColorChoice = {
  id: ColorId;
  label: string;
  code: string;
  hex: string;
};

export type Mission = {
  id: string;
  code: string;
  family?: MissionFamily;
  title: string;
  instruction: string;
  completion: string;
  // true = photo is required. false = photo is optional in the UI.
  photo: boolean;
  portable: boolean;
};

export type JourneyProfile = {
  minutes: number;
  targetDistanceMeters: number;
  sideMissionCount: number;
  milestones: number[];
};

export type JourneyPlan = {
  context: LightContext;
  contextCode: 'DAY' | 'TWILIGHT' | 'NIGHT';
  contextLabel: string;
  contextNote: string;
  profile: JourneyProfile;
  sideMissions: Mission[];
  arrivalMission: Mission;
};

export const COLORS: ColorChoice[] = [
  { id: 'red', label: '紅色', code: 'RED', hex: '#D93B2B' },
  { id: 'orange', label: '橘色', code: 'ORANGE', hex: '#FF6A2A' },
  { id: 'yellow', label: '黃色', code: 'YELLOW', hex: '#E7B928' },
  { id: 'green', label: '綠色', code: 'GREEN', hex: '#3F7A4A' },
  { id: 'blue', label: '藍色', code: 'BLUE', hex: '#2B5EA8' },
  { id: 'purple', label: '紫色', code: 'PURPLE', hex: '#7550A6' },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

export function getLightContext(
  point: GeoPoint,
  date = new Date()
): LightContext {
  const radians = Math.PI / 180;
  const latitude = point.latitude * radians;
  const days = dayOfYear(date);
  const localHour =
    date.getHours() +
    date.getMinutes() / 60 +
    date.getSeconds() / 3600;

  const gamma =
    (2 * Math.PI * (days - 1 + (localHour - 12) / 24)) / 365;

  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const timezoneHours = -date.getTimezoneOffset() / 60;
  const localMinutes =
    date.getHours() * 60 +
    date.getMinutes() +
    date.getSeconds() / 60;

  let trueSolarMinutes =
    localMinutes +
    equationOfTime +
    4 * point.longitude -
    60 * timezoneHours;

  trueSolarMinutes = ((trueSolarMinutes % 1440) + 1440) % 1440;

  const hourAngleDegrees = trueSolarMinutes / 4 - 180;
  const hourAngle = hourAngleDegrees * radians;

  const cosineZenith = clamp(
    Math.sin(latitude) * Math.sin(declination) +
      Math.cos(latitude) *
        Math.cos(declination) *
        Math.cos(hourAngle),
    -1,
    1
  );

  const zenith = Math.acos(cosineZenith) / radians;
  const elevation = 90 - zenith;

  if (elevation > 0) return 'day';
  if (elevation > -6) return 'twilight';
  return 'night';
}

export function getContextMeta(context: LightContext) {
  if (context === 'night') {
    return {
      code: 'NIGHT' as const,
      label: '夜間',
      note: '只留在有照明、公開可走的位置。任務不值得你走進暗巷、封閉空間或偏僻角落。',
    };
  }

  if (context === 'twilight') {
    return {
      code: 'TWILIGHT' as const,
      label: '黃昏',
      note: '天色正在變暗。只在你原本就能安全步行的範圍內完成任務。',
    };
  }

  return {
    code: 'DAY' as const,
    label: '白天',
    note: '任務只使用沿路就能找到的線索，不要求特定店家、建築或都市設施。',
  };
}

export function getJourneyProfile(minutes: number): JourneyProfile {
  // Public UI only offers 15 / 30 / 45 / 60 / 90. Keep 5–10 support
  // internally so short recovery legs can still be resolved safely.
  const safeMinutes = clamp(Math.round(minutes / 5) * 5, 5, 90);
  let targetDistanceMeters: number;
  let sideMissionCount: number;

  if (safeMinutes <= 5) {
    targetDistanceMeters = 220;
    sideMissionCount = 1;
  } else if (safeMinutes <= 10) {
    targetDistanceMeters = 420;
    sideMissionCount = 2;
  } else if (safeMinutes <= 15) {
    targetDistanceMeters = 680;
    sideMissionCount = 3;
  } else if (safeMinutes <= 30) {
    targetDistanceMeters = Math.round(680 + (safeMinutes - 15) * 28);
    sideMissionCount = 4;
  } else if (safeMinutes <= 45) {
    targetDistanceMeters = Math.round(1100 + (safeMinutes - 30) * 22);
    sideMissionCount = 5;
  } else if (safeMinutes <= 60) {
    targetDistanceMeters = Math.round(1430 + (safeMinutes - 45) * 18);
    sideMissionCount = 5;
  } else {
    // 90 minutes is intentionally not 1.5× the 60-minute distance. The
    // extra time is budget for looking, photographing and city friction.
    targetDistanceMeters = Math.round(1700 + (safeMinutes - 60) * (400 / 30));
    sideMissionCount = 5;
  }

  const milestones = Array.from(
    { length: sideMissionCount },
    (_, index) =>
      Number((((index + 1) / (sideMissionCount + 1)) * 0.9).toFixed(2))
  );

  return { minutes: safeMinutes, targetDistanceMeters, sideMissionCount, milestones };
}

function withIds(prefix: string, missions: Omit<Mission, 'id'>[]): Mission[] {
  return missions.map((mission, index) => ({
    ...mission,
    id: `${prefix}-${index + 1}`,
  }));
}

function portableWanderMissions(context: LightContext): Mission[] {
  const night = context === 'night';

  return withIds('wander', [
    {
      code: '3 TEXTURES',
      title: '找到三種不同的表面。',
      instruction:
        '沿主線繼續走。找三種摸起來明顯不同的材質，例如柏油、磚、泥土、金屬、木頭或葉子。',
      completion: '看到第三種材質，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'BOUNDARY',
      title: '找一條很清楚的界線。',
      instruction:
        '找兩種東西剛好碰在一起的位置：兩種地面、光和影、牆和植物、乾和濕都可以。',
      completion: '用手指出那條交界線，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'REPEAT ×3',
      title: '找同一個形狀三次。',
      instruction:
        '圓、方形、三角形、格子都可以。不用停下來找很久，邊走邊數。',
      completion: '數到第三個相同形狀，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'NEAR / FAR',
      title: '找最近和最遠的聲音。',
      instruction: night
        ? '留在現在明亮的位置，聽五秒。先找離你最近的聲音，再找一個明顯更遠的聲音。'
        : '邊走邊聽五秒。先找離你最近的聲音，再找一個明顯更遠的聲音。',
      completion: '兩個聲音都能指出來，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'HIGH / LOW',
      title: '同時找最高和最低。',
      instruction:
        '不要特別繞路。從你現在看得到的範圍，找一個最高的東西，再找一個最低的東西。',
      completion: '兩個都指出來，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'MOVEMENT',
      title: '找一個不是你造成的移動。',
      instruction:
        '人、車、風吹的葉子、水、影子都可以。不要追它，只要在原本的路上找到。',
      completion: '看著它連續移動五秒，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'COLOR BREAK',
      title: '找一個最跳出來的顏色。',
      instruction:
        '先看周圍大多數東西是什麼顏色，再找一個明顯不屬於那一群的顏色。',
      completion: '指出那個顏色和它所在的物件，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'TINY / HUGE',
      title: '找一個很小的東西貼在很大的東西上。',
      instruction:
        '例如一片葉子在牆上、貼紙在柱子上、小標記在大片地面上。不要離開主線去找。',
      completion: '找到一組「小東西 + 大背景」，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'ONE ODD',
      title: '找一個只有它不一樣。',
      instruction:
        '先找到一群相似的東西，再找裡面唯一不同的一個。形狀、顏色、方向或材質都算。',
      completion: '能指出「那一個為什麼不同」，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'LOOK BACK',
      title: '過下一個轉折後，回頭一次。',
      instruction:
        '不用原路走回去。等主線自然轉彎或改變方向後，只回頭看五秒。',
      completion: '找到一個來的時候沒注意到的東西，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'COLOR ECHO',
      title: '讓一個顏色再出現一次。',
      instruction:
        '先記住你現在第一眼看到的明顯顏色。接下來繼續走，看看它會不會以另一種材質或大小再次出現。',
      completion: '第二次看到同一個顏色，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'OLD / NEW',
      title: '找一個看起來很舊，旁邊又很新的東西。',
      instruction:
        '不必知道年份。只用材質、磨損、修補或設計去判斷。',
      completion: '找到一組「舊 + 新」靠得很近的東西，就完成。',
      photo: false,
      portable: true,
    },
  ]);
}

function cameraColorMissions(
  color: ColorChoice,
  context: LightContext
): Mission[] {
  const colorName = color.label;
  const night = context === 'night';

  return withIds('camera', [
    {
      code: 'FIRST HIT',
      title: `找到第一個${colorName}。`,
      instruction: `不要找漂亮的。沿主線繼續走，第一個清楚的${colorName}出現時就停。`,
      completion: `拍下第一個${colorName}。`,
      photo: true,
      portable: true,
    },
    {
      code: 'SMALL SHARE',
      title: `讓${colorName}只佔一小角。`,
      instruction: `下一個${colorName}出現時，不要把它放中間。讓它只佔畫面大約十分之一。`,
      completion: `拍一張${colorName}不是主角的照片。`,
      photo: true,
      portable: true,
    },
    {
      code: 'TWO MATERIALS',
      title: `找兩種材質的${colorName}。`,
      instruction: `找同一個${colorName}出現在兩種不同材質上，例如金屬和布、塑膠和植物。`,
      completion: '兩種材質同時進入一張照片，就完成。',
      photo: true,
      portable: true,
    },
    {
      code: 'EDGE FRAME',
      title: `讓${colorName}碰到畫面邊緣。`,
      instruction: `不要把${colorName}放中央。移動你站的位置，讓它從照片的一側切進來。`,
      completion: `拍到${colorName}碰著照片邊框。`,
      photo: true,
      portable: true,
    },
    {
      code: 'NEAR / FAR',
      title: `讓${colorName}出現兩個距離。`,
      instruction: `找近處和遠處各一個${colorName}。不用是同一種東西。`,
      completion: '近處和遠處的指定顏色同時入鏡。',
      photo: true,
      portable: true,
    },
    {
      code: 'DOMINANT',
      title: `這次讓${colorName}佔滿。`,
      instruction: night
        ? `留在有照明的位置。找一塊夠大的${colorName}，靠近一點，讓它佔畫面一半以上。`
        : `找一塊夠大的${colorName}，靠近一點，讓它佔畫面一半以上。`,
      completion: `拍一張第一眼先看到${colorName}的照片。`,
      photo: true,
      portable: true,
    },
    {
      code: 'CONTRAST',
      title: `替${colorName}找一個對手。`,
      instruction: `找一個和${colorName}差很多的顏色，讓兩個顏色同時存在。`,
      completion: '兩個顏色都清楚可辨，就完成。',
      photo: true,
      portable: true,
    },
    {
      code: 'HIDE HALF',
      title: `藏掉一半${colorName}。`,
      instruction: `用另一個物件、邊緣或角度擋住一部分${colorName}。不要移動公共物品。`,
      completion: `拍一張指定顏色只露出一部分的照片。`,
      photo: true,
      portable: true,
    },
    {
      code: 'ONE / MANY',
      title: `找一個${colorName}對上一群東西。`,
      instruction: `讓畫面裡只有一個明確的${colorName}，旁邊則有一群其他元素。`,
      completion: `照片裡能一眼指出唯一的${colorName}。`,
      photo: true,
      portable: true,
    },
  ]);
}

function quietMissions(context: LightContext): Mission[] {
  const night = context === 'night';

  return withIds('quiet', [
    {
      code: '3 SOUNDS',
      title: '找出三個聲音。',
      instruction: '不用閉眼。站在不擋路的位置，分別找出近、中、遠三個聲音。',
      completion: '三個距離層次都找出來，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'ONE STILL',
      title: '找一個完全不動的東西。',
      instruction: '人和車經過都沒關係，只選一個固定物件看十秒。',
      completion: '十秒內一直看同一個東西，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'SOFTEST',
      title: '找最小聲的那一個。',
      instruction: night
        ? '留在明亮公共位置。從你現在聽到的聲音裡，找一個最容易被忽略的。'
        : '從你現在聽到的聲音裡，找一個最容易被忽略的。',
      completion: '能說出聲音來源，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'SLOW 20',
      title: '接下來只走二十步。',
      instruction: '二十步都比平常慢一點。不要停在路中央。',
      completion: '數完二十步，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'LIGHT / DARK',
      title: '找最亮和最暗。',
      instruction: '只看你現在安全可見的範圍，不往暗處走。找最亮和最暗的兩個位置。',
      completion: '兩個位置都指出來，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'ONE RHYTHM',
      title: '找一個重複的節奏。',
      instruction: '聲音、腳步、燈光、影子或規律排列都可以。',
      completion: '連續注意到同一節奏三次，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'BREATH / VIEW',
      title: '看一個地方，呼吸三次。',
      instruction: '不用冥想。選一個不會移動的視野，正常呼吸三次。',
      completion: '第三次吐氣後就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'ONE DETAIL',
      title: '找一個一公分左右的細節。',
      instruction: '不用真的量。找一個你如果走太快就不會看到的小東西。',
      completion: '找到一個，就完成。',
      photo: false,
      portable: true,
    },
  ]);
}

function weirdMissions(context: LightContext): Mission[] {
  const night = context === 'night';

  return withIds('weird', [
    {
      code: 'WHAT IS IT',
      title: '找一個三秒看不懂用途的東西。',
      instruction: '只看公共可見的東西。先不要查答案，也不要靠近私人空間。',
      completion: '先猜一個用途，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'WRONG SCALE',
      title: '找一個比例怪怪的東西。',
      instruction: '特別大、特別小、太厚、太細都可以。',
      completion: '找到一個讓你覺得尺寸不太合理的東西。',
      photo: false,
      portable: true,
    },
    {
      code: 'FIVE SAME',
      title: '找五個一樣的東西。',
      instruction: '形狀或排列相同就算，不需要知道用途。',
      completion: '數到五個，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'ODD SHADOW',
      title: night ? '找一個奇怪的亮點。' : '找一個不像本體的影子。',
      instruction: night
        ? '只在有照明的地方看。找顏色、形狀或位置特別突兀的光。'
        : '找一個形狀很難直接猜到本體是什麼的影子。',
      completion: night ? '找到光源，就完成。' : '找到影子的本體，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'BROKEN LINE',
      title: '找一條突然中斷的線。',
      instruction: '地面線、欄杆、牆、排水、植物邊界都算。',
      completion: '找到線在哪裡中斷，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'ONE OUT',
      title: '找一個不屬於那一群的東西。',
      instruction: '先找到一群相似元素，再找唯一不同的一個。',
      completion: '指出唯一不同的那個，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'TINY MYSTERY',
      title: '留下一個小問題。',
      instruction: '找到一個你暫時不知道原因的細節。不要查。',
      completion: '把問題用一句「為什麼……？」說出來，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'DOUBLE TAKE',
      title: '找一個會讓你回頭看第二次的東西。',
      instruction: '不用追求奇觀。只要你第一眼走過、第二眼又想確認。',
      completion: '真的回頭看第二次，就完成。',
      photo: false,
      portable: true,
    },
  ]);
}

function foodMissions(context: LightContext): Mission[] {
  const night = context === 'night';

  return withIds('food', [
    {
      code: 'FIRST FOOD WORD',
      title: '找第一個真的和食物有關的字。',
      instruction: night
        ? '沿著明亮公共路線繼續走。菜名、店名、食材、飲料或甜點都算；第一個看到就算，不用比較。'
        : '沿主線繼續走。菜名、店名、食材、飲料或甜點都算；第一個看到就算，不用比較。',
      completion: '記住那個字，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'FIRST PRICE',
      title: '只記住第一個食物價格。',
      instruction:
        '如果沿路剛好看到菜單、價目或包裝，只看第一個清楚的價格。不要比較哪個划算。',
      completion: '記住一個價格就完成；一路都沒看到也可以跳過。',
      photo: false,
      portable: true,
    },
    {
      code: 'SMELL TRACE',
      title: '找一個真的食物氣味。',
      instruction:
        '不用改道，也不用靠近店門。沿主線走時，如果聞到明顯食物味道，只判斷它比較像甜、鹹、烤或炸。',
      completion: '能說出一個分類，就完成；完全沒聞到可以跳過。',
      photo: false,
      portable: true,
    },
    {
      code: 'PACKED / PLATED',
      title: '找一個「帶著走」或「坐下吃」的線索。',
      instruction:
        '看到外帶盒、紙袋、桌椅、餐具或櫃檯時，只判斷它比較像帶走還是坐下。',
      completion: '做出一次判斷，就完成。',
      photo: false,
      portable: true,
    },
    {
      code: 'FOOD PROOF',
      title: '替這趟食物主線留一張證據。',
      instruction:
        '拍一個公開可見、能證明附近真的有食物活動的東西。招牌、菜單、包裝、餐具或蒸氣都可以；不要特別拍人臉。',
      completion: '拍下一張食物線索，就完成。',
      photo: true,
      portable: true,
    },
  ]);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }

  return copy;
}


function cameraFirstSideMissions(context: LightContext): Mission[] {
  const nightNote = context === 'night'
    ? '留在有照明、公開可走的位置。'
    : '';

  return withIds('camera-first', [
    {
      code: 'ONE SCOOTER',
      family: 'visual',
      title: '拍一台機車。',
      instruction: `${nightNote} 停在路邊或沿路經過的都可以；不要走進車道。`,
      completion: '照片裡有一台清楚的機車。',
      photo: true,
      portable: true,
    },
    {
      code: 'ONE CIRCLE',
      family: 'pattern',
      title: '拍一個圓形。',
      instruction: `${nightNote} 招牌、輪子、蓋子、燈或圖案都可以；只要一眼看得出是圓的。`,
      completion: '拍到一個清楚的圓形。',
      photo: true,
      portable: true,
    },
    {
      code: 'ONE NUMBER',
      family: 'count',
      title: '拍一個數字。',
      instruction: `${nightNote} 門牌、路牌、價目、標示都可以；看到第一個清楚的數字就拍。`,
      completion: '照片裡有一個讀得出的數字。',
      photo: true,
      portable: true,
    },
    {
      code: 'ONE ARROW',
      family: 'perspective',
      title: '拍一個箭頭。',
      instruction: `${nightNote} 地面、路牌、貼紙或標示都算；不要為了找它繞路。`,
      completion: '照片裡有一個清楚的箭頭。',
      photo: true,
      portable: true,
    },
    {
      code: 'ONE BICYCLE',
      family: 'contrast',
      title: '拍一台腳踏車。',
      instruction: `${nightNote} 路邊停著的、共享單車或正在遠處經過的都可以；不要追人。`,
      completion: '照片裡有一台腳踏車。',
      photo: true,
      portable: true,
    },
    {
      code: 'TWO SAME',
      family: 'framing',
      title: '把兩個一樣的東西拍在一起。',
      instruction: `${nightNote} 兩張椅子、兩個盆栽、兩扇窗、兩個路樁都可以。`,
      completion: '同一張照片裡看得到兩個相同或幾乎相同的東西。',
      photo: true,
      portable: true,
    },
    {
      code: 'UTILITY BOX',
      family: 'texture',
      title: '拍一個電箱。',
      instruction: `${nightNote} 找路邊公開可見的配電箱、控制箱或金屬設備箱。找不到就直接跳過。`,
      completion: '拍到一個箱型的公共設備。',
      photo: true,
      portable: true,
    },
    {
      code: 'MANHOLE',
      family: 'boundary',
      title: '拍一個人孔蓋。',
      instruction: `${nightNote} 不用走到馬路中央；只拍安全可見的人孔蓋或排水蓋。找不到就跳過。`,
      completion: '拍到一個地面金屬蓋。',
      photo: true,
      portable: true,
    },
    {
      code: 'ONE STICKER',
      family: 'mystery',
      title: '拍一張貼紙。',
      instruction: `${nightNote} 只拍公共可見、已經貼著的貼紙；不要撕、不要碰。`,
      completion: '照片裡有一張清楚的貼紙。',
      photo: true,
      portable: true,
    },
    {
      code: 'ONE TRIANGLE',
      family: 'scale',
      title: '拍一個三角形。',
      instruction: `${nightNote} 標誌、屋頂、支架、圖案都可以。`,
      completion: '照片裡有一個一眼能認出的三角形。',
      photo: true,
      portable: true,
    },
    {
      code: 'ONE SIGN',
      family: 'visual',
      title: '拍一個路邊標示。',
      instruction: `${nightNote} 路牌、告示、店家標示或公共標誌都可以；第一個看得懂的就拍。`,
      completion: '照片裡有一個清楚可辨的標示。',
      photo: true,
      portable: true,
    },
    {
      code: 'STRAIGHT LINE',
      family: 'pattern',
      title: '拍一條很直的線。',
      instruction: `${nightNote} 牆邊、欄杆、磁磚縫、路面標線都可以。`,
      completion: '照片裡有一條明確的直線。',
      photo: true,
      portable: true,
    },
  ]);
}


export type MissionFamily =
  | 'sound'
  | 'movement'
  | 'pause'
  | 'pattern'
  | 'mystery'
  | 'food'
  | 'photo'
  | 'visual'
  | 'count'
  | 'contrast'
  | 'scale'
  | 'texture'
  | 'framing'
  | 'boundary'
  | 'perspective';

function missionFamily(mission: Mission): MissionFamily {
  if (mission.family) return mission.family;
  if (mission.photo) return 'photo';

  const code = mission.code.toUpperCase();

  if (
    code.includes('SOUND') ||
    code.includes('RHYTHM') ||
    code === 'SOFTEST' ||
    code === 'NEAR / FAR'
  ) {
    return 'sound';
  }

  if (
    code.includes('MOVEMENT') ||
    code.includes('SLOW') ||
    code === 'LOOK BACK'
  ) {
    return 'movement';
  }

  if (
    code.includes('BREATH') ||
    code.includes('ONE STILL')
  ) {
    return 'pause';
  }

  if (
    code.includes('WHAT IS IT') ||
    code.includes('MYSTERY') ||
    code.includes('DOUBLE TAKE') ||
    code.includes('WRONG SCALE') ||
    code.includes('ONE ODD')
  ) {
    return 'mystery';
  }

  if (
    code.includes('FOOD') ||
    code.includes('PRICE') ||
    code.includes('SMELL') ||
    code.includes('PACKED')
  ) {
    return 'food';
  }

  if (
    code.includes('REPEAT') ||
    code.includes('FIVE SAME') ||
    code.includes('BROKEN LINE') ||
    code.includes('BOUNDARY') ||
    code.includes('ONE OUT')
  ) {
    return 'pattern';
  }

  return 'visual';
}

function selectVariedMissions(
  pool: Mission[],
  count: number
) {
  const shuffled = shuffle(pool);
  const selected: Mission[] = [];
  const usedIds = new Set<string>();

  while (
    selected.length < count &&
    usedIds.size < shuffled.length
  ) {
    const previousFamily =
      selected.length > 0
        ? missionFamily(
            selected[selected.length - 1]
          )
        : null;

    let candidate =
      shuffled.find(
        (mission) =>
          !usedIds.has(mission.id) &&
          missionFamily(mission) !==
            previousFamily
      ) ??
      shuffled.find(
        (mission) =>
          !usedIds.has(mission.id)
      );

    if (!candidate) break;

    // Don't begin a Detour by telling the user to stop.
    if (
      selected.length === 0 &&
      missionFamily(candidate) === 'pause'
    ) {
      const replacement =
        shuffled.find(
          (mission) =>
            !usedIds.has(mission.id) &&
            missionFamily(mission) !== 'pause'
        );

      if (replacement) {
        candidate = replacement;
      }
    }

    selected.push(candidate);
    usedIds.add(candidate.id);
  }

  return selected;
}

function buildFoodMissionSequence(
  context: LightContext,
  count: number
) {
  const generalPool = [
    ...portableWanderMissions(context),
    ...quietMissions(context).filter(
      (mission) =>
        !['BREATH / VIEW', 'ONE STILL'].includes(
          mission.code
        )
    ),
  ];

  const foodPool = shuffle(
    foodMissions(context)
  );

  // The route should still be interesting even if there are no food
  // signs until the destination. Only the last Side Quest asks for a
  // food-specific clue, when we're naturally closer to the chosen place.
  const generalCount = Math.max(
    0,
    count - 1
  );

  const general =
    selectVariedMissions(
      generalPool,
      generalCount
    );

  const foodClue =
    foodPool.find(
      (mission) =>
        mission.code !== 'FOOD PROOF'
    ) ??
    foodPool[0];

  if (!foodClue) {
    return general.slice(0, count);
  }

  return [
    ...general,
    foodClue,
  ].slice(0, count);
}

function arrivalMission(args: {
  moodId: MoodId;
  color?: ColorChoice | null;
}): Mission {

  if (args.moodId === 'color') {
    return {
      id: 'arrival-color',
      code: 'ARRIVAL',
      title: '到了。',
      instruction: args.color
        ? `這趟一路找的是${args.color.label}。看到就拍，沒看到也不用回頭。`
        : '這趟的顏色散步到這裡結束。',
      completion: '抵達終點就完成這趟 DETOUR。',
      photo: false,
      portable: true,
    };
  }

  if (args.moodId === 'quiet') {
    return {
      id: 'arrival-quiet',
      code: 'ARRIVAL',
      title: '到了。先不要離開。',
      instruction: '找出你現在最近的聲音和最遠的聲音，各聽一次。',
      completion: '兩個聲音都能指出來，就完成主線。',
      photo: false,
      portable: true,
    };
  }

  if (args.moodId === 'weird') {
    return {
      id: 'arrival-weird',
      code: 'ARRIVAL',
      title: '到了。找一個不合理的細節。',
      instruction: '只看公共可見範圍。找一個你暫時不知道為什麼會在這裡的東西。',
      completion: '先猜一個理由，就完成主線。',
      photo: false,
      portable: true,
    };
  }

  if (args.moodId === 'food') {
    return {
      id: 'arrival-food',
      code: 'ARRIVAL PROOF',
      title: '到了。拍下 DETOUR 的最後證據。',
      instruction: '這裡不再叫你決定要吃什麼。拍下目前最符合這趟「熱食」規則的公開食物線索；真正接回 Scene Engine 後，這一站會直接是一個由 DETOUR 選好的實際食物目的地。',
      completion: '拍下最後一個食物線索，就完成主線。',
      photo: true,
      portable: false,
    };
  }

  return {
    id: 'arrival-wander',
    code: 'ARRIVAL',
    title: '到了。找一組反差。',
    instruction: '站在原地或公共可走範圍內，找兩個靠得很近、但材質、大小或用途明顯不同的東西。',
    completion: '兩個都指出來，就完成主線。',
    photo: false,
    portable: true,
  };
}

export function buildJourneyPlan(args: {
  minutes: number;
  moodId: MoodId;
  context: LightContext;
  color?: ColorChoice | null;
}): JourneyPlan {
  const profile = getJourneyProfile(args.minutes);
  const meta = getContextMeta(args.context);

  // v0.38 mission rule: mood changes the destination taste, not the
  // basic Side Quest grammar. Every Side Quest is a quick, concrete camera
  // prompt so the user naturally returns with a small visual record.
  const unique =
    args.moodId === 'color'
      ? []
      : selectVariedMissions(
          cameraFirstSideMissions(args.context),
          profile.sideMissionCount
        );

  return {
    context: args.context,
    contextCode: meta.code,
    contextLabel: meta.label,
    contextNote: meta.note,
    profile,
    sideMissions: unique,
    arrivalMission: arrivalMission({
      moodId: args.moodId,
      color: args.color,
    }),
  };
}
